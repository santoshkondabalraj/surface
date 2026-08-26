"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";

interface TopNavigationProps {
  onMenuClick: () => void;
}

export default function TopNavigation({ onMenuClick }: TopNavigationProps) {
  const { isDark, toggleTheme } = useTheme();
  const [userOpen, setUserOpen] = useState(false);

  return (
    <header className="h-16 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex items-center justify-between px-6 z-20 transition-colors">
      {/* Left: Logo & Menu */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Toggle sidebar"
        >
          <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          {/* Surface Logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.3" />
              <circle cx="12" cy="12" r="8" />
              <path d="M4 12h16" opacity="0.5" />
            </svg>
          </div>
          <div className="flex flex-col gap-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">Surface</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-none">Powered by Plantrix™</p>
          </div>
        </div>
      </div>

      {/* Right: Theme & User */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? (
            <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-4-9a1 1 0 01.117 1.993A7 7 0 003.97 15.07a1 1 0 11-1.414-1.414A5 5 0 018.917 3.007zm-4 16a1 1 0 011-1v-1a1 1 0 11-2 0v1a1 1 0 011 1zm16-4a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zm-4-9a1 1 0 010-2h1a1 1 0 110 2h-1zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200/50 dark:bg-slate-700/50 mx-1"></div>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              U
            </div>
            <svg
              className={`w-4 h-4 text-slate-600 dark:text-slate-400 transition-transform ${userOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {/* User Dropdown Menu */}
          {userOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-30 transition-colors">
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700">
                <span className="text-lg">👤</span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">Profile</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">user@surface.local</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700">
                <span className="text-lg">🔑</span>
                <p className="font-medium text-slate-900 dark:text-white text-sm">Change Password</p>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left text-red-600 dark:text-red-400">
                <span className="text-lg">🚪</span>
                <p className="font-medium text-sm">Logout</p>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
