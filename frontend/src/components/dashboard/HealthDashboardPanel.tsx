"use client";

import { useState } from "react";

interface MetricData {
  standard: number;
  premium: number;
  elite: number;
}

interface ChannelMetrics {
  retail: MetricData;
  b2b: MetricData;
  ecommerce: MetricData;
}

interface DelayedOrdersData extends ChannelMetrics {
  totalDelayed: number;
  totalOrders: number;
}

interface FillRateData {
  retail: { standard: number; premium: number; elite: number };
  b2b: { standard: number; premium: number; elite: number };
  ecommerce: { standard: number; premium: number; elite: number };
}

const HEALTH_TABS = [
  { id: "delayed", label: "Delayed Orders", icon: "⏰" },
  { id: "at-risk", label: "At-Risk Orders", icon: "⚠️" },
  { id: "fill-rate", label: "Fill Rate (48h)", icon: "📈" },
];

export default function HealthDashboardPanel() {
  const [activeTab, setActiveTab] = useState<string>("delayed");

  // Delayed Orders Data
  const delayedOrdersData: DelayedOrdersData = {
    retail: { standard: 147, premium: 23, elite: 5 },
    b2b: { standard: 89, premium: 12, elite: 2 },
    ecommerce: { standard: 234, premium: 45, elite: 8 },
    totalDelayed: 565,
    totalOrders: 12450,
  };

  // At-Risk Orders Data
  const atRiskOrdersData: ChannelMetrics = {
    retail: { standard: 234, premium: 38, elite: 4 },
    b2b: { standard: 156, premium: 22, elite: 1 },
    ecommerce: { standard: 412, premium: 67, elite: 9 },
  };

  // Fill Rate Data (percentages)
  const fillRateData: FillRateData = {
    retail: { standard: 94.2, premium: 97.8, elite: 99.3 },
    b2b: { standard: 92.1, premium: 96.5, elite: 98.9 },
    ecommerce: { standard: 89.7, premium: 95.2, elite: 98.1 },
  };

  // Trend data
  const delayedTrend = { direction: "down", percent: 12 };
  const atRiskTrend = { direction: "up", percent: 5 };
  const fillRateTrend = { direction: "up", percent: 3 };

  const getStatusColor = (metric: number, type: "delayed" | "at-risk" | "fill") => {
    if (type === "delayed") {
      if (metric < 50) return "green";
      if (metric < 150) return "yellow";
      return "red";
    }
    if (type === "at-risk") {
      if (metric < 100) return "green";
      if (metric < 300) return "yellow";
      return "red";
    }
    // fill rate
    if (metric >= 95) return "green";
    if (metric >= 90) return "yellow";
    return "red";
  };

  const getStatusBadge = (color: string) => {
    switch (color) {
      case "green":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "yellow":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
      case "red":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      default:
        return "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
    }
  };

  const renderMetricCard = (
    label: string,
    value: number,
    unit: string,
    status: string,
    trend?: { direction: string; percent: number }
  ) => {
    const statusBadgeClass = getStatusBadge(status);
    const statusText =
      status === "green" ? "Good" : status === "yellow" ? "Warning" : "Critical";

    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadgeClass}`}>
            {statusText}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <span className="text-sm text-slate-600 dark:text-slate-400">{unit}</span>
        </div>
        {trend && (
          <p className={`text-xs font-medium ${trend.direction === "up" ? "text-red-600" : "text-green-600"}`}>
            {trend.direction === "up" ? "↑" : "↓"} {trend.percent}% from last 24h
          </p>
        )}
      </div>
    );
  };

  const renderChannelSection = (
    channelName: string,
    channelKey: "retail" | "b2b" | "ecommerce",
    data: any,
    type: "delayed" | "at-risk" | "fill"
  ) => {
    const channelData = data[channelKey];
    const icon = channelKey === "retail" ? "🏪" : channelKey === "b2b" ? "🤝" : "🌐";

    return (
      <div key={channelKey} className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <span>{icon}</span>
          {channelName}
        </h3>

        <div className="grid grid-cols-3 gap-3">
          {/* Standard */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Standard</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              {type === "fill" ? `${channelData.standard}%` : channelData.standard}
            </p>
            {type === "fill" && (
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500"
                  style={{ width: `${channelData.standard}%` }}
                ></div>
              </div>
            )}
            <p
              className={`text-xs mt-1 font-medium ${getStatusColor(
                channelData.standard,
                type
              ) === "green"
                ? "text-green-600"
                : getStatusColor(channelData.standard, type) === "yellow"
                  ? "text-yellow-600"
                  : "text-red-600"}`}
            >
              {getStatusColor(channelData.standard, type) === "green"
                ? "✓ On track"
                : getStatusColor(channelData.standard, type) === "yellow"
                  ? "⚠ Monitor"
                  : "✗ Critical"}
            </p>
          </div>

          {/* Premium */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Premium</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              {type === "fill" ? `${channelData.premium}%` : channelData.premium}
            </p>
            {type === "fill" && (
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${channelData.premium}%` }}
                ></div>
              </div>
            )}
            <p
              className={`text-xs mt-1 font-medium ${getStatusColor(
                channelData.premium,
                type
              ) === "green"
                ? "text-green-600"
                : getStatusColor(channelData.premium, type) === "yellow"
                  ? "text-yellow-600"
                  : "text-red-600"}`}
            >
              {getStatusColor(channelData.premium, type) === "green"
                ? "✓ On track"
                : getStatusColor(channelData.premium, type) === "yellow"
                  ? "⚠ Monitor"
                  : "✗ Critical"}
            </p>
          </div>

          {/* Elite */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Elite</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              {type === "fill" ? `${channelData.elite}%` : channelData.elite}
            </p>
            {type === "fill" && (
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${channelData.elite}%` }}
                ></div>
              </div>
            )}
            <p
              className={`text-xs mt-1 font-medium ${getStatusColor(
                channelData.elite,
                type
              ) === "green"
                ? "text-green-600"
                : getStatusColor(channelData.elite, type) === "yellow"
                  ? "text-yellow-600"
                  : "text-red-600"}`}
            >
              {getStatusColor(channelData.elite, type) === "green"
                ? "✓ On track"
                : getStatusColor(channelData.elite, type) === "yellow"
                  ? "⚠ Monitor"
                  : "✗ Critical"}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-min">
          {HEALTH_TABS.map((tab) => (
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
        <div className="max-w-6xl">
          {/* Delayed Orders Tab */}
          {activeTab === "delayed" && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Delayed Orders
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Orders delayed beyond promised delivery date
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {renderMetricCard(
                  "Total Delayed",
                  delayedOrdersData.totalDelayed,
                  "orders",
                  getStatusColor(delayedOrdersData.totalDelayed, "delayed"),
                  delayedTrend
                )}
                {renderMetricCard(
                  "Total Orders",
                  delayedOrdersData.totalOrders,
                  "orders",
                  "green"
                )}
                {renderMetricCard(
                  "Delay Rate",
                  Math.round((delayedOrdersData.totalDelayed / delayedOrdersData.totalOrders) * 100 * 10) / 10,
                  "%",
                  "yellow"
                )}
              </div>

              {/* Channel Breakdown */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Delayed Orders by Channel & Service Level
                </h3>
                {renderChannelSection("Retail", "retail", delayedOrdersData, "delayed")}
                {renderChannelSection("B2B", "b2b", delayedOrdersData, "delayed")}
                {renderChannelSection("E-Commerce", "ecommerce", delayedOrdersData, "delayed")}
              </div>
            </>
          )}

          {/* At-Risk Orders Tab */}
          {activeTab === "at-risk" && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  At-Risk Orders
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Orders likely to delay based on current fulfillment status
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {renderMetricCard(
                  "Total At-Risk",
                  (Object.values(atRiskOrdersData) as any[]).reduce(
                    (sum: number, channel: any) => sum + (Object.values(channel) as number[]).reduce((a: number, b: number) => a + b, 0),
                    0
                  ),
                  "orders",
                  getStatusColor(
                    (Object.values(atRiskOrdersData) as any[]).reduce(
                      (sum: number, channel: any) => sum + (Object.values(channel) as number[]).reduce((a: number, b: number) => a + b, 0),
                      0
                    ),
                    "at-risk"
                  ),
                  atRiskTrend
                )}
                {renderMetricCard(
                  "Highest Risk Channel",
                  412,
                  "orders",
                  "red"
                )}
                {renderMetricCard(
                  "Avg Resolution Time",
                  4.2,
                  "hours",
                  "yellow"
                )}
              </div>

              {/* Channel Breakdown */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                  At-Risk Orders by Channel & Service Level
                </h3>
                {renderChannelSection("Retail", "retail", atRiskOrdersData, "at-risk")}
                {renderChannelSection("B2B", "b2b", atRiskOrdersData, "at-risk")}
                {renderChannelSection("E-Commerce", "ecommerce", atRiskOrdersData, "at-risk")}
              </div>
            </>
          )}

          {/* Fill Rate Tab */}
          {activeTab === "fill-rate" && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Fill Rate (48h)
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Percentage of orders fulfilled within 48 hours
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {renderMetricCard(
                  "Overall Fill Rate",
                  93.5,
                  "%",
                  "yellow",
                  fillRateTrend
                )}
                {renderMetricCard(
                  "Best Performing Channel",
                  99.3,
                  "%",
                  "green"
                )}
                {renderMetricCard(
                  "Target SLA",
                  96,
                  "%",
                  "yellow"
                )}
              </div>

              {/* Channel Breakdown */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Fill Rate by Channel & Service Level
                </h3>
                {renderChannelSection("Retail", "retail", fillRateData, "fill")}
                {renderChannelSection("B2B", "b2b", fillRateData, "fill")}
                {renderChannelSection("E-Commerce", "ecommerce", fillRateData, "fill")}
              </div>

              {/* SLA Legend */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">SLA Benchmarks:</p>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">Excellent: ≥95%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">Good: 90-95%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">Critical: &lt;90%</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
