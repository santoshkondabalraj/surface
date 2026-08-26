"use client";

import { useState } from "react";

interface AlertData {
  outOfStock: number;
  lowStockAlert: number;
  dioHigh: number;
  damagedInventory: number;
  slowTurningStock: number;
  committedSupplyRisk: number;
  availabilityDiscrepancies: number;
  topAlerts: string[];
  remediationActions: string[];
  discrepancyExamples?: Array<{ sku: string; channel: string; atpControl: number; atpOms: number; variance: number }>;
}

const categoryAlertData: Record<string, AlertData> = {
  "Electronics": {
    outOfStock: 12,
    lowStockAlert: 8,
    dioHigh: 15,
    damagedInventory: 3,
    slowTurningStock: 22,
    committedSupplyRisk: 5,
    availabilityDiscrepancies: 6,
    topAlerts: [
      "SKU-EL-4521: Out of Stock (expected restock in 3 days)",
      "SKU-EL-3344: Safety Stock fallen below minimum threshold",
      "SKU-EL-2891: DIO at 45 days (target: 30 days)",
      "PO-EL-891: ETA breach by 2 days from supplier ABC",
    ],
    discrepancyExamples: [
      { sku: "SKU-EL-4521", channel: "Retail", atpControl: 10, atpOms: 15, variance: 5 },
      { sku: "SKU-EL-3892", channel: "E-Commerce", atpControl: 8, atpOms: 12, variance: 4 },
      { sku: "SKU-EL-5201", channel: "B2B", atpControl: 25, atpOms: 20, variance: -5 },
    ],
    remediationActions: [
      "Expedite shipment for SKU-EL-4521 or source from alternate supplier",
      "Increase orders for SKU-EL-3344 to restore safety stock",
      "Review slow-moving items; consider markdowns or redistribution",
      "Contact supplier ABC regarding delayed shipment ETA",
      "Reconcile ATP discrepancies between control & OMS systems",
    ],
  },
  "Apparel": {
    outOfStock: 7,
    lowStockAlert: 12,
    dioHigh: 8,
    damagedInventory: 6,
    slowTurningStock: 31,
    committedSupplyRisk: 3,
    availabilityDiscrepancies: 4,
    topAlerts: [
      "SKU-AP-2211: Out of Stock for size L (high seller)",
      "SKU-AP-1945: Safety Stock breached across all sizes",
      "5 units damaged in warehouse accident - write-off required",
      "PO-AP-445: ETA breach by 1 day; adjust demand forecast",
    ],
    discrepancyExamples: [
      { sku: "SKU-AP-2211", channel: "Retail", atpControl: 18, atpOms: 22, variance: 4 },
      { sku: "SKU-AP-1945", channel: "E-Commerce", atpControl: 7, atpOms: 10, variance: 3 },
    ],
    remediationActions: [
      "Prioritize restock of SKU-AP-2211 size L; high demand",
      "Review size mix accuracy for SKU-AP-1945",
      "Process insurance claim for damaged inventory",
      "Adjust replenishment forecast based on supplier reliability",
      "Sync ATP data between inventory control and OMS",
    ],
  },
  "Home & Garden": {
    outOfStock: 5,
    lowStockAlert: 4,
    dioHigh: 22,
    damagedInventory: 2,
    slowTurningStock: 18,
    committedSupplyRisk: 2,
    availabilityDiscrepancies: 3,
    topAlerts: [
      "SKU-HG-5674: Out of Stock (seasonal demand spike)",
      "SKU-HG-4123: DIO at 68 days (target: 45 days)",
      "Bulk item storage inefficiency consuming 20% extra space",
      "PO-HG-234: ETA breach; alternative logistics in progress",
    ],
    discrepancyExamples: [
      { sku: "SKU-HG-5674", channel: "Retail", atpControl: 12, atpOms: 9, variance: -3 },
    ],
    remediationActions: [
      "Expedite seasonal replenishment; increase forecast for Q3",
      "Relocate slow-moving HG items to secondary warehouse",
      "Optimize pallet configurations for bulk items",
      "Evaluate alternative carriers for future shipments",
      "Investigate ATP variance for seasonal SKUs",
    ],
  },
};

export default function InventoryAlertsPanel() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "Electronics"
  );

  const totalOutOfStock = Object.values(categoryAlertData).reduce(
    (sum, cat) => sum + cat.outOfStock,
    0
  );

  const totalLowStockAlert = Object.values(categoryAlertData).reduce(
    (sum, cat) => sum + cat.lowStockAlert,
    0
  );

  const totalInboundDelayRisk = Object.values(categoryAlertData).reduce(
    (sum, cat) => sum + cat.committedSupplyRisk,
    0
  );

  const totalAvailabilityDiscrepancies = Object.values(categoryAlertData).reduce(
    (sum, cat) => sum + cat.availabilityDiscrepancies,
    0
  );

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 transition-colors">
      <div className="w-full p-8 space-y-8">
        {/* Summary Stats - Large Cards */}
        <div className="grid grid-cols-4 gap-6">
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Out of Stock Events
            </p>
            <p className="text-4xl font-bold text-slate-900 dark:text-white mt-2">
              {totalOutOfStock}
            </p>
            <p className="text-xs text-slate-500 mt-1">SKUs</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Low Stock Alert
            </p>
            <p className="text-4xl font-bold text-slate-900 dark:text-white mt-2">
              {totalLowStockAlert}
            </p>
            <p className="text-xs text-slate-500 mt-1">SKUs</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Committed Supply Risk
            </p>
            <p className="text-4xl font-bold text-slate-900 dark:text-white mt-2">
              {totalInboundDelayRisk}
            </p>
            <p className="text-xs text-slate-500 mt-1">Inbound Orders</p>
          </div>

          <div className="border-2 border-orange-200 dark:border-orange-700 rounded-xl p-6 bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-900/20 dark:to-orange-800/20">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              ATP Discrepancies
            </p>
            <p className="text-4xl font-bold text-orange-700 dark:text-orange-500 mt-2">
              {totalAvailabilityDiscrepancies}
            </p>
          </div>
        </div>

        {/* Category Root Cause Analysis */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Active Alerts by Category
          </h3>
          <div className="space-y-4">
            {Object.entries(categoryAlertData).map(([category, data]: [string, AlertData]) => {
              const isExpanded = expandedCategory === category;
              const totalAlerts =
                data.outOfStock +
                data.lowStockAlert +
                data.dioHigh +
                data.damagedInventory +
                data.slowTurningStock +
                data.committedSupplyRisk +
                data.availabilityDiscrepancies;

              return (
                <div
                  key={category}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50"
                >
                  {/* Category Header */}
                  <button
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : category)
                    }
                    className="w-full p-5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl font-bold text-slate-900 dark:text-white">
                          {category}
                        </span>
                        <span className="text-base font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-lg">
                          {totalAlerts} alerts
                        </span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          📦 <span className="font-semibold">{data.outOfStock}</span> OOS
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          ⚠️ <span className="font-semibold">{data.lowStockAlert}</span> SS breach
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          📈 <span className="font-semibold">{data.dioHigh}</span> high DIO
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          🚚 <span className="font-semibold">{data.committedSupplyRisk}</span> ETA breach
                        </span>
                        <span className="text-orange-600 dark:text-orange-400">
                          ⚔️ <span className="font-semibold">{data.availabilityDiscrepancies}</span> ATP mismatch
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

                  {/* Category Details */}
                  {isExpanded && (
                    <div className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-5">
                      {/* Alert Metrics */}
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
                          Alert Summary (Count by Type)
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white dark:bg-slate-900 rounded p-2 border border-red-200 dark:border-red-900/50">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                              📦 Out of Stock
                            </p>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                              {data.outOfStock}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-2 border border-amber-200 dark:border-amber-900/50">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                              ⚠️ Safety Stock
                            </p>
                            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                              {data.lowStockAlert}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-2 border border-orange-200 dark:border-orange-900/50">
                            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                              📈 High DIO
                            </p>
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                              {data.dioHigh}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-2 border border-purple-200 dark:border-purple-900/50">
                            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                              🛠️ Damaged
                            </p>
                            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                              {data.damagedInventory}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-2 border border-blue-200 dark:border-blue-900/50">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                              🐢 Slow Turn
                            </p>
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                              {data.slowTurningStock}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded p-2 border border-red-200 dark:border-red-900/50">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                              🚚 ETA Breach
                            </p>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                              {data.committedSupplyRisk}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ATP Discrepancies */}
                      {data.discrepancyExamples && data.discrepancyExamples.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                            ⚔️ ATP Discrepancies (Control vs OMS)
                          </h4>
                          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg overflow-hidden border border-orange-200 dark:border-orange-700">
                            <div className="grid grid-cols-5 gap-2 p-3 bg-orange-100 dark:bg-orange-900/40 text-xs font-semibold text-orange-800 dark:text-orange-300">
                              <div>SKU</div>
                              <div>Channel</div>
                              <div className="text-center">ATP</div>
                              <div className="text-center">OMS ATP</div>
                              <div className="text-center">Variance</div>
                            </div>
                            <div className="space-y-2 p-3">
                              {data.discrepancyExamples.map((disc, idx) => (
                                <div key={idx} className="grid grid-cols-5 gap-2 text-xs text-orange-800 dark:text-orange-200 items-center">
                                  <div className="font-semibold">{disc.sku}</div>
                                  <div>{disc.channel}</div>
                                  <div className="text-center bg-white dark:bg-slate-900 rounded px-2 py-1">{disc.atpControl}</div>
                                  <div className="text-center bg-white dark:bg-slate-900 rounded px-2 py-1">{disc.atpOms}</div>
                                  <div className={`text-center font-semibold px-2 py-1 rounded ${
                                    disc.variance > 0
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                  }`}>
                                    {disc.variance > 0 ? "+" : ""}{disc.variance}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">
                            💡 <span className="font-semibold">Note:</span> Positive variance = OMS shows more stock than ATP; Negative = ATP shows more stock than OMS
                          </p>
                        </div>
                      )}

                      {/* Active Alerts */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                          🔴 Active Alerts
                        </h4>
                        <div className="space-y-2">
                          {data.topAlerts.map((alert: string, idx: number) => (
                            <div
                              key={idx}
                              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 flex gap-3"
                            >
                              <span className="text-lg flex-shrink-0">⚠️</span>
                              <p className="text-sm text-red-800 dark:text-red-200">
                                {alert}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Remediation Actions */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-400">
                          📋 Recommended Actions (Priority Order)
                        </p>
                        <div className="space-y-2">
                          {data.remediationActions.map((action: string, idx: number) => (
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

        {/* Alert Legend */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-l-4 border-purple-500 rounded-lg p-5">
          <p className="text-sm font-bold text-purple-900 dark:text-purple-400 mb-3">
            📋 Inventory Alert Types
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm text-purple-800 dark:text-purple-300">
            <div>• <span className="font-semibold">Out of Stock (OOS):</span> SKU inventory = 0</div>
            <div>• <span className="font-semibold">Safety Stock Breach:</span> Stock below minimum threshold</div>
            <div>• <span className="font-semibold">High DIO:</span> Days Inventory Outstanding exceeds target</div>
            <div>• <span className="font-semibold">Damaged Inventory:</span> Unusable stock requiring write-off</div>
            <div>• <span className="font-semibold">Slow Turns:</span> Low velocity items consuming warehouse space</div>
            <div>• <span className="font-semibold">ETA Breach:</span> Inbound orders delayed from supplier</div>
            <div>• <span className="font-semibold">ATP Discrepancy:</span> Availability To Promise mismatch between Inventory Control and OMS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
