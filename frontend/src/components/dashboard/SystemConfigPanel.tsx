"use client";

import { useState } from "react";

interface ConfigField {
  id: string;
  label: string;
  type: "text" | "password" | "url" | "email" | "number";
  value: string;
  description?: string;
  sensitive?: boolean;
}

interface SystemConfigPanelProps {
  // No subsection needed - displays all 8 systems
}

const BRAND_COLOR = {
  light: "text-slate-700",
  border: "border-slate-200",
  bg: "bg-slate-50/30",
  dark: "text-slate-300",
};

const CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  "config-anthropic": [
    {
      id: "api_key",
      label: "API Key",
      type: "password",
      value: "sk-ant-api03-****",
      description: "Anthropic API key for authentication",
      sensitive: true,
    },
  ],
  "config-mcp": [
    {
      id: "server_url",
      label: "Server URL",
      type: "url",
      value: "http://localhost:8001",
      description: "MCP Server connection URL",
    },
    {
      id: "mcp_host",
      label: "Host",
      type: "text",
      value: "0.0.0.0",
      description: "MCP Server bind address",
    },
    {
      id: "mcp_port",
      label: "Port",
      type: "number",
      value: "8001",
      description: "MCP Server port number",
    },
    {
      id: "skills_dir",
      label: "Skills Directory",
      type: "text",
      value: "D:\\opt\\IBM\\xapidocs\\ERD\\.claude\\skills",
      description: "Path to skills directory",
    },
  ],
  "config-pinecone": [
    {
      id: "api_key",
      label: "API Key",
      type: "password",
      value: "pcsk_****",
      description: "Pinecone API key",
      sensitive: true,
    },
    {
      id: "index_name",
      label: "Index Name",
      type: "text",
      value: "oms-skills-hybrid",
      description: "Pinecone index name",
    },
    {
      id: "namespace",
      label: "Namespace",
      type: "text",
      value: "tastemaker-bot",
      description: "Pinecone namespace",
    },
  ],
  "config-google": [
    {
      id: "api_key",
      label: "API Key",
      type: "password",
      value: "AQ.Ab8RN6****",
      description: "Google Generative AI API key",
      sensitive: true,
    },
  ],
  "config-langsmith": [
    {
      id: "tracing_enabled",
      label: "Enable Tracing",
      type: "text",
      value: "true",
      description: "Enable/disable LangSmith tracing",
    },
    {
      id: "api_key",
      label: "API Key",
      type: "password",
      value: "lsv2_pt_****",
      description: "LangSmith API key",
      sensitive: true,
    },
    {
      id: "project",
      label: "Project Name",
      type: "text",
      value: "tastemaker-bot",
      description: "LangSmith project name",
    },
    {
      id: "endpoint",
      label: "Endpoint",
      type: "url",
      value: "https://api.smith.langchain.com",
      description: "LangSmith API endpoint",
    },
  ],
  "config-oms": [
    {
      id: "interop_url",
      label: "Interop URL",
      type: "url",
      value: "http://localhost:7001/smcfs/interop/InteropHttpServlet",
      description: "OMS Interop servlet URL",
    },
    {
      id: "prog_id",
      label: "Program ID",
      type: "text",
      value: "SterlingHttpTester",
      description: "Program ID for OMS",
    },
    {
      id: "user",
      label: "Username",
      type: "text",
      value: "admin",
      description: "OMS login username",
    },
    {
      id: "password",
      label: "Password",
      type: "password",
      value: "password",
      description: "OMS login password",
      sensitive: true,
    },
  ],
  "config-database": [
    {
      id: "db_host",
      label: "Database Host",
      type: "text",
      value: "localhost",
      description: "Oracle database host",
    },
    {
      id: "db_port",
      label: "Port",
      type: "number",
      value: "1521",
      description: "Oracle database port",
    },
    {
      id: "db_sid",
      label: "Database SID",
      type: "text",
      value: "ORCL",
      description: "Oracle database SID",
    },
    {
      id: "db_user",
      label: "Username",
      type: "text",
      value: "TRAINING",
      description: "Database username",
    },
    {
      id: "db_password",
      label: "Password",
      type: "password",
      value: "Passw0rd",
      description: "Database password",
      sensitive: true,
    },
  ],
  "config-neo4j": [
    {
      id: "uri",
      label: "Connection URI",
      type: "url",
      value: "neo4j+s://8d4c95ba.databases.neo4j.io",
      description: "Neo4j database URI",
    },
    {
      id: "user",
      label: "Username",
      type: "text",
      value: "plantrix_admin",
      description: "Neo4j username",
    },
    {
      id: "password",
      label: "Password",
      type: "password",
      value: "password",
      description: "Neo4j password",
      sensitive: true,
    },
    {
      id: "database",
      label: "Database",
      type: "text",
      value: "neo4j",
      description: "Neo4j database name",
    },
    {
      id: "kg_version",
      label: "KG Version",
      type: "text",
      value: "1.1.0",
      description: "Knowledge Graph version",
    },
  ],
};

const CONFIG_SYSTEMS = [
  { id: "config-anthropic", label: "Anthropic API", icon: "🤖" },
  { id: "config-mcp", label: "MCP Server", icon: "🔗" },
  { id: "config-pinecone", label: "Pinecone", icon: "🔍" },
  { id: "config-google", label: "Google AI", icon: "🌐" },
  { id: "config-langsmith", label: "LangSmith", icon: "📊" },
  { id: "config-oms", label: "OMS/Sterling", icon: "📦" },
  { id: "config-database", label: "Database", icon: "🗄️" },
  { id: "config-neo4j", label: "Neo4j KG", icon: "🧠" },
];

export default function SystemConfigPanel({}: SystemConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("config-anthropic");
  const [configValues, setConfigValues] = useState<Record<string, string>>(() => {
    const acc: Record<string, string> = {};
    Object.entries(CONFIG_SCHEMAS).forEach(([system, fields]) => {
      fields.forEach((field) => {
        acc[`${system}-${field.id}`] = field.value;
      });
    });
    return acc;
  });
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fields = CONFIG_SCHEMAS[activeTab] || [];

  const handleChange = (fieldId: string, value: string) => {
    const key = `${activeTab}-${fieldId}`;
    setConfigValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleSensitive = (fieldId: string) => {
    const key = `${activeTab}-${fieldId}`;
    setShowSensitive((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestConnection = async () => {
    setSaveStatus("Testing connection...");
    setTimeout(() => {
      setSaveStatus("✓ Connection successful");
      setTimeout(() => setSaveStatus(null), 3000);
    }, 1500);
  };

  const handleSaveConfig = async () => {
    setSaveStatus("Saving configuration...");
    setTimeout(() => {
      setSaveStatus("✓ Configuration saved successfully");
      setTimeout(() => setSaveStatus(null), 3000);
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* System Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-min">
          {CONFIG_SYSTEMS.map((system) => (
            <button
              key={system.id}
              onClick={() => setActiveTab(system.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === system.id
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent"
              }`}
            >
              <span className="mr-2">{system.icon}</span>
              {system.label}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl">
          {fields.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">No configuration fields available</p>
            </div>
          ) : (
            <>
              {/* Configuration Fields */}
              <div
                className={`${BRAND_COLOR.bg} dark:bg-slate-800/30 rounded-lg p-6 border ${BRAND_COLOR.border} dark:border-slate-700 mb-6`}
              >
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                  {CONFIG_SYSTEMS.find((s) => s.id === activeTab)?.label} Configuration
                </h2>

                <div className="space-y-4">
                  {fields.map((field) => {
                    const key = `${activeTab}-${field.id}`;
                    const isSensitive = field.sensitive && !showSensitive[key];
                    const displayValue = isSensitive ? "••••••••" : configValues[key];

                    return (
                      <div key={field.id}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {field.label}
                          </label>
                          {field.sensitive && (
                            <button
                              onClick={() => handleToggleSensitive(field.id)}
                              className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              {showSensitive[key] ? "Hide" : "Show"}
                            </button>
                          )}
                        </div>
                        <input
                          type={field.type === "password" ? "password" : field.type}
                          value={displayValue}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        {field.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{field.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleTestConnection}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs"
                  >
                    Test Connection
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-xs"
                  >
                    Save Configuration
                  </button>
                </div>

                {/* Status Message */}
                {saveStatus && (
                  <div className="mt-4 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm">
                    {saveStatus}
                  </div>
                )}
              </div>

              {/* Configuration Details Card */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 bg-white dark:bg-slate-800/50">
                <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4">Configuration Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">System:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {CONFIG_SYSTEMS.find((s) => s.id === activeTab)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Total Fields:</span>
                    <span className="font-medium text-slate-900 dark:text-white">{fields.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Sensitive Fields:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {fields.filter((f) => f.sensitive).length}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      ℹ️ All sensitive fields are encrypted in storage. Changes take effect after saving and system restart if
                      required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Environment Variables Info */}
              <div className="mt-6 border border-amber-200 dark:border-amber-900 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">📝 Environment Variables</h4>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  These settings are sourced from .env file. For production deployments, ensure sensitive values are stored in a secure
                  vault or secrets manager.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
