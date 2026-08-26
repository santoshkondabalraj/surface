"use client";

import { useState } from "react";

interface ChannelFillRateData {
  fillRate: number;
  trend: number;
  delayedOrders: number;
  atRiskOrders: number;
  totalOrders: number;
  strengths: string[];
  gaps: string[];
  onTrackCount: number;
  monitorCount: number;
  criticalCount: number;
}

const fillRateMetrics: Record<string, ChannelFillRateData> = {
  Retail: {
    fillRate: 96.9,
    trend: 0.5,
    delayedOrders: 59,
    atRiskOrders: 104,
    totalOrders: 2100,
    onTrackCount: 2000,
    monitorCount: 78,
    criticalCount: 22,
    strengths: ["Strong carriers", "Efficient ops", "Stable demand"],
    gaps: ["QC bottleneck", "Peak delays", "Limited backup"],
  },
  B2B: {
    fillRate: 92.9,
    trend: -1.1,
    delayedOrders: 122,
    atRiskOrders: 208,
    totalOrders: 4200,
    onTrackCount: 3900,
    monitorCount: 156,
    criticalCount: 144,
    strengths: ["Bulk efficiency", "Predictable orders"],
    gaps: ["Forecast accuracy", "Supplier variability", "Carrier capacity"],
  },
  "E-Commerce": {
    fillRate: 95.2,
    trend: 0.3,
    delayedOrders: 197,
    atRiskOrders: 309,
    totalOrders: 6150,
    onTrackCount: 5800,
    monitorCount: 267,
    criticalCount: 83,
    strengths: ["High throughput", "Flexible fulfillment"],
    gaps: ["Carrier constraints", "Multi-SKU complexity", "Peak scaling"],
  },
};

function FillRateProgressBar({
  rate,
  target = 96,
}: {
  rate: number;
  target?: number;
}) {
  const percentage = Math.min((rate / 100) * 100, 100);
  const isAboveTarget = rate >= target;
  const getColor = () => {
    if (rate >= target) return "bg-green-500";
    if (rate >= target - 3) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${getColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-2xl font-bold text-slate-900 dark:text-white w-16 text-right">
          {rate.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Target: {target}%</span>
        {!isAboveTarget && (
          <span className={rate >= target - 3 ? "text-amber-600" : "text-red-600"}>
            {(target - rate).toFixed(1)}% below target
          </span>
        )}
      </div>
    </div>
  );
}

export default function FillRatePanel() {
  const [expandedChannel, setExpandedChannel] = useState<string | null>("E-Commerce");

  const overallFillRate =
    Object.values(fillRateMetrics).reduce((sum, ch) => sum + ch.fillRate, 0) /
    Object.keys(fillRateMetrics).length;

  const totalDelayed = Object.values(fillRateMetrics).reduce(
    (sum, ch) => sum + ch.delayedOrders,
    0
  );

  const totalAtRisk = Object.values(fillRateMetrics).reduce(
    (sum, ch) => sum + ch.atRiskOrders,
    0
  );

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 transition-colors">
      <div className="w-full p-8 space-y-8">
        {/* Summary Stats - Large Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-4">Overall Fill Rate</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {overallFillRate.toFixed(1)}%
            </p>
            <p className={`text-sm font-semibold mt-3 ${
              overallFillRate >= 96
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
            }`}>
              {overallFillRate >= 96 ? "✅ On Track" : "⚠️ Below Target"}
            </p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-gradient-to-br from-red-50/50 to-orange-50/30 dark:from-red-900/20 dark:to-orange-900/20">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-4">Orders in Jeopardy</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {totalDelayed + totalAtRisk}
            </p>
            <p className="text-sm text-slate-500 mt-3">
              <span className="font-semibold">{totalDelayed}</span> delayed + <span className="font-semibold">{totalAtRisk}</span> at-risk
            </p>
          </div>
        </div>

        {/* Channel Performance with Gaps */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Channel Performance & Gaps</h3>
          <div className="space-y-4">
            {Object.entries(fillRateMetrics).map(([channel, metrics]) => {
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
                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          {channel}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xl font-bold px-4 py-1 rounded-lg ${
                            metrics.fillRate >= 96
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          }`}>
                            {metrics.fillRate.toFixed(1)}%
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400">OFR</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm">
                        <span className={metrics.trend >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          📊 {metrics.trend >= 0 ? "+" : ""}{metrics.trend.toFixed(1)}%
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          📦 {metrics.totalOrders.toLocaleString()} orders
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          ⚠️ {metrics.delayedOrders + metrics.atRiskOrders} impacted
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
                    <div className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-5">
                      {/* Fill Rate Progress */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Fulfillment Progress</h4>
                        <FillRateProgressBar rate={metrics.fillRate} />
                      </div>

                      {/* Order Status Distribution */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Order Status (Number of Orders in 48h)</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                          <strong>On Track:</strong> Fulfilling on schedule | <strong>Monitor:</strong> At-risk orders | <strong>Critical:</strong> Delayed orders
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-green-200 dark:border-green-900/50">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">🟢 On Track</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.onTrackCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-amber-200 dark:border-amber-900/50">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">🟡 Monitor</p>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.monitorCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-3 border border-red-200 dark:border-red-900/50">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">🔴 Critical</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.criticalCount}</p>
                            <p className="text-xs text-slate-500 mt-1">orders</p>
                          </div>
                        </div>
                      </div>

                      {/* Strengths */}
                      <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4">
                        <p className="text-sm font-bold text-green-900 dark:text-green-400 mb-3">✅ What's Working Well</p>
                        <div className="flex flex-wrap gap-2">
                          {metrics.strengths.map((strength, idx) => (
                            <span
                              key={idx}
                              className="text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full"
                            >
                              ✓ {strength}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Gaps */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-lg p-4">
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-400 mb-3">⚠️ Gaps & Improvements</p>
                        <div className="flex flex-wrap gap-2">
                          {metrics.gaps.map((gap, idx) => (
                            <span
                              key={idx}
                              className="text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full"
                            >
                              🔧 {gap}
                            </span>
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

        {/* Executive Summary */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-l-4 border-purple-500 rounded-lg p-5">
          <p className="text-sm font-bold text-purple-900 dark:text-purple-400 mb-3">
            📊 Executive Summary
          </p>
          <ul className="text-sm text-purple-800 dark:text-purple-300 space-y-2">
            <li>
              • Fill rate trending {overallFillRate >= 96 ? "positively" : "negatively"} — <span className="font-semibold">{(totalDelayed + totalAtRisk).toLocaleString()}</span> orders need attention
            </li>
            <li>
              • E-Commerce has highest volume but inventory gaps impacting fulfillment
            </li>
            <li>
              • B2B forecast accuracy and supplier reliability are primary improvement levers
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
