"use client";

import { useState } from "react";

interface QueryHistoryPanelProps {
  history: string[];
  onSelectQuery: (query: string) => void;
  onClearHistory: () => void;
}

export default function QueryHistoryPanel({
  history,
  onSelectQuery,
  onClearHistory,
}: QueryHistoryPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (history.length === 0) {
    return (
      <div className="w-64 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 flex flex-col items-center justify-center text-center">
        <div className="text-slate-500 dark:text-slate-400">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs">No query history yet</p>
          <p className="text-xs opacity-75 mt-1">Your recent queries will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Queries
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
            {history.length}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">Click to load previous query</p>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto space-y-1 p-3">
        {history.map((query, index) => (
          <button
            key={index}
            onClick={() => onSelectQuery(query)}
            className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm transition-all group"
            title={query}
          >
            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              {query}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">#{index + 1}</p>
          </button>
        ))}
      </div>

      {/* Clear Button */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3">
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full text-xs py-2 px-3 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z" />
            </svg>
            Clear History
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-700 dark:text-slate-300 text-center">Clear all history?</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onClearHistory();
                  setShowConfirm(false);
                }}
                className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
              >
                Clear
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
