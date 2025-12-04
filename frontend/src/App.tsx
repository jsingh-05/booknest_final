import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "@/lib/api";
import React from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SearchBooks from "./pages/SearchBooks";
import BookClubs from "./pages/BookClubs";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            <p className="text-xl font-semibold mb-2">Something went wrong</p>
            <p className="text-muted-foreground mb-4">Please refresh or go back to login.</p>
            <a href="/login" className="underline">Return to Login</a>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactNode;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/search" element={<RequireAuth><SearchBooks /></RequireAuth>} />
            <Route path="/clubs" element={<RequireAuth><BookClubs /></RequireAuth>} />
            <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
