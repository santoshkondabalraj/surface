"use client";

import { useState } from "react";

interface ChannelDelayData {
  totalDelayed: number;
  avgDaysLate: number;
  slaTarget: string;
  trend: number;
  topReason: string;
  criticalCount: number;
  mediumCount: number;
  lowCount: number;
  topReasons: string[];
  remediationActions: string[];
}

const channelDelayMetadata: Record<string, ChannelDelayData> = {
  Retail: {
    totalDelayed: 59,
    avgDaysLate: 2.1,
    slaTarget: "5d",
    trend: -0.8,
    topReason: "QC",
    criticalCount: 8,
    mediumCount: 28,
    lowCount: 23,
    topReasons: ["Warehouse QC", "Peak-hour delays", "Backup supplier limits"],
    remediationActions: [
      "Expedite QC review process",
      "Add additional QC staff during peaks",
      "Diversify supplier base",
    ],
  },
  B2B: {
    totalDelayed: 122,
    avgDaysLate: 1.8,
    slaTarget: "3d",
    trend: 1.2,
    topReason: "Inventory",
    criticalCount: 34,
    mediumCount: 56,
    lowCount: 32,
    topReasons: ["Inventory shortage", "Supplier delays", "Forecast accuracy"],
    remediationActions: [
      "Review inventory forecast model",
      "Negotiate shorter lead times with suppliers",
      "Implement safety stock policy",
    ],
  },
  "E-Commerce": {
    totalDelayed: 197,
    avgDaysLate: 2.3,
    slaTarget: "7d",
    trend: -0.3,
    topReason: "Carrier",
    criticalCount: 45,
    mediumCount: 89,
    lowCount: 63,
    topReasons: ["Carrier delays", "Multi-SKU complexity", "Peak season scaling"],
    remediationActions: [
      "Escalate to carrier support",
      "Pre-position high-volume SKUs",
      "Add fulfillment capacity for peaks",
    ],
  },
};

function DelayMeter({ daysLate, slaThreshold }: { daysLate: number; slaThreshold: number }) {
  const percentage = Math.min((daysLate / slaThreshold) * 100, 150);
  const color =
    daysLate <= 1 ? "bg-green-500" : daysLate <= 2 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className="text-sm font-bold text-slate-900 dark:text-white w-12">+{daysLate}d</span>
    </div>
  );
}

export default function DelayedOrdersPanel() {
  const [expandedChannel, setExpandedChannel] = useState<string | null>("Retail");

  const totalDelayed = Object.values(channelDelayMetadata).reduce(
    (sum, ch) => sum + ch.totalDelayed,
    0
  );

  const avgDaysLate =
    Object.values(channelDelayMetadata).reduce((sum, ch) => sum + ch.avgDaysLate, 0) /
    Object.keys(channelDelayMetadata).length;

  const totalCritical = Object.values(channelDelayMetadata).reduce(
    (sum, ch) => sum + ch.criticalCount,
    0
  );

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 transition-colors">
      <div className="w-full p-8 space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Delayed</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalDelayed}</p>
            <p className="text-xs text-slate-500 mt-0.5">orders</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Avg Days Late</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {avgDaysLate.toFixed(1)}d
            </p>
            <p className="text-xs text-slate-500 mt-0.5">beyond SLA</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Critical</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalCritical}</p>
            <p className="text-xs text-slate-500 mt-0.5">orders</p>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Root Cause by Channel</h3>
          <div className="space-y-3">
            {Object.entries(channelDelayMetadata).map(([channel, data]) => {
              const isExpanded = expandedChannel === channel;

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
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {channel}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {data.totalDelayed}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <DelayMeter daysLate={data.avgDaysLate} slaThreshold={parseFloat(data.slaTarget)} />
                        <span className={data.trend > 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                          📊 {data.trend > 0 ? "+" : ""}{data.trend.toFixed(1)}%
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          SLA: {data.slaTarget}
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

                  {/* Channel Details - Expanded View */}
                  {isExpanded && (
                    <div className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-3">
                      {/* Root Causes */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                          🔧 Root Causes
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {data.topReasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className="text-sm font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-full"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Delay Distribution */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delay Severity (Number of Orders)</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                          <strong>Critical:</strong> 3+ days late | <strong>Medium:</strong> 1-2 days late | <strong>Low:</strong> &lt;1 day late
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-red-200 dark:border-red-900/50">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">🔴 Critical</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.criticalCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-amber-200 dark:border-amber-900/50">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">🟡 Medium</p>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.mediumCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-green-200 dark:border-green-900/50">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">🟢 Low</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.lowCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                        </div>
                      </div>

                      {/* Remediation Actions */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-400">
                          📋 Recommended Actions (Priority Order)
                        </p>
                        <div className="space-y-2">
                          {data.remediationActions.map((action, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                                <span className="text-xs font-bold">{idx + 1}</span>
                              </div>
                              <p className="text-sm text-blue-800 dark:text-blue-300 pt-0.5">
                                {action}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Recommendations */}
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p>• Prioritize B2B delays (premium SLA most impacted)</p>
          <p>• Address warehouse QC bottleneck affecting 42% of delays</p>
          <p>• Coordinate with carriers on E-Commerce routing</p>
        </div>
      </div>
    </div>
  );
}
