"use client";

import { useState } from "react";

interface ChannelStatus {
  delayed: number;
  atRisk: number;
  fillRate: number;
}

const channelData: Record<string, ChannelStatus> = {
  Retail: { delayed: 59, atRisk: 104, fillRate: 96.9 },
  B2B: { delayed: 122, atRisk: 208, fillRate: 92.9 },
  "E-Commerce": { delayed: 197, atRisk: 309, fillRate: 95.2 },
};

function getHealthStatus(delayed: number, atRisk: number, fillRate: number) {
  if (fillRate < 92 || delayed > 150 || atRisk > 250) return "critical";
  if (fillRate < 95 || delayed > 100 || atRisk > 150) return "warning";
  return "healthy";
}

export default function HealthDashboardOverview() {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  // Calculate totals
  const totalDelayed = Object.values(channelData).reduce(
    (sum, ch) => sum + ch.delayed,
    0
  );
  const totalAtRisk = Object.values(channelData).reduce(
    (sum, ch) => sum + ch.atRisk,
    0
  );
  const avgFillRate =
    Object.values(channelData).reduce((sum, ch) => sum + ch.fillRate, 0) /
    Object.keys(channelData).length;

  const overallStatus = getHealthStatus(totalDelayed, totalAtRisk, avgFillRate);

  const statusColors = {
    healthy: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700",
    warning: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700",
    critical: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700",
  };

  const statusLabels = {
    healthy: "🟢 Healthy",
    warning: "🟡 Warning",
    critical: "🔴 Critical",
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 transition-colors">
      <div className="w-full p-8 space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">Overall Health</p>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-sm ${statusColors[overallStatus]}`}>
              <span>{statusLabels[overallStatus].split(" ")[0]}</span>
              <span className="font-bold">{statusLabels[overallStatus].split(" ")[1]}</span>
            </div>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">Orders Attention</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalDelayed + totalAtRisk}
            </p>
            <p className="text-xs text-slate-500 mt-1">{totalDelayed} delayed</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">Delayed Orders</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalDelayed}</p>
            <p className="text-xs text-slate-500 mt-1">orders</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">Avg Fill Rate</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgFillRate.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 mt-1">OFR</p>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Order Health By Sales Channel</h3>
          <div className="space-y-3">
            {Object.entries(channelData).map(([channel, data]) => {
              const isExpanded = expandedChannel === channel;
              const status = getHealthStatus(data.delayed, data.atRisk, data.fillRate);

              return (
                <div
                  key={channel}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900/50"
                >
                  {/* Channel Header */}
                  <button
                    onClick={() =>
                      setExpandedChannel(isExpanded ? null : channel)
                    }
                    className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {channel}
                        </span>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${statusColors[status]}`}>
                          {statusLabels[status]}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="text-slate-600 dark:text-slate-400">
                          📊 <span className="font-semibold">{data.delayed}</span> delayed
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          ⚠️ <span className="font-semibold">{data.atRisk}</span> at-risk
                        </span>
                        <span className={`font-semibold ${
                          data.fillRate >= 96
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}>
                          📈 {data.fillRate.toFixed(1)}% OFR
                        </span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform flex-shrink-0 ml-4 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </button>

                  {/* Channel Details */}
                  {isExpanded && (
                    <div className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-4">
                      {/* Quick View */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Delayed</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.delayed}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">At-Risk</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.atRisk}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fill Rate</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.fillRate.toFixed(1)}%</p>
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <p>💡 Click on a subsection in the left sidebar for detailed analysis, root causes, and recommended actions.</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Guide */}
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p>• <span className="font-semibold">Delayed Orders:</span> Understand why orders are running late and what to do about it</p>
          <p>• <span className="font-semibold">At-Risk Orders:</span> Identify orders at risk of delay with ML predictions and remediation actions</p>
          <p>• <span className="font-semibold">Fill Rate (48h):</span> Track fulfillment efficiency and see how delayed/at-risk orders impact your OFR</p>
        </div>
      </div>
    </div>
  );
}
