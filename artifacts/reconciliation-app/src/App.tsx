import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import { ArrowRightLeft, Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function LoginPage() {
  const { login } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d2818] via-[#1a4731] to-[#0d2818] flex flex-col items-center justify-between py-20 px-6">
      {/* Top — logo & tagline */}
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
          <ArrowRightLeft className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Stock Reconciler</h1>
        <p className="text-white/60 text-sm max-w-[260px]">
          Automated agricultural matching &amp; precision reconciliations
        </p>
      </div>

      {/* Middle — feature pills */}
      <div className="flex flex-row flex-wrap items-center justify-center gap-3 w-full">
        {["1-to-1 matching", "Per-user data", "Excel exports"].map((label) => (
          <span key={label} className="bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-white/80 text-xs font-medium">
            {label}
          </span>
        ))}
      </div>

      {/* Bottom — glass login card */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 w-full max-w-sm">
        <h2 className="text-white text-lg font-semibold mb-5 text-center">Sign in to continue</h2>
        <button
          onClick={login}
          className="w-full bg-white text-gray-800 rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-3 hover:bg-gray-100 active:scale-[0.98] transition-all shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            <path d="M1 1h22v22H1z" fill="none"/>
          </svg>
          Sign in with Google
        </button>
        <p className="text-white/40 text-xs text-center mt-4">
          Each user sees only their own data, stored securely and persisted between sessions.
        </p>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
