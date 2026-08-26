"""Sterling OMS Interop HTTP Servlet tool."""
import os
import httpx
import logging

logger = logging.getLogger(__name__)

_INTEROP_URL = os.getenv("OMS_INTEROP_URL", "http://localhost:7001/smcfs/interop/InteropHttpServlet")
_PROG_ID = os.getenv("OMS_PROG_ID", "SterlingHttpTester")
_USER = os.getenv("OMS_USER", "admin")
_PASSWORD = os.getenv("OMS_PASSWORD", "password")


def register_sterling_tools(mcp):
    """Register Sterling OMS API execution tool."""

    @mcp.tool()
    def call_oms_api(
        api_name: str,
        input_xml: str,
        template_xml: str = "",
        is_flow: bool = False,
        service_name: str = "",
    ) -> dict:
        """Execute a Sterling OMS API call via the Interop HTTP Servlet.

        ## WHEN TO USE
        Use this tool to:
        - Execute a Sterling API and retrieve real data from the OMS system
        - Pass validated input parameters and output template
        - Get structured XML response with requested fields

        This is the FINAL EXECUTION STEP after schema validation.

        ## PRECONDITIONS ⚠️
        REQUIRED: Both inputs must come from refine_api_query_with_schema:
        - input_xml: Must be validated XML (from refine_api_query_with_schema step 2)
        - template_xml: Must be the filtered XML template (from refine_api_query_with_schema step 2)

        INVALID: Calling without prior refinement ❌
        - Passing raw XML without schema validation
        - Missing input_xml or template_xml
        - Calling with incorrect field names (should have been caught by refine)

        ## WHAT YOU'RE ASKING
        "Execute this API with these inputs and return these fields"

        ## WHAT YOU'LL GET
        - status_code: 200 (success) or error code
        - response_xml: Structured XML response from the OMS system
        - error: Error message if the call failed

        ## SUCCESS SIGNAL ✓
        "status_code": 200 AND "response_xml" contains data
        Example: <OrderList><Order OrderNo="Y123456789" Status="1300" .../></OrderList>

        ## FAILURE MODES ❌
        1. Network error (status_code: null)
           → Fallback: Verify OMS_INTEROP_URL is reachable; retry after 2s
           → Retryable: Yes, usually temporary

        2. API validation error (status_code: 400, response_xml contains error details)
           → Fallback: Review input_xml for validation violations
           → Check that all required filter fields have values
           → Retryable: Maybe (fix input and retry)

        3. Invalid field in template_xml (status_code: 400)
           → Fallback: Call refine_api_query_with_schema again with corrected fields
           → Retryable: Yes (after fixing fields)

        4. Timeout (status_code: null, error: "timeout")
           → Fallback: Try simpler query (fewer output fields, tighter filters)
           → Retryable: Yes, after simplification

        ## COST PROFILE
        - Latency: 300-700ms (network call to OMS, can spike to 1-2s under load)
        - Tokens: 500-5000+ (depends on response size; large result sets are truncated)
        - Use once per query: expensive but necessary; don't call twice
        - OPTIMIZATION: If you already have the result, summarize don't re-call

        ## DEPENDENCIES & ORDERING
        MUST be preceded by: refine_api_query_with_schema (to get validated input_xml + template_xml)
        Can follow: get_api_schema (for field discovery) or directly from refine if cached
        ALWAYS LAST: This is execution; comes after all validation

        ## VALID SEQUENCES
        ✓ retrieve_skills → refine (step 1+2) → call_oms_api → response
        ✓ refine (step 1+2) → call_oms_api → response (if API name known)
        ✓ call_oms_api with cached input_xml + template_xml (re-execute)

        ## INVALID SEQUENCES
        ❌ call_oms_api alone (missing validated XML)
        ❌ retrieve_skills → call_oms_api (skipped refinement/validation)
        ❌ Multiple calls with same parameters (wasted tokens if result hasn't changed)

        Args:
            api_name: Sterling API name (e.g. "getOrderList", "createOrder")
            input_xml: Validated XML input document (from refine_api_query_with_schema)
                       e.g. '<Order EnterpriseCode="Aurora" ItemIDQryType="EQ" ItemID="ABC123" />'
            template_xml: Filtered XML template specifying output fields (from refine_api_query_with_schema)
                          e.g. '<Order><OrderHeader OrderNo="" Status=""/></Order>'
            is_flow: Set True to invoke a YFS flow instead of a direct API
            service_name: Service name — required when is_flow is True

        Returns:
            {
              "status_code": 200 | 400 | null,
              "response_xml": "<Order><OrderList>...</OrderList></Order>",
              "error": null | "error message"
            }
        """
        logger.info(f"[Sterling] Calling API: {api_name}")

        # Strip CDATA wrappers if present (agent may wrap XML in CDATA)
        def strip_cdata(xml_str):
            if xml_str.startswith("<![CDATA[") and xml_str.endswith("]]>"):
                return xml_str[9:-3]  # Remove <![CDATA[ and ]]>
            return xml_str

        clean_input_xml = strip_cdata(input_xml)
        clean_template_xml = strip_cdata(template_xml)

        payload = {
            "YFSEnvironment.progId": _PROG_ID,
            "YFSEnvironment.userId": _USER,
            "YFSEnvironment.password": _PASSWORD,
            "ApiName": api_name,
            "InteropApiName": api_name,
            "IsFlow": "Y" if is_flow else "N",
            "InteropApiData": clean_input_xml,
            "TemplateData": clean_template_xml,
        }

        if service_name:
            payload["ServiceName"] = service_name

        try:
            logger.debug(f"[Sterling] POST to {_INTEROP_URL}")
            resp = httpx.post(_INTEROP_URL, data=payload, timeout=30.0)
            logger.info(f"[Sterling] Response status: {resp.status_code}")

            return {
                "status_code": resp.status_code,
                "response_xml": resp.text,
                "error": None,
            }
        except httpx.RequestError as exc:
            logger.error(f"[Sterling] Request failed: {exc}")
            return {
                "status_code": None,
                "response_xml": "",
                "error": str(exc),
            }

    logger.info("[Sterling] Tool registered: call_oms_api")
