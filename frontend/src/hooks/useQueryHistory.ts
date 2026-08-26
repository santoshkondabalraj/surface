import { useState, useEffect } from "react";

interface UseQueryHistoryOptions {
  storageKey: string;
  maxItems?: number;
}

export function useQueryHistory({ storageKey, maxItems = 10 }: UseQueryHistoryOptions) {
  const [history, setHistory] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error(`Failed to load history for ${storageKey}:`, error);
    }
    setIsLoaded(true);
  }, [storageKey]);

  // Add a new query to history
  const addQuery = (query: string) => {
    if (!query.trim()) return;

    setHistory((prev) => {
      // Remove duplicates (if same query exists, move it to top)
      let updated = prev.filter((q) => q !== query);
      // Add new query to front
      updated = [query, ...updated];
      // Keep only last N items
      updated = updated.slice(0, maxItems);
      // Save to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (error) {
        console.error(`Failed to save history for ${storageKey}:`, error);
      }
      return updated;
    });
  };

  // Clear all history
  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Failed to clear history for ${storageKey}:`, error);
    }
  };

  return { history, addQuery, clearHistory, isLoaded };
}
