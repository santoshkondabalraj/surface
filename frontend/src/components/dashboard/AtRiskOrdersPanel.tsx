"use client";

import { useState } from "react";

interface ChannelRiskData {
  totalAtRisk: number;
  avgRiskScore: number;
  trend: number;
  primaryFactor: string;
  criticalCount: number;
  warningCount: number;
  topRiskFactors: string[];
  remediationActions: string[];
}

const channelRiskMetadata: Record<string, ChannelRiskData> = {
  "B2B": {
    totalAtRisk: 208,
    avgRiskScore: 71,
    trend: 2.1,
    primaryFactor: "Inventory",
    criticalCount: 45,
    warningCount: 89,
    topRiskFactors: ["Inventory low", "Supply extended", "High volume"],
    remediationActions: [
      "Trigger expedited supply orders",
      "Allocate from backup warehouse",
      "Notify customers of potential delay",
    ],
  },
  "Retail": {
    totalAtRisk: 104,
    avgRiskScore: 58,
    trend: -1.3,
    primaryFactor: "Capacity",
    criticalCount: 12,
    warningCount: 34,
    topRiskFactors: ["Capacity constraints", "Peak hours", "Limited backup"],
    remediationActions: [
      "Reroute to secondary fulfillment center",
      "Extend operating hours",
      "Coordinate with alternative carriers",
    ],
  },
  "E-Commerce": {
    totalAtRisk: 309,
    avgRiskScore: 64,
    trend: 0.7,
    primaryFactor: "Carrier",
    criticalCount: 68,
    warningCount: 156,
    topRiskFactors: ["Carrier capacity", "Peak shipping", "Multi-SKU complexity"],
    remediationActions: [
      "Negotiate additional carrier capacity",
      "Implement split shipment strategy",
      "Pre-position inventory closer to customers",
    ],
  },
};

function getRiskLabel(score: number) {
  if (score >= 80) return { label: "CRITICAL", color: "text-red-600 dark:text-red-400" };
  if (score >= 60) return { label: "WARNING", color: "text-amber-600 dark:text-amber-400" };
  return { label: "MONITOR", color: "text-green-600 dark:text-green-400" };
}

function RiskScoreBadge({ score }: { score: number }) {
  const { label, color } = getRiskLabel(score);
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
    </div>
  );
}

export default function AtRiskOrdersPanel() {
  const [expandedChannel, setExpandedChannel] = useState<string | null>("B2B");

  const totalAtRisk = Object.values(channelRiskMetadata).reduce(
    (sum, ch) => sum + ch.totalAtRisk,
    0
  );

  const avgRiskScore =
    Object.values(channelRiskMetadata).reduce((sum, ch) => sum + ch.avgRiskScore, 0) /
    Object.keys(channelRiskMetadata).length;

  const totalCritical = Object.values(channelRiskMetadata).reduce(
    (sum, ch) => sum + ch.criticalCount,
    0
  );

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 transition-colors">
      <div className="w-full p-8 space-y-8">
        {/* Summary Stats - Large Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total At-Risk</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{totalAtRisk}</p>
            <p className="text-xs text-slate-500 mt-1">orders</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-4">Avg Risk Score</p>
            <RiskScoreBadge score={Math.round(avgRiskScore)} />
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Critical Orders</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{totalCritical}</p>
            <p className="text-xs text-slate-500 mt-1">need immediate action</p>
          </div>
        </div>

        {/* Channel Risk Analysis */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Risk Factors by Channel</h3>
          <div className="space-y-4">
            {Object.entries(channelRiskMetadata).map(([channel, data]) => {
              const isExpanded = expandedChannel === channel;

              return (
                <div
                  key={channel}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50"
                >
                  {/* Channel Header */}
                  <button
                    onClick={() =>
                      setExpandedChannel(isExpanded ? null : channel)
                    }
                    className="w-full p-5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl font-bold text-slate-900 dark:text-white">
                          {channel}
                        </span>
                        <span className="text-base font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                          {data.totalAtRisk} orders
                        </span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm">
                        <RiskScoreBadge score={data.avgRiskScore} />
                        <span className={data.trend > 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                          📈 {data.trend > 0 ? "+" : ""}{data.trend.toFixed(1)}%
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          🎯 {data.primaryFactor}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          🔴 {data.criticalCount} critical
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
                    <div className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-5">
                      {/* Risk Factors */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                          ⚠️ Key Risk Factors
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {data.topRiskFactors.map((factor, idx) => (
                            <span
                              key={idx}
                              className="text-sm font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Risk Distribution */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Risk Distribution (Number of Orders by Score)</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                          <strong>Critical:</strong> ML risk score 80+ (high probability of delay) | <strong>Warning:</strong> ML risk score 60-79 (moderate risk)
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-red-200 dark:border-red-900/50">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">🔴 Critical (80+)</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.criticalCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-amber-200 dark:border-amber-900/50">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">🟡 Warning (60-79)</p>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.warningCount}</p>
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

        {/* Strategic Insights */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 border-l-4 border-orange-500 rounded-lg p-5">
          <p className="text-sm font-bold text-orange-900 dark:text-orange-400 mb-3">
            ⚡ Intervention Opportunity
          </p>
          <ul className="text-sm text-orange-800 dark:text-orange-300 space-y-2">
            <li>• <span className="font-semibold">{totalCritical}</span> orders in CRITICAL zone (80+) — requires immediate action</li>
            <li>• B2B Premium highest impact — escalate to ops team</li>
            <li>• Inventory shortage driving 40% of risk — coordinate with supply chain</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
