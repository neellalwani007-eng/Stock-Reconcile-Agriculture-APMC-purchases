import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import { ArrowRightLeft, Loader2, CheckCircle2, Lock, FileSpreadsheet } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const features = [
  {
    icon: CheckCircle2,
    title: "1-to-1 Matching",
    desc: "Every sale matched to exact purchase lot",
  },
  {
    icon: Lock,
    title: "Per-user Data",
    desc: "Your data, only visible to you",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Export",
    desc: "6 ready-to-use report formats",
  },
];

function LoginPage() {
  const { login } = useAuth();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-20 px-6 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #1a4731 0%, #0d2818 55%, #071910 100%)" }}
    >
      {/* Dot-grid background overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Top — logo & tagline */}
      <div className="flex flex-col items-center text-center z-10">
        {/* Glow ring around logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-2xl bg-emerald-400/30 blur-xl scale-110" />
          <div className="relative w-20 h-20 bg-white/15 border border-white/25 rounded-2xl flex items-center justify-center shadow-lg">
            <ArrowRightLeft className="w-9 h-9 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Stock Reconciler</h1>
        <p className="text-white/60 text-sm max-w-[280px]">
          Automate reconciliation in seconds
        </p>
      </div>

      {/* Middle — feature cards */}
      <div className="flex flex-row flex-wrap items-stretch justify-center gap-4 w-full max-w-xl z-10">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col items-center text-center bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-4 gap-2 flex-1 min-w-[120px]"
          >
            <Icon className="w-5 h-5 text-emerald-400" />
            <span className="text-white text-xs font-semibold">{title}</span>
            <span className="text-white/50 text-[11px] leading-snug">{desc}</span>
          </div>
        ))}
      </div>

      {/* Bottom — glass login card with soft glow */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Soft glow behind card */}
        <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-2xl scale-105 -z-10" />
        <div className="bg-white/10 backdrop-blur-xl border border-emerald-400/30 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white text-lg font-semibold mb-5 text-center">Sign in to continue</h2>
          <button
            onClick={login}
            className="w-full bg-white text-gray-800 rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-3 hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            Continue with Google
          </button>
          <p className="text-white/40 text-xs text-center mt-4">
            Your data is private, secure, and synced across devices
          </p>
        </div>
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
