"use client";

import { useState } from "react";

interface ResultCardProps {
  title: string;
  count: number;
  data: Record<string, string>[];
  explanation?: string;
  thinking?: string;
}

export function ResultCard({ title, count, data, explanation, thinking }: ResultCardProps) {
  const [showThinking, setShowThinking] = useState(false);

  const statusValue = data[0]?.Status || "";
  const statusColor = statusValue.includes("Included In Shipment")
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : statusValue.includes("Backordered")
    ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

  return (
    <div className="my-3 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Success Badge */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-green-900 dark:text-green-300">
          {count === 1 ? `${count} Result Found` : `${count} Results Found`}
        </span>
      </div>

      {/* Details Card */}
      <div className={`p-4 border-b border-slate-200 dark:border-slate-700 ${statusColor}`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h3>

        {/* Data Table - Professional formatting */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                {Object.keys(data[0]).map((key) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white whitespace-nowrap"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  {Object.entries(row).map(([key, value]) => (
                    <td key={key} className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {key === "Status" ? (
                        <span className="inline-block bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          {value}
                        </span>
                      ) : (
                        <span className="block text-sm">{value}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
          {explanation}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
        <button className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
          View Details
        </button>
        <button className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
          Shipment Info
        </button>
        <button className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
          Line Items
        </button>
      </div>

      {/* Collapsible Thinking */}
      {thinking && (
        <button
          onClick={() => setShowThinking(!showThinking)}
          className="w-full px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
        >
          <span>💭 {showThinking ? "Hide" : "Show"} thinking</span>
          <svg
            className={`w-4 h-4 transition-transform ${showThinking ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Thinking Section */}
      {thinking && showThinking && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto font-mono">
          <p className="whitespace-pre-wrap">{thinking}</p>
        </div>
      )}
    </div>
  );
}
