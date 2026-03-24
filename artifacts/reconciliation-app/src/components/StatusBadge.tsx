import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let styles = "";

  switch (status) {
    case "Matched":
      styles = "bg-emerald-900/50 text-emerald-300 border-emerald-700/60";
      break;
    case "Pending":
      styles = "bg-amber-900/50 text-amber-300 border-amber-700/60";
      break;
    case "Unmatched":
      styles = "bg-rose-900/50 text-rose-300 border-rose-700/60";
      break;
    case "Extra":
      styles = "bg-blue-900/50 text-blue-300 border-blue-700/60";
      break;
    default:
      styles = "bg-white/10 text-white/70 border-white/20";
  }

  return (
    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm", styles)}>
      {status}
    </span>
  );
}
