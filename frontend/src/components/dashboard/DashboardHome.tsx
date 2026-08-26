"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface DashboardSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  gradient: string;
  accentColor: string;
  subsections?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

const sections: DashboardSection[] = [
  {
    id: "query-generator",
    title: "Query Generator",
    icon: "✨",
    description: "Transform natural language into powerful SQL queries",
    gradient: "from-pink-500/10 via-rose-500/5 to-transparent",
    accentColor: "text-pink-600 bg-pink-500/10",
    subsections: [],
  },
  {
    id: "order-support",
    title: "Order Support",
    icon: "📦",
    description: "Manage, analyze, and resolve order-related issues",
    gradient: "from-blue-500/10 via-cyan-500/5 to-transparent",
    accentColor: "text-blue-600 bg-blue-500/10",
    subsections: [
      { id: "order-enquiry", name: "Order Enquiry", description: "Track and search orders" },
      { id: "root-cause", name: "Root Cause Analysis", description: "Analyze order failures" },
    ],
  },
  {
    id: "inventory-diagnosis",
    title: "Inventory Diagnosis",
    icon: "📊",
    description: "Monitor inventory health and availability metrics",
    gradient: "from-green-500/10 via-emerald-500/5 to-transparent",
    accentColor: "text-green-600 bg-green-500/10",
    subsections: [
      { id: "inventory-rca", name: "Root Cause Analysis", description: "Diagnose stock issues" },
      { id: "availability", name: "Availability Check", description: "Real-time stock levels" },
      { id: "promising", name: "What-if Analysis", description: "Scenario planning" },
    ],
  },
  {
    id: "functional-health",
    title: "Fulfillment Health",
    icon: "💚",
    description: "Real-time fulfillment performance and KPIs",
    gradient: "from-purple-500/10 via-violet-500/5 to-transparent",
    accentColor: "text-purple-600 bg-purple-500/10",
    subsections: [
      { id: "orders-delayed", name: "Delayed Orders", description: "Track late shipments" },
      { id: "at-risk", name: "At-Risk Orders", description: "Predictive alerts" },
      { id: "fill-rate", name: "Fill Rate (48h)", description: "Fulfillment metrics" },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    icon: "⚙️",
    description: "System configuration, access control, and monitoring",
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    accentColor: "text-amber-600 bg-amber-500/10",
    subsections: [
      { id: "rbac", name: "Access Control", description: "Manage user permissions" },
      { id: "updates", name: "System Updates", description: "Version management" },
      { id: "observability", name: "Observability", description: "System monitoring" },
      { id: "billing", name: "Billing", description: "Usage and billing" },
    ],
  },
];

export default function DashboardHome() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSectionClick = (sectionId: string) => {
    router.push(`/chat?section=${sectionId}`);
  };

  const handleSubsectionClick = (subsectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/chat?section=${subsectionId}`);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-purple-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">◆</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Orbiter</h1>
              <p className="text-xs text-slate-500 leading-none">Order & Inventory Intelligence</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm mt-3">Unified platform for order management, inventory insights, and operational excellence</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Sections Grid */}
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              onMouseEnter={() => setHoveredId(section.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleSectionClick(section.id)}
              className="group cursor-pointer"
            >
              {/* Section Card */}
              <div className={`relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br ${section.gradient} backdrop-blur-sm transition-all duration-500 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 p-8`}>

                {/* Content Grid */}
                <div className="flex items-start justify-between gap-8">
                  {/* Left: Title & Description */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-3">
                      <div className={`text-5xl flex-shrink-0 transition-transform duration-300 ${hoveredId === section.id ? "scale-110" : ""}`}>
                        {section.icon}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900 mb-1">{section.title}</h2>
                        <p className="text-slate-600 text-sm leading-relaxed">{section.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Arrow */}
                  <div className="flex-shrink-0 mt-2">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      hoveredId === section.id
                        ? `${section.accentColor} shadow-md`
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      <svg className="w-6 h-6 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Subsections */}
                {section.subsections && section.subsections.length > 0 && (
                  <div className={`mt-6 pt-6 border-t border-slate-200/50 transition-all duration-500 ${
                    hoveredId === section.id ? "opacity-100" : "opacity-70"
                  }`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {section.subsections.map((subsection) => (
                        <button
                          key={subsection.id}
                          onClick={(e) => handleSubsectionClick(subsection.id, e)}
                          className={`group/sub text-left px-4 py-3 rounded-xl border transition-all duration-300 ${section.accentColor} border-current border-opacity-20 hover:border-opacity-40 hover:shadow-md active:scale-95`}
                        >
                          <p className="font-semibold text-sm">{subsection.name}</p>
                          {subsection.description && (
                            <p className="text-xs opacity-70 mt-0.5">{subsection.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Features Section */}
        <div className="mt-20 pt-12 border-t border-slate-200/50">
          <h3 className="text-lg font-semibold text-slate-900 mb-8">Why Orbiter?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Get answers in seconds with AI-powered query generation and instant data retrieval"
              },
              {
                icon: "🎯",
                title: "Intelligent Insights",
                description: "Automated root cause analysis and predictive alerts to prevent issues before they happen"
              },
              {
                icon: "🔐",
                title: "Enterprise Grade",
                description: "Secure, scalable platform with comprehensive access controls and audit trails"
              }
            ].map((feature, idx) => (
              <div key={idx} className="group rounded-xl border border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-transparent p-6 hover:border-slate-300 hover:shadow-lg transition-all duration-300">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                <h4 className="font-semibold text-slate-900 mb-2">{feature.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200/50 bg-gradient-to-b from-white to-slate-50/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-xs text-slate-500 text-center">Orbiter • Enterprise Order & Inventory Management Platform</p>
        </div>
      </footer>
    </div>
  );
}
