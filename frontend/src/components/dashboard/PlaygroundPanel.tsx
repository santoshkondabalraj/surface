"use client";

import { useState } from "react";

interface ScenarioConfig {
  demandVolume: number; // percentage change
  serviceLevel: "standard" | "expedited" | "premium"; // speed/availability tradeoff
  inventoryBudget: number; // $ cap
  laborCapacity: number; // units per day
}

interface ServiceMetrics {
  fulfillmentSpeed: number; // days
  availability: number; // %
  backorderRate: number; // %
}

interface CostStructure {
  procurement: number;
  carrying: number;
  labor: number;
  transportation: number;
  fulfillment: number;
  totalCost: number;
  costPerOrder: number;
}

interface RiskExposure {
  liquidationRisk: number; // %
  sunkenLaborCost: number; // $
  constraintViolation: string | null;
}

interface SimulationResult {
  service: ServiceMetrics;
  costs: CostStructure;
  risks: RiskExposure;
  margin: number; // $
  marginPercent: number; // %
  ordersFulfilled: number;
  ordersBackordered: number;
}

export default function PlaygroundPanel() {
  const [scenario, setScenario] = useState<ScenarioConfig>({
    demandVolume: 0,
    serviceLevel: "standard",
    inventoryBudget: 500000,
    laborCapacity: 1000,
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [baselineResult, setBaselineResult] = useState<SimulationResult | null>(null);

  // Mock simulation engine
  const simulateScenario = (config: ScenarioConfig, isBaseline: boolean = false) => {
    // Base demand: 2000 orders/day
    const baseDemand = 2000;
    const adjustedDemand = baseDemand * (1 + config.demandVolume / 100);

    // Service level impacts
    const serviceLevelConfig = {
      standard: { speed: 4, availability: 85, procurementMultiplier: 1.0 },
      expedited: { speed: 2, availability: 92, procurementMultiplier: 1.3 },
      premium: { speed: 1, availability: 98, procurementMultiplier: 1.6 },
    };

    const slConfig = serviceLevelConfig[config.serviceLevel];

    // Calculate fulfillment based on labor capacity
    const ordersFulfilled = Math.min(adjustedDemand, config.laborCapacity);
    const ordersBackordered = Math.max(0, adjustedDemand - ordersFulfilled);
    const backorderRate = (ordersBackordered / adjustedDemand) * 100;

    // Actual availability = configured - backorder impact
    const actualAvailability = Math.max(0, slConfig.availability - backorderRate * 0.5);

    // Cost calculations
    const procurementCost = adjustedDemand * 50 * slConfig.procurementMultiplier;
    const carryingCost =
      (config.inventoryBudget * 0.15) / 100 * (adjustedDemand / baseDemand);
    const laborCost = ordersFulfilled * 5;
    const transportationCost = ordersFulfilled * 12 * (5 - slConfig.speed) * 0.15;
    const fulfillmentCost = ordersFulfilled * 8;

    const totalCost = procurementCost + carryingCost + laborCost + transportationCost + fulfillmentCost;
    const costPerOrder = totalCost / (ordersFulfilled || 1);

    // Revenue model: $100 per order fulfilled
    const revenue = ordersFulfilled * 100;
    const margin = revenue - totalCost;
    const marginPercent = (margin / revenue) * 100;

    // Risk exposure
    const sunkenLaborCost = ordersBackordered * 5;
    let liquidationRisk = 0;
    let constraintViolation = null;

    if (actualAvailability < 80) {
      liquidationRisk = 15;
      constraintViolation = "⚠️ Low availability risks inventory liquidation";
    } else if (ordersBackordered > config.laborCapacity * 0.3) {
      liquidationRisk = 8;
      constraintViolation = "⚠️ High backorder rate may require clearance sales";
    }

    if (carryingCost > config.inventoryBudget * 0.5) {
      if (!constraintViolation) constraintViolation = "⚠️ Carrying costs approaching budget limit";
    }

    if (ordersFulfilled < config.laborCapacity * 0.7) {
      if (!constraintViolation)
        constraintViolation = "📊 Underutilized labor capacity - consider demand generation";
    }

    return {
      service: {
        fulfillmentSpeed: slConfig.speed,
        availability: actualAvailability,
        backorderRate,
      },
      costs: {
        procurement: procurementCost,
        carrying: carryingCost,
        labor: laborCost,
        transportation: transportationCost,
        fulfillment: fulfillmentCost,
        totalCost,
        costPerOrder,
      },
      risks: {
        liquidationRisk,
        sunkenLaborCost,
        constraintViolation,
      },
      margin,
      marginPercent,
      ordersFulfilled,
      ordersBackordered,
    };
  };

  const handleSimulate = () => {
    const simResult = simulateScenario(scenario);
    setResult(simResult);
    if (!baselineResult) {
      setBaselineResult(simResult);
    }
  };

  const handleCompare = () => {
    if (!baselineResult) {
      setBaselineResult(result);
    }
    setComparisonEnabled(!comparisonEnabled);
  };

  const marginChange = result && baselineResult ? result.margin - baselineResult.margin : 0;
  const marginChangePercent =
    result && baselineResult
      ? ((result.margin - baselineResult.margin) / Math.abs(baselineResult.margin)) * 100
      : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div className="flex-1 overflow-y-auto w-full p-8 space-y-8">
        {/* Introduction */}
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p>
            • <span className="font-semibold">Demand-Driven Simulation:</span> Adjust customer demand
            and service level commitments to understand supply chain tradeoffs
          </p>
          <p>
            • <span className="font-semibold">Constraint Modeling:</span> Configure inventory budget,
            labor capacity, and financial limits to reflect real operational constraints
          </p>
          <p>
            • <span className="font-semibold">Cost-Service Optimization:</span> See how service level
            decisions impact procurement, carrying costs, labor, and profitability
          </p>
        </div>

        {/* Scenario Configuration */}
        <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-5 bg-slate-50/50 dark:bg-slate-900/30">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Scenario Configuration
          </h3>

          <div className="space-y-4">
            {/* Demand Volume */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Customer Demand Change: <span className="text-purple-600">{scenario.demandVolume > 0 ? "+" : ""}{scenario.demandVolume}%</span>
              </label>
              <input
                type="range"
                min="-50"
                max="50"
                value={scenario.demandVolume}
                onChange={(e) => setScenario({ ...scenario, demandVolume: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Base demand: 2,000 orders/day
              </p>
            </div>

            {/* Service Level */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Service Level (Speed & Availability Commitment)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "standard", label: "Standard", desc: "4-day delivery, 85% availability" },
                    { id: "expedited", label: "Expedited", desc: "2-day delivery, 92% availability" },
                    { id: "premium", label: "Premium", desc: "1-day delivery, 98% availability" },
                  ] as const
                ).map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setScenario({ ...scenario, serviceLevel: level.id })}
                    className={`text-xs p-3 rounded-lg border-2 transition-all ${
                      scenario.serviceLevel === level.id
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                        : "border-slate-200 dark:border-slate-700 hover:border-purple-300"
                    }`}
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">{level.label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{level.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Constraints */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Inventory Budget: ${(scenario.inventoryBudget / 1000).toFixed(0)}K
                </label>
                <input
                  type="range"
                  min="200000"
                  max="1000000"
                  step="50000"
                  value={scenario.inventoryBudget}
                  onChange={(e) => setScenario({ ...scenario, inventoryBudget: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Labor Capacity: {scenario.laborCapacity.toLocaleString()} orders/day
                </label>
                <input
                  type="range"
                  min="500"
                  max="2500"
                  step="100"
                  value={scenario.laborCapacity}
                  onChange={(e) => setScenario({ ...scenario, laborCapacity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleSimulate}
              className="w-full px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Run Simulation
            </button>
          </div>
        </div>

        {/* Simulation Results */}
        {result && (
          <div className="space-y-6">
            {/* Constraint Warnings */}
            {result.risks.constraintViolation && (
              <div className="border-l-4 border-amber-500 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{result.risks.constraintViolation}</p>
              </div>
            )}

            {/* Service Metrics */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Service Level Achievement
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Fulfillment Speed</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {result.service.fulfillmentSpeed}d
                  </p>
                  <p className="text-xs text-slate-500 mt-1">average delivery</p>
                </div>

                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Availability</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {result.service.availability.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">fill rate achieved</p>
                </div>

                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Backorder Rate</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {result.service.backorderRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {result.ordersBackordered.toLocaleString()} orders
                  </p>
                </div>
              </div>
            </div>

            {/* Cost Structure */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Cost Structure & Economics
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Procurement", value: result.costs.procurement },
                  { label: "Inventory Carrying", value: result.costs.carrying },
                  { label: "Labor", value: result.costs.labor },
                  { label: "Transportation", value: result.costs.transportation },
                  { label: "Fulfillment", value: result.costs.fulfillment },
                ].map((cost) => (
                  <div key={cost.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{cost.label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ${(cost.value / 1000).toFixed(1)}K
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Total Cost</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    ${(result.costs.totalCost / 1000).toFixed(1)}K
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Impact */}
            <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Financial Impact
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">Cost per Order</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    ${result.costs.costPerOrder.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">Profit Margin</p>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${(result.margin / 1000).toFixed(1)}K
                    </p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400 pb-1">
                      ({result.marginPercent.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Exposure */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Risk Exposure
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Liquidation Risk</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {result.risks.liquidationRisk}%
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">of inventory at risk</p>
                </div>
                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Sunk Labor Cost</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    ${(result.risks.sunkenLaborCost / 1000).toFixed(1)}K
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">from backorders</p>
                </div>
              </div>
            </div>

            {/* Comparison Mode */}
            {baselineResult && result !== baselineResult && (
              <div className="border-2 border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-900/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Scenario Comparison vs Baseline
                  </h3>
                  <button
                    onClick={handleCompare}
                    className="text-xs px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                  >
                    {comparisonEnabled ? "Hide" : "Show"} Comparison
                  </button>
                </div>

                {comparisonEnabled && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Margin Impact</span>
                      <span
                        className={`font-bold ${
                          marginChange >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {marginChange >= 0 ? "+" : ""} ${Math.abs(marginChange / 1000).toFixed(1)}K ({marginChangePercent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Availability Change</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {(result.service.availability - baselineResult.service.availability).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Cost per Order Change</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ${(result.costs.costPerOrder - baselineResult.costs.costPerOrder).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
