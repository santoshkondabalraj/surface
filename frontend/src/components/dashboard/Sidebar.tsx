"use client";

import { useState } from "react";

interface SidebarProps {
  selectedSection: string;
  onSelectSection: (sectionId: string) => void;
  isOpen: boolean;
}

interface Subsection {
  id: string;
  label: string;
  children?: Subsection[];
}

interface Section {
  id: string;
  label: string;
  icon: string;
  color: string;
  subsections: Subsection[];
  isAdmin?: boolean;
}

const sections: Section[] = [
  {
    id: "functional-health",
    label: "Fulfillment Health",
    icon: "💚",
    color: "purple",
    subsections: [
      { id: "delayed-orders", label: "Delayed Orders" },
      { id: "at-risk", label: "At-Risk Orders" },
      { id: "fill-rate", label: "Fill Rate (48h)" },
    ],
  },
  {
    id: "order-support",
    label: "Order Support",
    icon: "📦",
    color: "purple",
    subsections: [
      { id: "order-enquiry", label: "Order Enquiry" },
      { id: "root-cause", label: "Root Cause Analysis" },
    ],
  },
  {
    id: "inventory-diagnosis",
    label: "Inventory Diagnosis",
    icon: "📊",
    color: "purple",
    subsections: [
      { id: "inventory-rca", label: "Inventory Alerts" },
      { id: "availability", label: "Availability Check" },
    ],
  },
  {
    id: "query-generator",
    label: "Query Generator",
    icon: "✨",
    color: "purple",
    subsections: [],
  },
  {
    id: "playground",
    label: "Playground",
    icon: "🎮",
    color: "purple",
    subsections: [],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "⚙️",
    color: "purple",
    subsections: [
      { id: "rbac", label: "Access Control" },
      { id: "system-config", label: "System Config" },
      { id: "observability", label: "Observability" },
      { id: "billing", label: "Billing" },
    ],
    isAdmin: true,
  },
];

// Single brand color throughout
const BRAND_ACTIVE = "hover:bg-purple-50 dark:hover:bg-purple-950/30 data-[active=true]:bg-purple-100 dark:data-[active=true]:bg-purple-900/30 data-[active=true]:border-purple-300 dark:data-[active=true]:border-purple-600";
const BRAND_TEXT = "text-purple-700 dark:text-purple-400";

export default function Sidebar({ selectedSection, onSelectSection, isOpen }: SidebarProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("functional-health");
  const [expandedSubsection, setExpandedSubsection] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSectionClick = (sectionId: string) => {
    if (expandedSection === sectionId) {
      setExpandedSection(null);
    } else {
      setExpandedSection(sectionId);
    }
    onSelectSection(sectionId);
  };

  const handleSubsectionClick = (subsectionId: string, hasChildren: boolean) => {
    if (hasChildren) {
      setExpandedSubsection(expandedSubsection === subsectionId ? null : subsectionId);
    }
    onSelectSection(subsectionId);
  };

  const handleChildClick = (childId: string) => {
    onSelectSection(childId);
  };

  return (
    <aside className="w-64 border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden transition-colors">
      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {sections.map((section, idx) => {
          const isActive = selectedSection === section.id;
          const isExpanded = expandedSection === section.id;
          const hasSubsections = section.subsections.length > 0;
          const isAdminSection = section.isAdmin;
          const prevIsAdmin = idx > 0 && !sections[idx - 1].isAdmin;

          return (
            <div key={section.id}>
              {isAdminSection && prevIsAdmin && (
                <div className="my-3 border-t border-slate-200/50 dark:border-slate-700/50"></div>
              )}
              <div>
              {/* Main Section Button */}
              <button
                onClick={() => handleSectionClick(section.id)}
                data-active={isActive}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-transparent transition-all text-left ${BRAND_ACTIVE}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{section.icon}</span>
                  <span className={`font-medium text-sm ${isActive ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                    {section.label}
                  </span>
                </div>
                {hasSubsections && (
                  <svg
                    className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
              </button>

              {/* Subsections */}
              {hasSubsections && isExpanded && (
                <div className="space-y-0.5 mt-1 pl-8 pr-2">
                  {section.subsections.map((subsection) => {
                    const isSubActive = selectedSection === subsection.id;
                    const hasChildren = subsection.children && subsection.children.length > 0;
                    const isSubExpanded = expandedSubsection === subsection.id;

                    return (
                      <div key={subsection.id}>
                        {/* Subsection Item */}
                        <button
                          onClick={() => handleSubsectionClick(subsection.id, !!hasChildren)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border border-transparent text-left text-sm transition-all ${
                            isSubActive
                              ? `${BRAND_TEXT} bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-600 border-opacity-40 font-medium`
                              : `text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 ${BRAND_TEXT}`
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-1 h-1 rounded-full bg-current opacity-60 flex-shrink-0"></span>
                            <span className="truncate">{subsection.label}</span>
                          </div>
                          {hasChildren && (
                            <svg
                              className={`w-3 h-3 text-slate-500 transition-transform flex-shrink-0 ${isSubExpanded ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>

                        {/* Child Items (nested subsections) */}
                        {hasChildren && isSubExpanded && (
                          <div className="space-y-0.5 mt-1 pl-6 pr-1">
                            {subsection.children?.map((child) => {
                              const isChildActive = selectedSection === child.id;

                              return (
                                <button
                                  key={child.id}
                                  onClick={() => handleChildClick(child.id)}
                                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-md border border-transparent text-left text-xs transition-all ${
                                    isChildActive
                                      ? `${BRAND_TEXT} bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 font-semibold`
                                      : `text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/30`
                                  }`}
                                >
                                  <span className="w-0.5 h-0.5 rounded-full bg-current opacity-60 flex-shrink-0"></span>
                                  <span className="truncate">{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-3 bg-white/50 dark:bg-slate-900/50 transition-colors">
        <p className="text-xs text-slate-500 dark:text-slate-500 text-center">Surface v1.0</p>
        <p className="text-xs text-slate-400 dark:text-slate-600 text-center">by Plantrix™</p>
      </div>
    </aside>
  );
}
