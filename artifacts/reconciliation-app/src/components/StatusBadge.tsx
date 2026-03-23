import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let styles = "";
  
  switch (status) {
    case "Matched":
      styles = "bg-emerald-100 text-emerald-800 border-emerald-200";
      break;
    case "Pending":
      styles = "bg-amber-100 text-amber-800 border-amber-200";
      break;
    case "Unmatched":
      styles = "bg-rose-100 text-rose-800 border-rose-200";
      break;
    case "Extra":
      styles = "bg-blue-100 text-blue-800 border-blue-200";
      break;
    default:
      styles = "bg-gray-100 text-gray-800 border-gray-200";
  }

  return (
    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm", styles)}>
      {status}
    </span>
  );
}
