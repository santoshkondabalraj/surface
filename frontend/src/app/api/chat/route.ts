import type { Tool, MessageParam, ToolUseBlock, ToolResultBlockParam, ContentBlock } from "@anthropic-ai/sdk/resources/messages.js";
import { anthropic, MODEL } from "@/lib/anthropic";
import { getMCPClient, resetMCPClient } from "@/lib/mcp-client";
import type { StreamEvent } from "@/lib/types";
import { structureToolResult, formatForAgent } from "@/lib/tool-results";
import { traceToolCall, getTracingConfig } from "@/lib/langsmith";
import { tracer } from "@/lib/langsmith-trace";

export const maxDuration = 300;

interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

function send(controller: ReadableStreamDefaultController, event: StreamEvent, encoder: TextEncoder) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function makeTimer() {
  const start = performance.now();
  let last = start;
  return (label: string) => {
    const now = performance.now();
    const step = (now - last).toFixed(0);
    const total = (now - start).toFixed(0);
    console.log(`[OMS Q&A] ${label.padEnd(40)} step: ${step.padStart(6)}ms  total: ${total.padStart(6)}ms`);
    last = now;
  };
}

function mcpToolToAnthropic(mcpTool: { name: string; description?: string; inputSchema: unknown }): Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description ?? "",
    input_schema: mcpTool.inputSchema as Tool["input_schema"],
  };
}

const BASE_SYSTEM_PROMPT =
  "You are an expert OMS (Order Management System) assistant for Sterling OMS. " +
  "Help developers understand business rules, query live OMS data, and troubleshoot issues. \n\n" +
  "[PROMPT VERSION: 2026-08-25-v6 | Structured tool results | Autonomous orchestration]\n\n" +
  "## Understanding Tool Results\n" +
  "Tool outputs are now semantically structured to help you reason better:\n\n" +
  "**Table results**: When a tool returns multiple records, you'll see:\n" +
  "  Table with N rows, M columns (showing X/Y): [data]\n" +
  "  → Summarize key findings, not row-by-row details\n" +
  "  → If truncated (showing 10/143), offer to show specific subset\n\n" +
  "**Code/SQL results**: Language-tagged code blocks\n" +
  "  → Quote relevant parts, don't echo the full query\n\n" +
  "**Lists**: Enumerated collections\n" +
  "  → Explain the list, not item-by-item\n\n" +
  "**Objects**: Structured data (configs, schemas)\n" +
  "  → Highlight relevant fields for the user's question\n\n" +
  "**Errors**: Tool execution failures\n" +
  "  → Don't retry automatically; ask user permission or suggest alternatives\n\n" +
  "## Response Structure\n" +
  "Format responses clearly so the UI can parse them well:\n" +
  "- Optionally start with a thinking/planning section (hidden by default in UI)\n" +
  "- Follow with clear answer sections using headers (## Results, ## Orders, etc.)\n" +
  "- Structure helps with PDF export and readability\n\n" +
  "## Orchestration Strategy\n" +
  "You have autonomy to choose your approach. Common patterns emerge naturally:\n\n" +
  "**For data queries**: Fetch semantic guidance → understand schema → execute queries\n" +
  "**For rule questions**: Query the knowledge graph to understand business logic\n" +
  "**For diagnoses**: Combine rules + actual data to correlate findings\n\n" +
  "Choose tool order based on what's needed, not rigid templates. You're smarter than choreography.\n\n" +
  "## Tool Execution Patterns (MANDATORY & OPTIONAL)\n\n" +
  "**MANDATORY FLOW** for any OMS API call:\n" +
  "  refine_api_query_with_schema(step 1 - empty fields) → refine_api_query_with_schema(step 2 - specific fields) → call_oms_api\n" +
  "  This TWO-STEP refinement is critical to avoid token explosion from bloated XML responses.\n\n" +
  "**OPTIONAL** (avoid unless specifically needed):\n" +
  "  - get_api_schema: Raw schema inspection only, not a prerequisite\n\n" +
  "## Tool Cost Profile\n\n" +
  "**FAST TIER** (<100ms):\n" +
  "  - refine_api_query_with_schema (step 1 + step 2): Schema validation, <100ms each\n" +
  "  - get_api_schema (optional): Schema lookup, <100ms\n\n" +
  "**MEDIUM TIER** (300-700ms):\n" +
  "  - call_oms_api: Network call to OMS (can spike to 1-2s under load)\n\n" +
  "**SLOW TIER** (1.9-2.4 seconds):\n" +
  "  - retrieve_skills_tool [BOTTLENECK]: Pinecone search + domain re-ranking\n" +
  "    CRITICAL: Cache this result; never call twice for the same domain in a conversation\n\n" +
  "## Execution Paths by Scenario\n\n" +
  "**Discovery path** (API name unknown):\n" +
  "  retrieve_skills_tool (1.9s) → refine step 1 (0.1s) → refine step 2 (0.1s) → call_oms_api (0.4s) = ~2.5s total\n\n" +
  "**Known API path** (API name known, confident on fields):\n" +
  "  refine step 1 (0.1s) → refine step 2 (0.1s) → call_oms_api (0.4s) = ~0.6s total\n\n" +
  "**CRITICAL RULES** (enforce always):\n" +
  "  - ALWAYS use TWO-STEP refine (never skip step 1 to go straight to step 2)\n" +
  "  - NEVER pre-select all output fields in step 2 (causes bloated template_xml → token explosion)\n" +
  "  - ALWAYS check status='valid' before passing XML to call_oms_api\n" +
  "  - NEVER use get_api_schema as a substitute for refine step 1\n";

// Removed pre-loop intent detection — let tool selection reveal intent naturally
// This eliminates latency, reduces coupling, and lets the agent be autonomous

export async function POST(req: Request) {
  let body: any;
  const contentType = req.headers.get("content-type");

  try {
    if (!contentType?.includes("application/json")) {
      console.error("[Chat API] Invalid content type:", contentType);
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const text = await req.text();
    if (!text) {
      console.error("[Chat API] Empty request body");
      return new Response(JSON.stringify({ error: "Request body cannot be empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    body = JSON.parse(text);
  } catch (e) {
    console.error("[Chat API] Failed to parse request body:", e);
    return new Response(JSON.stringify({ error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    console.error("[Chat API] Missing or invalid messages array");
    return new Response(JSON.stringify({ error: "messages array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = body as ChatRequest;
  const encoder = new TextEncoder();
  const { signal } = req;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => send(controller, event, encoder);
      const tick = makeTimer();
      const requestStartTime = Date.now();

      const requestId = crypto.randomUUID?.() || Date.now().toString();

      console.log(`[OMS Q&A] ── request start (turns: ${messages.length}) ──`);

      // Generate request ID for logging (accessible in catch block)
      const logEventId = Math.random().toString(36).substring(2, 11);
      const logEvent = (event: string, data?: Record<string, unknown>) => {
        console.log(JSON.stringify({
          requestId: logEventId,
          timestamp: new Date().toISOString(),
          event,
          ...data
        }));
      };

      let loopIteration = 0;
      const loopStartTimeRef = { value: 0 };
      try {
        loopStartTimeRef.value = performance.now();

        // Retry once if the cached client is stale (e.g. MCP server restarted)
        let mcp = await getMCPClient();
        let mcpTools: Awaited<ReturnType<typeof mcp.listTools>>["tools"];
        try {
          ({ tools: mcpTools } = await mcp.listTools());
        } catch {
          await resetMCPClient();
          mcp = await getMCPClient();
          ({ tools: mcpTools } = await mcp.listTools());
        }
        tick(`MCP ready + tools listed (${mcpTools.length})`);
        const anthropicTools: Tool[] = mcpTools.map(mcpToolToAnthropic);

        // Use static system prompt — intent detection happens through tool selection, not pre-analysis
        const systemBlocks = [
          { type: "text" as const, text: BASE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
        ];
        tick("System prompt loaded");

        // Cache tool definitions — mark the last tool so Anthropic caches the whole tools array
        const cachedTools: Tool[] = anthropicTools.length > 0
          ? [
              ...anthropicTools.slice(0, -1),
              { ...anthropicTools[anthropicTools.length - 1], cache_control: { type: "ephemeral" as const } },
            ]
          : anthropicTools;

        // Cache conversation history — mark the second-to-last message so everything before
        // the current user input is cached and reused across turns in the same thread
        const anthropicMessages: MessageParam[] = messages.map((m, i) => {
          const isHistoryBoundary = i === messages.length - 2 && messages.length > 1;
          if (isHistoryBoundary && typeof m.content === "string" && m.content.trim().length > 0) {
            return {
              role: m.role,
              content: [{ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }],
            };
          }
          return { role: m.role, content: m.content };
        });

        // Loop control: prevent runaway loops and wasted tokens
        const MAX_ITERATIONS = 15;
        const MAX_TOTAL_OUTPUT_TOKENS = 96000; // Safeguard: stop if we generate too much text
        const REQUEST_TIMEOUT_MS = 300_000; // 5 minutes (matches Next.js maxDuration)
        let totalOutputTokens = 0;

        // Log request start
        logEvent("request_start", {
          messageCount: messages.length,
          modelUsed: MODEL
        });

        // Agentic loop — runs until Claude stops requesting tool use or iteration limit hit
        while (true) {
          loopIteration++;
          if (signal.aborted) break;

          // Hard stop: request timeout exceeded (5 minutes)
          const elapsedMs = performance.now() - loopStartTimeRef.value;
          if (elapsedMs > REQUEST_TIMEOUT_MS) {
            logEvent("timeout_exceeded", { elapsedMs, loopIteration });
            emit({
              type: "error",
              message: "Request timeout exceeded (5 minutes). Agentic loop terminated."
            });
            emit({ type: "message_stop" });
            break;
          }

          // Soft warning: approaching request timeout (80% = 4 minutes)
          if (elapsedMs > REQUEST_TIMEOUT_MS * 0.8 && loopIteration % 5 === 0) {
            console.warn(`[OMS Q&A] Approaching request timeout (${Math.round(elapsedMs / 1000)}s elapsed)`);
            emit({
              type: "text_delta",
              delta: "\n⏱️ Approaching timeout (4+ minutes elapsed). Wrapping up...\n"
            });
          }

          // Hard stop: too many iterations
          if (loopIteration > MAX_ITERATIONS) {
            console.warn(`[OMS Q&A] Loop limit (${MAX_ITERATIONS}) reached. Stopping.`);
            emit({
              type: "text_delta",
              delta: `\n\n> ⚠️ **Loop limit reached** — completed ${MAX_ITERATIONS} iterations. This query may be too complex or the agent may be in a loop. Try rephrasing your question.`,
            });
            emit({ type: "message_stop" });
            break;
          }

          // Soft warning: approaching token limit
          if (totalOutputTokens > MAX_TOTAL_OUTPUT_TOKENS * 0.8) {
            console.warn(`[OMS Q&A] Approaching output token limit (${totalOutputTokens}/${MAX_TOTAL_OUTPUT_TOKENS}).`);
          }

          // Hard stop: too many output tokens (runaway response)
          if (totalOutputTokens > MAX_TOTAL_OUTPUT_TOKENS) {
            console.warn(`[OMS Q&A] Output token limit exceeded. Stopping.`);
            emit({
              type: "text_delta",
              delta: `\n\n> ⚠️ **Response too long** — exceeded token limits. The query may be generating excessive output.`,
            });
            emit({ type: "message_stop" });
            break;
          }

          const apiCallStartTime = performance.now();
          const streamResponse = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            tools: cachedTools,
            system: systemBlocks,
            messages: anthropicMessages,
          }, { signal });

          // Track tool input buffers keyed by tool use block ID
          const toolInputBuffers = new Map<string, string>();
          const toolNames = new Map<string, string>();
          const toolUseBlockIds: string[] = [];

          for await (const event of streamResponse) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                const { id, name } = event.content_block;
                toolInputBuffers.set(id, "");
                toolNames.set(id, name);
                toolUseBlockIds.push(id);
                // Emit immediately so the UI shows the tool name while input streams in
                emit({ type: "tool_start", toolCallId: id, toolName: name, input: {} });
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                emit({ type: "text_delta", delta: event.delta.text });
              } else if (event.delta.type === "input_json_delta") {
                const blockId = toolUseBlockIds[toolUseBlockIds.length - 1];
                if (blockId) {
                  toolInputBuffers.set(blockId, (toolInputBuffers.get(blockId) ?? "") + event.delta.partial_json);
                }
              }
            }
          }

          const finalMessage = await streamResponse.finalMessage();
          const apiCallDuration = performance.now() - apiCallStartTime;
          tick(`Anthropic stream done (loop ${loopIteration})`);

          // Cache visibility — log token usage breakdown after every API call
          const u = finalMessage.usage;
          totalOutputTokens += u.output_tokens;
          console.log(
            `[OMS Q&A] loop ${loopIteration} | cache: ${(u.cache_read_input_tokens ?? 0).toString().padStart(5)} tok read` +
            `  in: ${u.input_tokens.toString().padStart(5)} tok  out: ${u.output_tokens.toString().padStart(5)} tok` +
            `  total_out: ${totalOutputTokens.toString().padStart(6)} tok`
          );

          // Send API call trace to LangSmith
          // Claude Haiku pricing: $0.80 per 1M input tokens, $4.00 per 1M output tokens
          const inputCost = (u.input_tokens / 1_000_000) * 0.80;
          const outputCost = (u.output_tokens / 1_000_000) * 4.00;
          const totalCost = inputCost + outputCost;

          // Extract text response from the final message
          const responseText = finalMessage.content
            .filter((block) => block.type === "text")
            .map((block) => (block as { type: "text"; text: string }).text)
            .join("\n");

          await tracer.logSpan({
            name: `Claude API Call (Loop ${loopIteration})`,
            runType: "llm",
            inputs: {
              model: MODEL,
              maxTokens: 16000,
              messageCount: anthropicMessages.length,
              hasTools: cachedTools.length > 0,
              // Include FULL system prompt (untruncated)
              systemPrompt: systemBlocks[0]?.text || "",
              // Include FULL conversation history
              messages: anthropicMessages.map((m) => ({
                role: m.role,
                content: typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.map((c: any) => c.text || JSON.stringify(c)).join("\n") : JSON.stringify(m.content)),
              })),
              // Tool definitions for context
              toolsProvided: cachedTools.map((t) => ({ name: t.name, description: t.description?.substring(0, 100) })),
            },
            outputs: {
              stopReason: finalMessage.stop_reason,
              model_name: "claude-haiku-4-5",
              // Full response text (untruncated for inspection)
              response: responseText,
              // Full content blocks for debugging
              contentBlocks: finalMessage.content.map((block) => {
                if (block.type === "text") {
                  return { type: "text", text: block.text };
                } else if (block.type === "tool_use") {
                  return { type: "tool_use", id: block.id, name: block.name, input: block.input };
                }
                return { type: block.type };
              }),
              // Token counts for cost calculation & cache analysis
              token_counts: {
                input_tokens: u.input_tokens,
                output_tokens: u.output_tokens,
                cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
                cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
              },
              // Explicit cost in USD
              cost_usd: totalCost,
              // Prompt efficiency metric
              cacheHitRate: u.cache_read_input_tokens ? (u.cache_read_input_tokens / (u.cache_read_input_tokens + u.input_tokens) * 100).toFixed(1) + "%" : "0%",
            },
            durationMs: Math.round(apiCallDuration),
          });

          const hasToolUse = finalMessage.content.some((b) => b.type === "tool_use");
          const toolsCalledThisIteration = finalMessage.content.filter((b) => b.type === "tool_use").length;

          if (finalMessage.stop_reason === "max_tokens" && !hasToolUse) {
            // Response was cut off before any tool calls were emitted — surface a clear warning
            emit({
              type: "text_delta",
              delta: "\n\n> ⚠️ **Response truncated** — the model ran out of output tokens before completing. Try breaking your request into smaller steps.",
            });
            emit({ type: "message_stop" });
            break;
          }

          if (finalMessage.stop_reason !== "tool_use" && !hasToolUse) {
            // Natural end: agent decided to stop and provide final answer
            emit({ type: "message_stop" });
            break;
          }

          // Convergence check: if agent called no tools but is still in "tool_use" mode, it's confused
          if (finalMessage.stop_reason === "tool_use" && toolsCalledThisIteration === 0) {
            console.warn(`[OMS Q&A] Loop ${loopIteration}: stop_reason=tool_use but no tools actually called. Agent may be confused.`);
            // Still try to add tool results for next iteration, but be ready to exit if this repeats
            if (loopIteration >= 3) {
              emit({
                type: "text_delta",
                delta: `\n\n> ⚠️ **Stuck in loop** — agent isn't making progress after ${loopIteration} iterations. Try rephrasing your question.`,
              });
              emit({ type: "message_stop" });
              break;
            }
          }

          // stop_reason is "tool_use", or "max_tokens" with completed tool blocks — execute them

          if (signal.aborted) break;

          // Execute all tool use blocks
          const toolResults: ToolResultBlockParam[] = [];

          for (const block of finalMessage.content as ContentBlock[]) {
            if (block.type !== "tool_use") continue;
            if (signal.aborted) break;
            const toolBlock = block as ToolUseBlock;

            // tool_start was already emitted during streaming; send resolved input now
            emit({
              type: "tool_input",
              toolCallId: toolBlock.id,
              input: toolBlock.input as Record<string, unknown>,
            });

            const toolStartTime = performance.now();
            try {
              const result = await traceToolCall(
                toolBlock.name,
                toolBlock.input as Record<string, unknown>,
                () => mcp.callTool({
                  name: toolBlock.name,
                  arguments: toolBlock.input as Record<string, unknown>,
                }),
                {
                  loopIteration,
                  toolCallId: toolBlock.id,
                  requestId,
                }
              );

              // Post-process: if read_skill_file returned >25KB of content, truncate and warn
              if (toolBlock.name === "read_skill_file") {
                const output = JSON.stringify(result.content || result);
                const sizeKB = output.length / 1024;
                if (sizeKB > 25) {
                  const truncated = output.substring(0, 25 * 1024);
                  console.log(`[OMS Q&A] File too large (${sizeKB.toFixed(0)}KB) — truncated to 25KB. Use read_skill_section for large files.`);
                  result.content = [
                    {
                      type: "text",
                      text: truncated + `\n\n[FILE TRUNCATED: ${sizeKB.toFixed(0)}KB is too large. Use read_skill_section with a specific query to extract relevant sections only.]`,
                    },
                  ];
                }
              }
              const toolDuration = performance.now() - toolStartTime;

              // Structure the tool result to preserve semantics
              const structuredResult = structureToolResult(
                toolBlock.name,
                result.content || result,
                { executionTimeMs: Math.round(toolDuration) }
              );

              // Format for agent comprehension
              const agentReadableOutput = formatForAgent(structuredResult);

              tick(`Tool: ${toolBlock.name}`);
              emit({
                type: "tool_end",
                toolCallId: toolBlock.id,
                output: agentReadableOutput,
                structured: structuredResult as unknown as Record<string, unknown>
              });

              // Log tool execution
              logEvent("tool_call", {
                toolName: toolBlock.name,
                toolCallId: toolBlock.id,
                durationMs: Math.round(toolDuration),
                iterationNumber: loopIteration,
                inputSize: JSON.stringify(toolBlock.input).length
              });

              // Send tool call trace to LangSmith
              await tracer.logSpan({
                name: `Tool: ${toolBlock.name}`,
                runType: "tool",
                inputs: toolBlock.input as Record<string, unknown>,
                outputs: {
                  result: result.content,
                  structured: structuredResult,
                },
                durationMs: Math.round(toolDuration),
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: agentReadableOutput,
              });
            } catch (toolErr) {
              const toolDuration = performance.now() - toolStartTime;
              const error = toolErr instanceof Error ? toolErr.message : String(toolErr);
              tick(`Tool error: ${toolBlock.name}`);
              emit({ type: "tool_error", toolCallId: toolBlock.id, error });

              // Send error trace to LangSmith
              await tracer.logSpan({
                name: `Tool: ${toolBlock.name}`,
                runType: "tool",
                inputs: toolBlock.input as Record<string, unknown>,
                error,
                durationMs: Math.round(toolDuration),
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: `Error: ${error}`,
                is_error: true,
              });
            }
          }

          // Append assistant turn + tool results, then loop
          anthropicMessages.push({ role: "assistant", content: finalMessage.content });
          anthropicMessages.push({ role: "user", content: toolResults });
        }

        const totalDuration = performance.now() - loopStartTimeRef.value;
        logEvent("request_end", {
          status: "complete",
          iterationsUsed: loopIteration,
          totalOutputTokens,
          durationMs: Math.round(totalDuration)
        });

        tick(`Request complete (${loopIteration} loop iteration${loopIteration === 1 ? "" : "s"})`);
      } catch (err) {
        if (signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          // Client cancelled — no error to emit
          logEvent("request_end", { status: "cancelled", iterationsUsed: loopIteration });
        } else {
          const message = err instanceof Error ? err.message : "An unexpected error occurred";
          // Only reset MCP for transport/connection faults, not Anthropic API errors (4xx).
          // Resetting on a 400 tears down a healthy MCP connection and forces a slow reconnect.
          const isAnthropicApiError = message.includes("invalid_request_error") ||
            message.includes("authentication_error") ||
            message.includes("not_found_error") ||
            (err as { status?: number }).status !== undefined;
          if (!isAnthropicApiError) await resetMCPClient();

          // Log error
          logEvent("request_error", {
            errorMessage: message,
            iterationsUsed: loopIteration,
            durationMs: Math.round(performance.now() - loopStartTimeRef.value)
          });

          // Log error to LangSmith for tracing
          await tracer.logSpan({
            name: "Request Error",
            runType: "chain",
            error: message,
            inputs: {
              loopIteration,
              requestId,
            },
            durationMs: Date.now() - requestStartTime,
          }).catch(() => {
            // Silently fail if LangSmith logging fails
          });

          emit({ type: "error", message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
