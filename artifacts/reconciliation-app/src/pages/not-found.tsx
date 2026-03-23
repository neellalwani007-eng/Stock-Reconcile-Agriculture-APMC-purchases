import { Link } from "wouter";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-3xl mx-auto flex items-center justify-center rotate-12 shadow-lg border border-destructive/20">
          <AlertTriangle className="w-10 h-10 -rotate-12" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-display font-bold text-foreground tracking-tight">404</h1>
          <p className="text-xl font-medium text-muted-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground/80">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link href="/" className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all active:scale-95">
          <Home className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
