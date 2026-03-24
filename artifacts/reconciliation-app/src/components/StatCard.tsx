import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  variant?: "default" | "success" | "warning" | "destructive";
}

export function StatCard({ title, value, icon, description, variant = "default" }: StatCardProps) {

  const colors = {
    default:     "text-primary bg-primary/20",
    success:     "text-emerald-400 bg-emerald-900/40",
    warning:     "text-amber-400 bg-amber-900/40",
    destructive: "text-rose-400 bg-rose-900/40",
  };

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-display font-bold text-foreground mt-2">{value}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className={cn("p-4 rounded-xl", colors[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
