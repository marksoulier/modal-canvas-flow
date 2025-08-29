import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { PlanProvider, usePlan } from "./contexts/PlanContext";
import { AuthProvider } from './contexts/AuthContext';
import { useSmallScreenOverlay } from "./hooks/use-mobile";
import React from "react";

const queryClient = new QueryClient();

// Keyboard event handler component
const KeyboardHandler = () => {
  const { undo, redo } = usePlan();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA"].includes(
        (e.target as HTMLElement)?.tagName
      );

      if (!isInput && (e.ctrlKey || e.metaKey)) {
        if (e.key === "z") {
          e.preventDefault(); // prevent browser undo
          undo();
        } else if (e.key === "y" || (e.shiftKey && e.key === "Z")) {
          e.preventDefault(); // prevent browser redo
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return null;
};

// Small Screen Overlay Component - simplified
const SmallScreenOverlay = ({ children }: { children: React.ReactNode }) => {
  const showOverlay = useSmallScreenOverlay();

  // Manage body class to prevent scrolling when overlay is active
  useEffect(() => {
    if (showOverlay) {
      document.body.classList.add('overlay-active');
    } else {
      document.body.classList.remove('overlay-active');
    }

    return () => {
      document.body.classList.remove('overlay-active');
    };
  }, [showOverlay]);

  return (
    <>
      {/* Main content */}
      {children}

      {/* Overlay for small screens */}
      {showOverlay && (
        <div className="small-screen-overlay">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Please Use a Larger Screen
            </h2>
            <p className="text-slate-700 mb-6">
              This application requires a larger screen for the best experience. Please access it from a laptop or desktop computer at:
            </p>
            <p className="font-mono text-slate-600 mb-6">
              www.lever-ai.com
            </p>
            <a
              href="https://www.lever-ai.com"
              className="inline-flex bg-[#03c6fc]/10 hover:bg-[#03c6fc]/20 text-slate-700 px-5 py-2.5 rounded-lg shadow-sm border border-[#03c6fc]/20 hover:border-[#03c6fc]/40 transition-all duration-200 items-center gap-2 text-sm font-medium"
            >
              Visit Lever AI
            </a>
          </div>
        </div>
      )}
    </>
  );
};

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlanProvider>
          <KeyboardHandler />
          <SmallScreenOverlay>
            <Toaster />
            <Sonner />
            <BrowserRouter basename="/">
              <Routes>
                <Route path="/" element={<Index />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SmallScreenOverlay>
        </PlanProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
