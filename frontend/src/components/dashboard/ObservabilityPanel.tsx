"use client";

import { useState } from "react";

interface ObservabilityPanelProps {
  // No props needed - displays all 4 observability functions in tabs
}

const BRAND_COLOR = {
  light: "text-slate-700",
  border: "border-slate-200",
  bg: "bg-slate-50/30",
  dark: "text-slate-300",
};

const OBS_TABS = [
  { id: "tracing", label: "Tracing", icon: "🔍" },
  { id: "monitoring", label: "Monitoring", icon: "📊" },
  { id: "evals", label: "Evals", icon: "✓" },
  { id: "datasets", label: "Datasets & Experiments", icon: "📚" },
];

interface EvalMetrics {
  id: string;
  model: string;
  precision: number;
  recall: number;
  f1Score: number;
  timestamp: string;
}

interface Dataset {
  id: string;
  name: string;
  type: "golden" | "test" | "validation";
  totalRecords: number;
  experiment: string;
  status: "active" | "completed" | "in-progress";
  accuracy: number;
}

export default function ObservabilityPanel({}: ObservabilityPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("tracing");

  // Evals state
  const [evalMetrics, setEvalMetrics] = useState<EvalMetrics[]>([
    {
      id: "1",
      model: "Claude 3 Opus",
      precision: 0.945,
      recall: 0.928,
      f1Score: 0.936,
      timestamp: "2026-07-17 14:32:00",
    },
    {
      id: "2",
      model: "Claude 3 Sonnet",
      precision: 0.923,
      recall: 0.915,
      f1Score: 0.919,
      timestamp: "2026-07-17 13:15:00",
    },
    {
      id: "3",
      model: "Claude 3 Haiku",
      precision: 0.892,
      recall: 0.885,
      f1Score: 0.888,
      timestamp: "2026-07-17 12:00:00",
    },
  ]);

  // Datasets state
  const [datasets, setDatasets] = useState<Dataset[]>([
    {
      id: "1",
      name: "OMS Order Processing - Golden Set v1",
      type: "golden",
      totalRecords: 1250,
      experiment: "Order Status Identification",
      status: "active",
      accuracy: 0.945,
    },
    {
      id: "2",
      name: "Inventory Availability - Test Set",
      type: "test",
      totalRecords: 890,
      experiment: "ATP (Available-to-Promise) Queries",
      status: "completed",
      accuracy: 0.928,
    },
    {
      id: "3",
      name: "Shipment Tracking - Validation Set",
      type: "validation",
      totalRecords: 654,
      experiment: "Shipment Status Tracking",
      status: "in-progress",
      accuracy: 0.912,
    },
    {
      id: "4",
      name: "Exception Handling - Golden Set v2",
      type: "golden",
      totalRecords: 1875,
      experiment: "Exception Resolution & Reprocessing",
      status: "active",
      accuracy: 0.956,
    },
  ]);

  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  const alerts = [
    {
      id: "1",
      title: "High Latency Detected",
      severity: "high",
      message: "API response time exceeded 2s threshold",
      timestamp: "2 minutes ago",
      source: "MCP Server",
    },
    {
      id: "2",
      title: "Model Performance Degradation",
      severity: "medium",
      message: "Precision dropped to 0.87, expected > 0.90",
      timestamp: "15 minutes ago",
      source: "Eval Pipeline",
    },
    {
      id: "3",
      title: "Database Connection Slow",
      severity: "medium",
      message: "Oracle DB query time > 5s",
      timestamp: "1 hour ago",
      source: "Database Monitor",
    },
  ];

  const dashboards = [
    {
      id: "1",
      title: "API Latency",
      metric: "245ms",
      status: "good",
      trend: "↓ 12%",
    },
    { id: "2", title: "Error Rate", metric: "0.2%", status: "good", trend: "↓ 5%" },
    {
      id: "3",
      title: "Token Usage",
      metric: "2.4M/10M",
      status: "good",
      trend: "↑ 8%",
    },
    {
      id: "4",
      title: "Model Availability",
      metric: "99.98%",
      status: "good",
      trend: "↔ 0%",
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-min">
          {OBS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl">
          {/* Tracing Tab */}
          {activeTab === "tracing" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">LangSmith Project Tracing</h2>

              <div className={`${BRAND_COLOR.bg} dark:bg-slate-800/30 rounded-lg p-8 border ${BRAND_COLOR.border} dark:border-slate-700 mb-6`}>
                <div className="text-center">
                  <p className="text-slate-600 dark:text-slate-400 mb-4">Embedded LangSmith Tracing</p>
                  <div className="bg-white dark:bg-slate-900/50 rounded-lg p-12 border-2 border-dashed border-slate-300 dark:border-slate-600">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">LangSmith Tracing Dashboard</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      Project: tastemaker-bot
                      <br />
                      Base URL: https://smith.langchain.com/o/{"{org_id}"}/projects/p/{"{project_id}"}
                    </p>
                    <a
                      href="#"
                      className="inline-block mt-4 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Open LangSmith Dashboard
                    </a>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-6">
                    ℹ️ Traces are collected in real-time from all API calls. View detailed request/response logs and performance metrics.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">Latest Traces</h3>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="text-xs px-2 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        trace_{String(i).padStart(6, "0")} • 234ms ago
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">Trace Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Traces:</span>
                      <span className="font-medium text-slate-900 dark:text-white">15,847</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Avg Duration:</span>
                      <span className="font-medium text-slate-900 dark:text-white">245ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Error Rate:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">0.2%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monitoring Tab */}
          {activeTab === "monitoring" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Monitoring & Alerts</h2>

              {/* Dashboards */}
              <div className="mb-8">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">Key Dashboards</h3>
                <div className="grid grid-cols-2 gap-4">
                  {dashboards.map((dash) => (
                    <div
                      key={dash.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-slate-900 dark:text-white text-sm">{dash.title}</h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            dash.status === "good"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          ● {dash.status}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{dash.metric}</p>
                      <p className={`text-xs ${dash.trend.startsWith("↓") ? "text-green-600" : "text-slate-500"}`}>{dash.trend}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerts */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">Active Alerts</h3>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedAlert === alert.id
                          ? "border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-purple-200 dark:hover:border-purple-600"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white">{alert.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{alert.source}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            alert.severity === "high"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      {selectedAlert === alert.id && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{alert.message}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{alert.timestamp}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Evals Tab */}
          {activeTab === "evals" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Model Evaluations</h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">Model</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-900 dark:text-white">Precision</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-900 dark:text-white">Recall</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-900 dark:text-white">F1 Score</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalMetrics.map((metric) => (
                      <tr key={metric.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">{metric.model}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: `${metric.precision * 100}%` }}
                              ></div>
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{(metric.precision * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${metric.recall * 100}%` }}
                              ></div>
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{(metric.recall * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500"
                                style={{ width: `${metric.f1Score * 100}%` }}
                              ></div>
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{(metric.f1Score * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">{metric.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  ℹ️ <strong>Metrics Legend:</strong> Precision = correctly identified positives / all identified positives | Recall = correctly
                  identified positives / all actual positives | F1 Score = harmonic mean of precision & recall
                </p>
              </div>
            </div>
          )}

          {/* Datasets & Experiments Tab */}
          {activeTab === "datasets" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Datasets & Experiments</h2>

              <div className="space-y-4">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{dataset.name}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              dataset.type === "golden"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                : dataset.type === "test"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            }`}
                          >
                            {dataset.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Experiment: {dataset.experiment}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          dataset.status === "active"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            : dataset.status === "completed"
                              ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                        }`}
                      >
                        {dataset.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Records</p>
                        <p className="font-semibold text-slate-900 dark:text-white">{dataset.totalRecords.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
                        <p className="font-semibold text-slate-900 dark:text-white">{(dataset.accuracy * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy Bar</p>
                        <div className="w-full h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                            style={{ width: `${dataset.accuracy * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        View Data
                      </button>
                      <button className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
                        Run Experiment
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>Golden Datasets:</strong> High-quality, manually curated datasets used for evaluation and testing. <strong>Experiments:</strong> Various tests
                  conducted with different dataset configurations to optimize model performance.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
