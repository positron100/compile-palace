
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { RoomLaptopProvider } from "@/context/RoomLaptopContext";
import { RequireAuth } from "@/components/RequireAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EditorPage from "./pages/EditorPage";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

function AppRoutes() {
  useInactivityLogout();
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/editor/:roomId"
        element={
          <RequireAuth>
            <EditorPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RoomLaptopProvider>
              <AppRoutes />
            </RoomLaptopProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
