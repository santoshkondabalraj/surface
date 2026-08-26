"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TopNavigation from "./TopNavigation";
import Sidebar from "./Sidebar";
import MainContent from "./MainContent";

export default function DashboardLayout() {
  const [mounted, setMounted] = useState(false);
  const [selectedSection, setSelectedSection] = useState("functional-health");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top Navigation */}
      <TopNavigation onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
          isOpen={sidebarOpen}
        />

        {/* Main Content Area */}
        <MainContent selectedSection={selectedSection} />
      </div>
    </div>
  );
}
