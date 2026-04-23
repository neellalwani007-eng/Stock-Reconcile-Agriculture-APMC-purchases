import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightLeft, CheckCircle2, AlertCircle, Download, LayoutDashboard, Clock,
  AlertTriangle, Loader2, RefreshCcw, BarChart3, Trash2, X, Upload, FileSpreadsheet,
  Plus, LogOut, User, CalendarX, ChevronDown, Edit2, Link2, HelpCircle, FileX,
  CheckSquare, Square, TrendingUp, CheckCheck, MessageSquare, Info, Lock, Key,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGetReports } from "@workspace/api-client-react";
import type { ReconciliationResult, SaleRow, PurchaseRow } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────────────────────── */
type AppMode = "upload" | "reports";
type SubState = "trial" | "active" | "warning" | "grace" | "locked";
interface SubscriptionStatus {
  state: SubState;
  canUpload: boolean;
  trialDaysLeft?: number;
  daysRemaining?: number;
  graceDaysLeft?: number;
  expiresOn?: string;
}

interface FileImportResult {
  filename: string;
  type: "sale" | "purchase";
  success: boolean;
  rowCount: number;
  error?: string;
}

interface WhyReason {
  field: string;
  saleValue: string;
  purchaseValue: string;
  ok: boolean;
}

interface WhyCandidate {
  purchaseId?: number;
  saleId?: number;
  billDate?: string;
  saleDate?: string;
  reasons: WhyReason[];
  matchScore: number;
}

/* ── Constants & helpers ─────────────────────────────────────────────────────── */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getCurrentFY(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}
function getAvailableFYs(): string[] {
  const currentStart = parseInt(getCurrentFY().split("-")[0]);
  const fys: string[] = [];
  for (let y = 2020; y <= currentStart; y++) fys.push(`${y}-${String(y + 1).slice(-2)}`);
  return fys;
}
function getFYFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}
function monthKey(dateStr: string) { return dateStr ? dateStr.slice(0, 7) : ""; }
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}
function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function filterResultByFY(result: ReconciliationResult, fy: string): ReconciliationResult {
  const sales = result.salesRows.filter((r) => getFYFromDate(r.saleDate) === fy);
  const purchases = result.purchaseRows.filter((r) => getFYFromDate(r.billDate) === fy);
  const matchedCount = sales.filter((r) => r.status === "Matched").length;
  const pendingCount = sales.filter((r) => r.status === "Pending").length;
  const unmatchedPurchaseCount = purchases.filter((r) => r.status !== "Matched").length;
  type SE = { salesQty: number; salesAmount: number; purchaseQty: number; purchaseAmount: number; pendingQty: number; pendingAmount: number };
  const map = new Map<string, SE>();
  const ge = (item: string) => map.get(item) ?? (map.set(item, { salesQty:0,salesAmount:0,purchaseQty:0,purchaseAmount:0,pendingQty:0,pendingAmount:0 }), map.get(item)!);
  for (const s of sales) { const e=ge(s.item); e.salesQty+=s.qty; e.salesAmount+=s.amount; if(s.status==="Pending"){e.pendingQty+=s.qty;e.pendingAmount+=s.amount;} }
  for (const p of purchases) { const e=ge(p.item); e.purchaseQty+=p.qty; e.purchaseAmount+=p.amount; }
  const summary = Array.from(map.entries()).map(([item, d]) => ({ item, ...d }));
  return { salesRows: sales, purchaseRows: purchases, matchedCount, pendingCount, unmatchedPurchaseCount, summary };
}

function filterResultByMonths(result: ReconciliationResult, months: string[]): ReconciliationResult {
  if (!months.length) return result;
  const sales = result.salesRows.filter((r) => months.includes(monthKey(r.saleDate)));
  const purchases = result.purchaseRows.filter((r) => months.includes(monthKey(r.billDate)));
  const matchedCount = sales.filter((r) => r.status === "Matched").length;
  const pendingCount = sales.filter((r) => r.status === "Pending").length;
  const unmatchedPurchaseCount = purchases.filter((r) => r.status !== "Matched").length;
  type SE = { salesQty: number; salesAmount: number; purchaseQty: number; purchaseAmount: number; pendingQty: number; pendingAmount: number };
  const map = new Map<string, SE>();
  const ge = (item: string) => map.get(item) ?? (map.set(item, { salesQty:0,salesAmount:0,purchaseQty:0,purchaseAmount:0,pendingQty:0,pendingAmount:0 }), map.get(item)!);
  for (const s of sales) { const e=ge(s.item); e.salesQty+=s.qty; e.salesAmount+=s.amount; if(s.status==="Pending"){e.pendingQty+=s.qty;e.pendingAmount+=s.amount;} }
  for (const p of purchases) { const e=ge(p.item); e.purchaseQty+=p.qty; e.purchaseAmount+=p.amount; }
  const summary = Array.from(map.entries()).map(([item, d]) => ({ item, ...d }));
  return { salesRows: sales, purchaseRows: purchases, matchedCount, pendingCount, unmatchedPurchaseCount, summary };
}

/* ── API helpers ─────────────────────────────────────────────────────────────── */
async function apiFetch(path: string, opts?: RequestInit): Promise<ReconciliationResult> {
  const res = await fetch(`${BASE}/api/reconciliation${path}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    if (res.status === 401 && body.error === "reauth_required") {
      window.location.href = `${BASE}/api/login`;
      return new Promise<ReconciliationResult>(() => {});
    }
    throw new Error(body.error || "Request failed");
  }
  return res.json() as Promise<ReconciliationResult>;
}

async function apiJson<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/reconciliation${path}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    if (res.status === 401 && body.error === "reauth_required") {
      window.location.href = `${BASE}/api/login`;
      return new Promise<T>(() => {});
    }
    throw new Error(body.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

/* ── Downloads hook ──────────────────────────────────────────────────────────── */
function useReconciliationDownloads() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const handleDownload = async (fileType: string, filename: string, fy?: string) => {
    try {
      setDownloading(fileType);
      const res = await fetch(`${BASE}/api/reconciliation/download/${fileType}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ fy }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { alert("Failed to download file. Please try again."); }
    finally { setDownloading(null); }
  };
  return { handleDownload, downloading };
}

/* ── File Import Results Banner ──────────────────────────────────────────────── */
function FileImportBanner({ results, onClose }: { results: FileImportResult[]; onClose: () => void }) {
  const failed = results.filter((r) => !r.success);
  const succeeded = results.filter((r) => r.success);
  const totalRows = succeeded.reduce((sum, r) => sum + r.rowCount, 0);
  const allFailed = failed.length === results.length;
  const anyFailed = failed.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      className={cn("rounded-xl border bg-card/80 backdrop-blur overflow-hidden",
        allFailed ? "border-destructive/40" : anyFailed ? "border-amber-500/40" : "border-green-500/30")}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            Import Results — {results.length} file{results.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center space-x-1.5">
            {succeeded.length > 0 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>{succeeded.length} ok</span>
              </span>
            )}
            {failed.length > 0 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                <span>{failed.length} failed</span>
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="divide-y divide-border/50">
        {succeeded.map((r, i) => (
          <div key={i} className="flex items-start space-x-3 px-5 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{r.filename}</p>
              <p className="text-xs text-muted-foreground">{r.type === "sale" ? "Sales" : "Purchase"} · {r.rowCount} row{r.rowCount !== 1 ? "s" : ""} imported</p>
            </div>
            <span className="text-xs font-semibold text-green-400 shrink-0 mt-0.5">{r.rowCount}r</span>
          </div>
        ))}
        {failed.map((r, i) => (
          <div key={i} className="flex items-start space-x-3 px-5 py-3 bg-destructive/5">
            <FileX className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive truncate">{r.filename}</p>
              <p className="text-xs text-muted-foreground">{r.type === "sale" ? "Sales" : "Purchase"} · {r.error}</p>
            </div>
            <span className="text-xs font-semibold text-destructive shrink-0 mt-0.5">Error</span>
          </div>
        ))}
      </div>
      {succeeded.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-muted/30 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {totalRows} total row{totalRows !== 1 ? "s" : ""} imported across {succeeded.length} file{succeeded.length !== 1 ? "s" : ""}
          </span>
          {anyFailed && (
            <span className="text-xs text-amber-400 font-medium flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{failed.length} file{failed.length !== 1 ? "s" : ""} skipped</span>
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ── Monthly Chart ───────────────────────────────────────────────────────────── */
function MonthlyChart({ data, selectedMonths }: { data: ReconciliationResult; selectedMonths: string[] }) {
  const [chartMode, setChartMode] = useState<"qty" | "amount">("qty");
  const isDayWise = selectedMonths.length === 1;

  const chartData = useMemo(() => {
    if (isDayWise) {
      const map = new Map<string, { label: string; matched: number; pending: number }>();
      for (const s of data.salesRows) {
        const day = s.saleDate ? s.saleDate.slice(8, 10) : "";
        if (!day) continue;
        const entry = map.get(day) ?? { label: day, matched: 0, pending: 0 };
        const val = chartMode === "qty" ? s.qty : s.amount;
        if (s.status === "Matched") entry.matched += val;
        else entry.pending += val;
        map.set(day, entry);
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
    } else {
      const map = new Map<string, { month: string; matched: number; pending: number }>();
      for (const s of data.salesRows) {
        const mk = monthKey(s.saleDate);
        if (!mk) continue;
        const entry = map.get(mk) ?? { month: monthLabel(mk), matched: 0, pending: 0 };
        const val = chartMode === "qty" ? s.qty : s.amount;
        if (s.status === "Matched") entry.matched += val;
        else entry.pending += val;
        map.set(mk, entry);
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
    }
  }, [data, chartMode, isDayWise]);

  if (chartData.length === 0) return null;

  const xKey = isDayWise ? "label" : "month";
  const xLabel = isDayWise ? `Day (${monthLabel(selectedMonths[0])})` : "";

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isDayWise ? `Day-wise Summary — ${monthLabel(selectedMonths[0])}` : "Monthly Matched vs Pending"}
          </h3>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["qty", "amount"] as const).map((m) => (
            <button key={m} onClick={() => setChartMode(m)}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors",
                chartMode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              {m === "qty" ? "Qty" : "Amount"}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false} tickLine={false}
            label={xLabel ? { value: xLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" } : undefined} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48}
            tickFormatter={(v) => chartMode === "amount" ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(v: number) => chartMode === "amount" ? [formatCurrency(v), undefined] : [v.toFixed(2), undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="matched" name="Matched" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" name="Pending" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Multi-Month Dropdown ────────────────────────────────────────────────────── */
function MultiMonthDropdown({ months, selected, onChange }: {
  months: string[];
  selected: string[];
  onChange: (months: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = selected.length === 0
    ? "All Months"
    : selected.length === 1
    ? monthLabel(selected[0])
    : `${selected.length} months`;

  const toggle = (m: string) => {
    onChange(selected.includes(m) ? selected.filter((s) => s !== m) : [...selected, m]);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="appearance-none bg-muted/50 hover:bg-muted border border-border text-foreground text-sm font-medium pl-3 pr-8 py-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary flex items-center space-x-1">
        <span>{label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground absolute right-2.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl min-w-[170px] overflow-hidden">
            <div className="p-1.5 max-h-64 overflow-y-auto">
              <button onClick={() => { onChange([]); setOpen(false); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted rounded-lg flex items-center justify-between transition-colors">
                <span className="font-medium">All Months</span>
                {selected.length === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
              <div className="border-t border-border/50 my-1" />
              {months.map((m) => (
                <button key={m} onClick={() => toggle(m)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-muted rounded-lg flex items-center justify-between transition-colors">
                  <span>{monthLabel(m)}</span>
                  {selected.includes(m)
                    ? <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                    : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Shared form field styles ─────────────────────────────────────────────────── */
const inputCls = "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors text-sm";

/* ── Note Modal ───────────────────────────────────────────────────────────────── */
function NoteModal({ purchaseId, initialNote, onClose, onSaved }: {
  purchaseId: number;
  initialNote: string;
  onClose: () => void;
  onSaved: (id: number, note: string) => void;
}) {
  const [text, setText] = useState(initialNote);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      await apiJson<{ ok: boolean; note: string }>(`/records/purchase/${purchaseId}/note`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      });
      onSaved(purchaseId, text.trim());
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save note"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg"><MessageSquare className="w-5 h-5 text-primary" /></div>
            <h3 className="font-bold text-lg text-foreground">Add / Edit Note</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Enter your note for this purchase record..."
            className={cn(inputCls, "resize-none")}
          />
          {text.trim() && (
            <button onClick={() => setText("")} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              Clear note
            </button>
          )}
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            <span>{loading ? "Saving..." : "Save Note"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Lot Info Modal ───────────────────────────────────────────────────────────── */
function LotInfoModal({ row, onClose }: { row: SaleRow; onClose: () => void }) {
  const hasInfo = row.kpNo || row.farmerName || row.village;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Info className="w-5 h-5 text-blue-400" /></div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Lot Information</h3>
              <p className="text-xs text-muted-foreground">{row.item} · {formatDate(row.saleDate)} · {row.qty} QTL</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6">
          {hasInfo ? (
            <div className="space-y-3">
              {[["KP No.", row.kpNo], ["Farmer Name", row.farmerName], ["Village", row.village]].map(([label, val]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold text-foreground">{val || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No additional information available for this lot.</p>
          )}
        </div>
        <div className="p-6 pt-0">
          <button onClick={onClose} className="w-full px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Close</button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Delete by Date Modal ─────────────────────────────────────────────────────── */
function DeleteByDateModal({ salesDates, purchaseDates, onClose, onSuccess, userEmail }: {
  salesDates: string[]; purchaseDates: string[];
  onClose: () => void; onSuccess: (data: ReconciliationResult) => void;
  userEmail?: string;
}) {
  type ModalView = "delete" | "change-password" | "forgot-password";
  const [view, setView] = useState<ModalView>("delete");
  const [type, setType] = useState<"sale" | "purchase">("sale");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const dates = type === "sale" ? salesDates : purchaseDates;

  const toggleDate = (d: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedDates.size === dates.length) setSelectedDates(new Set());
    else setSelectedDates(new Set(dates));
  };

  const handleDelete = async () => {
    if (selectedDates.size === 0 || !password) { setError("Select at least one date and enter the password."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/records/date", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [...selectedDates], type, password }),
      });
      onSuccess(data);
      setSuccessMsg(`${selectedDates.size} date(s) deleted.`);
      setSelectedDates(new Set()); setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) { setError("Fill in all fields."); return; }
    if (newPw !== confirmPw) { setError("New passwords do not match."); return; }
    setError(""); setLoading(true);
    try {
      await apiJson<{ ok: boolean }>("/settings/delete-password", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      setSuccessMsg("Password changed successfully."); setView("delete");
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    setError(""); setLoading(true);
    try {
      await apiJson<{ ok: boolean }>("/settings/reset-delete-password", { method: "POST" });
      setSuccessMsg("Password reset to default 'confirm'."); setView("delete");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              {view === "delete" ? <CalendarX className="w-5 h-5 text-destructive" /> :
               view === "change-password" ? <Key className="w-5 h-5 text-amber-400" /> :
               <Lock className="w-5 h-5 text-blue-400" />}
            </div>
            <h3 className="font-bold text-lg text-foreground">
              {view === "delete" ? "Delete by Date" : view === "change-password" ? "Change Password" : "Reset Password"}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Main delete view */}
        {view === "delete" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Record type toggle */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Record Type</label>
                <div className="flex rounded-xl overflow-hidden border border-border">
                  {(["sale","purchase"] as const).map((t) => (
                    <button key={t} onClick={() => { setType(t); setSelectedDates(new Set()); }}
                      className={cn("flex-1 px-4 py-2.5 text-sm font-medium transition-colors capitalize",
                        type === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                      {t === "sale" ? "Sales" : "Purchases"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Select Dates</label>
                  {dates.length > 0 && (
                    <button onClick={toggleAll} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                      {selectedDates.size === dates.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
                {dates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No {type} dates available.</p>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {dates.map((d) => (
                      <label key={d} className={cn("flex items-center space-x-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-0",
                        selectedDates.has(d) && "bg-destructive/5")}>
                        <input type="checkbox" checked={selectedDates.has(d)} onChange={() => toggleDate(d)}
                          className="w-4 h-4 accent-primary rounded" />
                        <span className="text-sm text-foreground">{formatDate(d)}</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedDates.size > 0 && (
                  <p className="text-xs text-destructive font-medium">{selectedDates.size} date(s) selected</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Delete Password</span>
                  </label>
                  <button onClick={() => { setView("change-password"); setError(""); setSuccessMsg(""); }}
                    className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                    Change Password
                  </button>
                </div>
                <input type="password" placeholder="Enter delete password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDelete()}
                  className={inputCls} />
                <button onClick={() => { setView("forgot-password"); setError(""); setSuccessMsg(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password?
                </button>
              </div>

              {successMsg && <p className="text-sm text-green-400 flex items-center space-x-1"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{successMsg}</span></p>}
              {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
            </div>
            <div className="flex space-x-3 p-6 pt-0 shrink-0 border-t border-border">
              <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Close</button>
              <button onClick={handleDelete} disabled={selectedDates.size === 0 || !password || loading}
                className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{loading ? "Deleting..." : `Delete${selectedDates.size > 0 ? ` (${selectedDates.size})` : ""}`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Change password view */}
        {view === "change-password" && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Default password is <code className="bg-muted px-1 rounded text-xs">confirm</code>.</p>
            <div className="space-y-3">
              {[["Current Password", oldPw, setOldPw], ["New Password", newPw, setNewPw], ["Confirm New Password", confirmPw, setConfirmPw]].map(([label, val, setter]) => (
                <div key={String(label)} className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{String(label)}</label>
                  <input type="password" value={String(val)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={inputCls} />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
            <div className="flex space-x-3 pt-2">
              <button onClick={() => { setView("delete"); setError(""); }} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Back</button>
              <button onClick={handleChangePassword} disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-500/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                <span>{loading ? "Saving..." : "Change Password"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Forgot password view */}
        {view === "forgot-password" && (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-sm text-blue-300 font-medium mb-1">Account verified</p>
              <p className="text-xs text-muted-foreground">
                Since you are logged in as <strong className="text-foreground">{userEmail || "your Google account"}</strong>, we can reset your delete password to the default.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              This will reset the delete password back to <code className="bg-muted px-1 rounded text-xs">confirm</code>.
            </p>
            {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
            <div className="flex space-x-3">
              <button onClick={() => { setView("delete"); setError(""); }} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Back</button>
              <button onClick={handleResetPassword} disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{loading ? "Resetting..." : "Reset Password"}</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Reusable Sale Form Fields ─────────────────────────────────────────────────── */
function SaleFormFields({ form, onChange, amountManual, onAmountChange }: {
  form: { saleDate: string; item: string; qty: string; rate: string; amount: string; kpNo?: string; farmerName?: string; village?: string };
  onChange: (k: string, v: string) => void;
  amountManual: boolean;
  onAmountChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sale Date</label>
        <input type="date" value={form.saleDate} onChange={(e) => onChange("saleDate", e.target.value)} className={inputCls} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item / Commodity</label>
        <input type="text" placeholder="e.g. Onion" value={form.item} onChange={(e) => onChange("item", e.target.value)} className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty (QTL)</label>
        <input type="number" step="0.01" placeholder="0.00" value={form.qty} onChange={(e) => onChange("qty", e.target.value)} className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</label>
        <input type="number" step="0.01" placeholder="0.00" value={form.rate} onChange={(e) => onChange("rate", e.target.value)} className={inputCls} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
          <span>Amount</span>
          {!amountManual && form.qty && form.rate && <span className="text-[10px] text-primary font-normal normal-case">Auto-calculated · editable</span>}
        </label>
        <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => onAmountChange(e.target.value)} className={inputCls} />
      </div>
      {/* Optional fields */}
      <div className="col-span-2 border-t border-border/50 pt-3 space-y-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Optional — Lot Details</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KP No.</label>
        <input type="text" placeholder="e.g. KP001" value={form.kpNo ?? ""} onChange={(e) => onChange("kpNo", e.target.value)} className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Village</label>
        <input type="text" placeholder="e.g. Nashik" value={form.village ?? ""} onChange={(e) => onChange("village", e.target.value)} className={inputCls} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Farmer Name</label>
        <input type="text" placeholder="e.g. Rajesh Patil" value={form.farmerName ?? ""} onChange={(e) => onChange("farmerName", e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

/* ── Add Sale Modal ──────────────────────────────────────────────────────────── */
function AddSaleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({ saleDate: "", item: "", qty: "", rate: "", amount: "", kpNo: "", farmerName: "", village: "" });
  const [amountManual, setAmountManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if ((key === "qty" || key === "rate") && !amountManual) {
        const q = parseFloat(key === "qty" ? value : f.qty), r = parseFloat(key === "rate" ? value : f.rate);
        if (!isNaN(q) && !isNaN(r)) next.amount = (q * r).toFixed(2); else next.amount = "";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.saleDate || !form.item || !form.qty || !form.rate || !form.amount) { setError("Sale Date, Item, Qty, Rate, Amount are required."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/records/sale", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleDate: form.saleDate, item: form.item.trim(),
          qty: parseFloat(form.qty), rate: parseFloat(form.rate), amount: parseFloat(form.amount),
          kpNo: form.kpNo.trim() || undefined, farmerName: form.farmerName.trim() || undefined, village: form.village.trim() || undefined,
        }),
      });
      onSuccess(data); setSuccessMsg(`Sale added for ${formatDate(form.saleDate)}.`);
      setForm({ saleDate: "", item: "", qty: "", rate: "", amount: "", kpNo: "", farmerName: "", village: "" }); setAmountManual(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Plus className="w-5 h-5 text-primary" /></div>
            <h3 className="font-bold text-lg text-foreground">Add Sale Record</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <SaleFormFields form={form} onChange={handleChange} amountManual={amountManual} onAmountChange={(v) => { setAmountManual(true); setForm((f) => ({ ...f, amount: v })); }} />
          {successMsg && <p className="text-sm text-green-400">✓ {successMsg}</p>}
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0 shrink-0 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Close</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{loading ? "Adding..." : "Add Sale"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Edit Sale Modal ─────────────────────────────────────────────────────────── */
function EditSaleModal({ row, onClose, onSuccess }: { row: SaleRow; onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({
    saleDate: row.saleDate, item: row.item,
    qty: String(row.qty), rate: String(row.rate), amount: String(row.amount),
    kpNo: row.kpNo ?? "", farmerName: row.farmerName ?? "", village: row.village ?? "",
  });
  const [amountManual, setAmountManual] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if ((key === "qty" || key === "rate") && !amountManual) {
        const q = parseFloat(key === "qty" ? value : f.qty), r = parseFloat(key === "rate" ? value : f.rate);
        if (!isNaN(q) && !isNaN(r)) next.amount = (q * r).toFixed(2);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.saleDate || !form.item || !form.qty || !form.rate || !form.amount) { setError("All required fields are needed."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch(`/records/sale/${row.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleDate: form.saleDate, item: form.item.trim(),
          qty: parseFloat(form.qty), rate: parseFloat(form.rate), amount: parseFloat(form.amount),
          kpNo: form.kpNo.trim() || undefined, farmerName: form.farmerName.trim() || undefined, village: form.village.trim() || undefined,
        }),
      });
      onSuccess(data); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><Edit2 className="w-5 h-5 text-amber-500" /></div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Edit Sale Record</h3>
              <p className="text-xs text-muted-foreground">Changes will trigger re-matching</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <SaleFormFields form={form} onChange={handleChange} amountManual={amountManual} onAmountChange={(v) => { setAmountManual(true); setForm((f) => ({ ...f, amount: v })); }} />
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0 shrink-0 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-500/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
            <span>{loading ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Add Purchase Modal ──────────────────────────────────────────────────────── */
function AddPurchaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({ billDate: "", purchaseDate: "", item: "", qty: "", rate: "", amount: "" });
  const [amountManual, setAmountManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if ((key === "qty" || key === "rate") && !amountManual) {
        const q = parseFloat(key === "qty" ? value : f.qty), r = parseFloat(key === "rate" ? value : f.rate);
        if (!isNaN(q) && !isNaN(r)) next.amount = (q * r).toFixed(2); else next.amount = "";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.billDate || !form.purchaseDate || !form.item || !form.qty || !form.rate || !form.amount) { setError("All fields are required."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/records/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billDate: form.billDate, purchaseDate: form.purchaseDate, item: form.item.trim(), qty: parseFloat(form.qty), rate: parseFloat(form.rate), amount: parseFloat(form.amount) }) });
      onSuccess(data); setSuccessMsg(`Purchase added for bill date ${formatDate(form.billDate)}.`);
      setForm({ billDate: "", purchaseDate: "", item: "", qty: "", rate: "", amount: "" }); setAmountManual(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Plus className="w-5 h-5 text-primary" /></div>
            <h3 className="font-bold text-lg text-foreground">Add Purchase Record</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill Date</label><input type="date" value={form.billDate} onChange={(e) => handleChange("billDate", e.target.value)} className={inputCls} /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase Date</label><input type="date" value={form.purchaseDate} onChange={(e) => handleChange("purchaseDate", e.target.value)} className={inputCls} /></div>
            <div className="col-span-2 space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item / Commodity</label><input type="text" placeholder="e.g. Onion" value={form.item} onChange={(e) => handleChange("item", e.target.value)} className={inputCls} /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty (QTL)</label><input type="number" step="0.01" placeholder="0.00" value={form.qty} onChange={(e) => handleChange("qty", e.target.value)} className={inputCls} /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</label><input type="number" step="0.01" placeholder="0.00" value={form.rate} onChange={(e) => handleChange("rate", e.target.value)} className={inputCls} /></div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Amount</span>
                {!amountManual && form.qty && form.rate && <span className="text-[10px] text-primary font-normal normal-case">Auto-calculated</span>}
              </label>
              <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => { setAmountManual(true); handleChange("amount", e.target.value); }} className={inputCls} />
            </div>
          </div>
          {successMsg && <p className="text-sm text-green-400">✓ {successMsg}</p>}
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Close</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{loading ? "Adding..." : "Add Purchase"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Edit Purchase Modal ──────────────────────────────────────────────────────── */
function EditPurchaseModal({ row, onClose, onSuccess }: { row: PurchaseRow; onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({ billDate: row.billDate, purchaseDate: row.purchaseDate, item: row.item, qty: String(row.qty), rate: String(row.rate), amount: String(row.amount) });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.billDate || !form.purchaseDate || !form.item || !form.qty || !form.rate || !form.amount) { setError("All fields are required."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch(`/records/purchase/${row.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billDate: form.billDate, purchaseDate: form.purchaseDate, item: form.item.trim(), qty: parseFloat(form.qty), rate: parseFloat(form.rate), amount: parseFloat(form.amount) }) });
      onSuccess(data); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><Edit2 className="w-5 h-5 text-amber-500" /></div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Edit Purchase Record</h3>
              <p className="text-xs text-muted-foreground">Changes will trigger re-matching</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill Date</label><input type="date" value={form.billDate} onChange={(e) => handleChange("billDate", e.target.value)} className={inputCls} /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase Date</label><input type="date" value={form.purchaseDate} onChange={(e) => handleChange("purchaseDate", e.target.value)} className={inputCls} /></div>
            <div className="col-span-2 space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item / Commodity</label><input type="text" value={form.item} onChange={(e) => handleChange("item", e.target.value)} className={inputCls} /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty</label><input type="number" step="0.01" value={form.qty} onChange={(e) => handleChange("qty", e.target.value)} className={inputCls} /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</label><input type="number" step="0.01" value={form.rate} onChange={(e) => handleChange("rate", e.target.value)} className={inputCls} /></div>
            <div className="col-span-2 space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</label><input type="number" step="0.01" value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} className={inputCls} /></div>
          </div>
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-500/90 disabled:opacity-50 transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
            <span>{loading ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Why Unmatched Modal ─────────────────────────────────────────────────────── */
function WhyUnmatchedModal({ type, row, onClose }: {
  type: "sale" | "purchase";
  row: SaleRow | PurchaseRow;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ globalReason?: string; candidates: WhyCandidate[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson<{ globalReason?: string; candidates: WhyCandidate[] }>("/why-unmatched", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: row.id }),
    }).then((d) => setResult(d)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const label = type === "sale" ? `Sale · ${formatDate((row as SaleRow).saleDate)}` : `Purchase · ${formatDate((row as PurchaseRow).billDate)}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 rounded-lg"><HelpCircle className="w-5 h-5 text-amber-500" /></div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Why Didn't It Match?</h3>
              <p className="text-xs text-muted-foreground">{label} · {row.item} · Qty {row.qty}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result?.globalReason && (
            <div className="p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{result.globalReason}</span>
            </div>
          )}
          {result && result.candidates.length === 0 && !result.globalReason && (
            <p className="text-sm text-muted-foreground text-center py-8">No candidate records found.</p>
          )}
          {result?.candidates.map((c, idx) => (
            <div key={idx} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  {type === "sale" ? `Purchase Candidate #${idx + 1} · Bill Date: ${formatDate(c.billDate!)}` : `Sale Candidate #${idx + 1} · Sale Date: ${formatDate(c.saleDate!)}`}
                </span>
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", c.matchScore >= 4 ? "bg-amber-500/20 text-amber-400" : c.matchScore >= 2 ? "bg-yellow-500/20 text-yellow-400" : "bg-destructive/20 text-destructive")}>
                  {c.matchScore}/5 fields match
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="px-4 py-2 text-left font-medium">Field</th>
                    <th className="px-4 py-2 text-left font-medium">{type === "sale" ? "Sale Value" : "Purchase Value"}</th>
                    <th className="px-4 py-2 text-left font-medium">{type === "sale" ? "Purchase Value" : "Sale Value"}</th>
                    <th className="px-4 py-2 text-center font-medium">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {c.reasons.map((r, ri) => (
                    <tr key={ri} className={cn(!r.ok && "bg-destructive/5")}>
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.field}</td>
                      <td className="px-4 py-2.5 text-foreground">{r.saleValue}</td>
                      <td className="px-4 py-2.5 text-foreground">{r.purchaseValue}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.ok ? <CheckCircle2 className="w-4 h-4 text-green-400 inline" /> : <X className="w-4 h-4 text-destructive inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="p-6 pt-0 shrink-0">
          <button onClick={onClose} className="w-full px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Close</button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Manual Match Modal ──────────────────────────────────────────────────────── */
function ManualMatchModal({ sale, allData, onClose, onSuccess }: {
  sale: SaleRow;
  allData: ReconciliationResult;
  onClose: () => void;
  onSuccess: (data: ReconciliationResult) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [saleCorr, setSaleCorr] = useState<Record<string, string>>({});
  const [purCorr, setPurCorr] = useState<Record<string, string>>({});
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [purchaseSearch, setPurchaseSearch] = useState("");

  const unmatchedPurchases = allData.purchaseRows.filter((p) => p.status !== "Matched");

  const closeMatches = useMemo(() => {
    const saleItemNorm = sale.item.trim().toLowerCase();
    return unmatchedPurchases.map((p) => {
      let score = 0;
      if (p.item.trim().toLowerCase() === saleItemNorm) score++;
      if (p.purchaseDate === sale.saleDate) score++;
      if (p.qty === sale.qty) score++;
      if (p.rate === sale.rate) score++;
      if (Math.abs(p.amount - sale.amount) <= 0.02) score++;
      return { ...p, matchScore: score };
    }).filter((p) => p.matchScore >= 3).sort((a, b) => b.matchScore - a.matchScore);
  }, [unmatchedPurchases, sale]);

  const filteredPurchases = unmatchedPurchases.filter((p) =>
    !purchaseSearch ||
    p.item.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
    formatDate(p.billDate).includes(purchaseSearch) ||
    String(p.qty).includes(purchaseSearch)
  );

  const saleVal = (field: string) => saleCorr[field] ?? String((sale as Record<string, unknown>)[field] ?? "");
  const purVal = (field: string) => {
    if (!selectedPurchase) return "";
    return purCorr[field] ?? String((selectedPurchase as Record<string, unknown>)[field] ?? "");
  };

  const fields: { key: string; label: string; saleKey?: string; purKey?: string }[] = [
    { key: "item",   label: "Item",   saleKey: "item",     purKey: "item" },
    { key: "date",   label: "Date",   saleKey: "saleDate", purKey: "purchaseDate" },
    { key: "qty",    label: "Qty",    saleKey: "qty",      purKey: "qty" },
    { key: "rate",   label: "Rate",   saleKey: "rate",     purKey: "rate" },
    { key: "amount", label: "Amount", saleKey: "amount",   purKey: "amount" },
  ];

  const isMatch = (f: typeof fields[0]) => {
    const sv = saleVal(f.saleKey!);
    const pv = purVal(f.purKey!);
    if (f.key === "amount") return Math.abs(parseFloat(sv) - parseFloat(pv)) <= 0.02;
    return sv.toLowerCase() === pv.toLowerCase();
  };

  const handleConfirm = async () => {
    if (!selectedPurchase) return;
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/manual-match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id, purchaseId: selectedPurchase.id,
          saleCorrections: Object.keys(saleCorr).length ? saleCorr : undefined,
          purchaseCorrections: Object.keys(purCorr).length ? purCorr : undefined,
        }),
      });
      onSuccess(data); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const purchaseRowCls = "hover:bg-muted/20";
  const selectBtn = (p: PurchaseRow) => (
    <button onClick={() => { setSelectedPurchase(p); setStep(2); }}
      className="px-3 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors">
      Select
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Link2 className="w-5 h-5 text-primary" /></div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Manual Match</h3>
              <p className="text-xs text-muted-foreground">Sale · {formatDate(sale.saleDate)} · {sale.item} · {sale.qty} QTL</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {[1, 2].map((s) => (
                <span key={s} className={cn("px-2 py-1 rounded-full font-medium",
                  step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  Step {s}
                </span>
              ))}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-5 border-b border-border shrink-0 space-y-3">
              <p className="text-sm font-medium text-foreground">Select an unmatched purchase to link with this sale:</p>
              <input type="text" placeholder="Search by item, date, qty…" value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                className={cn(inputCls, "max-w-xs")} />
            </div>
            <div className="overflow-y-auto flex-1">
              {closeMatches.length > 0 && !purchaseSearch && (
                <div>
                  <div className="px-4 py-2 bg-amber-500/10 border-b border-border flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Close Matches ({closeMatches.length})</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase bg-amber-500/5 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Score</th>
                        <th className="px-4 py-2 text-left">Bill Date</th>
                        <th className="px-4 py-2 text-left text-primary">Purchase Date</th>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {closeMatches.map((p) => (
                        <tr key={p.id} className={cn(purchaseRowCls, "bg-amber-500/5")}>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                              p.matchScore === 5 ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400")}>
                              {p.matchScore}/5
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.billDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDate(p.purchaseDate)}</td>
                          <td className="px-4 py-3">{p.item}</td>
                          <td className="px-4 py-3 text-right">{p.qty.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{p.rate}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3">{selectBtn(p)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 bg-muted/30 border-b border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Unmatched</span>
                  </div>
                </div>
              )}
              {filteredPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No unmatched purchases found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Bill Date</th>
                      <th className="px-4 py-3 text-left text-primary">Purchase Date</th>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredPurchases.map((p) => (
                      <tr key={p.id} className={purchaseRowCls}>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.billDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDate(p.purchaseDate)}</td>
                        <td className="px-4 py-3">{p.item}</td>
                        <td className="px-4 py-3 text-right">{p.qty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{p.rate}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3">{selectBtn(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-5 border-t border-border shrink-0">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium text-sm">Cancel</button>
            </div>
          </div>
        )}

        {step === 2 && selectedPurchase && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Review the field comparison below. Highlighted rows have mismatches — correct them before locking.</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-3 text-left">Field</th>
                      <th className="px-4 py-3 text-left">Sale Value</th>
                      <th className="px-4 py-3 text-center w-8"></th>
                      <th className="px-4 py-3 text-left">Purchase Value</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {fields.map((f) => {
                      const matched = isMatch(f);
                      const isCorrSale = correcting === `sale-${f.key}`;
                      const isCorrPur = correcting === `pur-${f.key}`;
                      return (
                        <tr key={f.key} className={cn(!matched && "bg-destructive/5")}>
                          <td className="px-4 py-3 font-medium text-foreground">{f.label}</td>
                          <td className="px-4 py-3">
                            {isCorrSale ? (
                              <input autoFocus type="text" value={saleCorr[f.saleKey!] ?? String((sale as Record<string, unknown>)[f.saleKey!] ?? "")}
                                onChange={(e) => setSaleCorr((c) => ({ ...c, [f.saleKey!]: e.target.value }))}
                                onBlur={() => setCorrecting(null)}
                                className="w-full px-2 py-1 text-xs rounded border border-primary bg-background text-foreground focus:outline-none" />
                            ) : (
                              <span className="group flex items-center space-x-1.5">
                                <span className={cn(saleCorr[f.saleKey!] && "text-primary font-medium")}>{saleVal(f.saleKey!)}</span>
                                <button onClick={() => setCorrecting(`sale-${f.key}`)} title="Correct sale value"
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-all">
                                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground text-xs">vs</td>
                          <td className="px-4 py-3">
                            {isCorrPur ? (
                              <input autoFocus type="text" value={purCorr[f.purKey!] ?? String((selectedPurchase as Record<string, unknown>)[f.purKey!] ?? "")}
                                onChange={(e) => setPurCorr((c) => ({ ...c, [f.purKey!]: e.target.value }))}
                                onBlur={() => setCorrecting(null)}
                                className="w-full px-2 py-1 text-xs rounded border border-primary bg-background text-foreground focus:outline-none" />
                            ) : (
                              <span className="group flex items-center space-x-1.5">
                                <span className={cn(purCorr[f.purKey!] && "text-primary font-medium")}>{purVal(f.purKey!)}</span>
                                <button onClick={() => setCorrecting(`pur-${f.key}`)} title="Correct purchase value"
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-all">
                                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {matched ? <CheckCircle2 className="w-4 h-4 text-green-400 inline" /> : <X className="w-4 h-4 text-destructive inline" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(Object.keys(saleCorr).length > 0 || Object.keys(purCorr).length > 0) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                  Corrected values will be saved to the records before locking the match.
                </div>
              )}
              {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
            </div>
            <div className="flex space-x-3 p-6 pt-0 shrink-0 border-t border-border mt-0">
              <button onClick={() => { setStep(1); setSelectedPurchase(null); setSaleCorr({}); setPurCorr({}); }}
                className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium text-sm">
                ← Back
              </button>
              <button onClick={handleConfirm} disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium text-sm flex items-center justify-center space-x-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                <span>{loading ? "Locking..." : "Lock Match"}</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── Results View ────────────────────────────────────────────────────────────── */
type TabId = "all-sales" | "pending" | "purchase";

function ResultsView({ data, onDataChange, selectedFY, selectedMonths, userEmail }: {
  data: ReconciliationResult;
  onDataChange: (d: ReconciliationResult) => void;
  selectedFY: string;
  selectedMonths: string[];
  userEmail?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [showDeleteByDate, setShowDeleteByDate] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [editSaleRow, setEditSaleRow] = useState<SaleRow | null>(null);
  const [editPurchaseRow, setEditPurchaseRow] = useState<PurchaseRow | null>(null);
  const [manualMatchSale, setManualMatchSale] = useState<SaleRow | null>(null);
  const [whyUnmatched, setWhyUnmatched] = useState<{ type: "sale" | "purchase"; row: SaleRow | PurchaseRow } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [noteModal, setNoteModal] = useState<{ id: number; note: string } | null>(null);
  const [lotInfoRow, setLotInfoRow] = useState<SaleRow | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { handleDownload, downloading } = useReconciliationDownloads();

  useEffect(() => {
    apiJson<{ notes: Record<string, string> }>("/notes")
      .then((d) => setNotes(d.notes))
      .catch(() => {});
  }, []);

  useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);

  type SF = { saleDate: string; item: string; qty: string; rate: string; amount: string; billDate: string; status: string };
  const [sf, setSf] = useState<SF>({ saleDate: "", item: "", qty: "", rate: "", amount: "", billDate: "", status: "" });
  type PF = { billDate: string; purchaseDate: string; item: string; qty: string; rate: string; amount: string; status: string };
  const [pf, setPf] = useState<PF>({ billDate: "", purchaseDate: "", item: "", qty: "", rate: "", amount: "", status: "" });
  const matchF = (val: unknown, filter: string) => !filter || String(val ?? "").toLowerCase().includes(filter.toLowerCase());

  const salesDates = [...new Set(data.salesRows.map((r) => r.saleDate))].sort();
  const purchaseDates = [...new Set(data.purchaseRows.map((r) => r.billDate))].sort();

  const handleDeleteRow = async (type: "sale" | "purchase", id: number) => {
    setDeletingId(id);
    try {
      const newData = await apiFetch(`/records/${type}/${id}`, { method: "DELETE" });
      onDataChange(newData);
    } catch { alert("Failed to delete record."); }
    finally { setDeletingId(null); }
  };

  const handleBulkDelete = async (type: "sale" | "purchase") => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected record(s)?`)) return;
    setBulkDeleting(true);
    try {
      const newData = await apiFetch("/records/bulk", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ids: [...selectedIds] }) });
      onDataChange(newData); setSelectedIds(new Set());
    } catch { alert("Failed to delete selected records."); }
    finally { setBulkDeleting(false); }
  };

  const toggleId = (id: number) => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = (ids: number[]) => setSelectedIds((prev) => prev.size === ids.length ? new Set() : new Set(ids));

  const tabs: { id: TabId; label: string; shortLabel: string; count: number; icon: ReactNode }[] = [
    { id: "pending",    label: "Pending Pavati",      shortLabel: "Pending",    count: data.pendingCount,             icon: <Clock className="w-4 h-4" /> },
    { id: "purchase",   label: "Purchase Exceptions", shortLabel: "Purchase",   count: data.unmatchedPurchaseCount,   icon: <AlertCircle className="w-4 h-4" /> },
    { id: "all-sales",  label: "All Sales",           shortLabel: "Sales",      count: data.salesRows.length,          icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const downloadBtns = [
    { fileType: "updated-sales",        label: "Updated Sales",       filename: `updated_sales_${selectedFY}.xlsx` },
    { fileType: "pending-pavati",       label: "Pending Pavati",      filename: `pending_pavati_${selectedFY}.xlsx` },
    { fileType: "datewise-report",      label: "Datewise Report",     filename: `datewise_report_${selectedFY}.xlsx` },
    { fileType: "purchase-exceptions",  label: "Purchase Exceptions", filename: `purchase_exceptions_${selectedFY}.xlsx` },
    { fileType: "monthly-matrix-qty",   label: "Matrix (Qty)",        filename: `monthly_matrix_qty_${selectedFY}.xlsx` },
    { fileType: "monthly-matrix-amount",label: "Matrix (Amount)",     filename: `monthly_matrix_amount_${selectedFY}.xlsx` },
  ];

  const actionBtnCls = "p-1.5 rounded-lg transition-colors disabled:opacity-50";

  const summaryTotals = data.summary.reduce(
    (acc, row) => ({
      salesQty: acc.salesQty + row.salesQty,
      salesAmount: acc.salesAmount + row.salesAmount,
      purchaseQty: acc.purchaseQty + row.purchaseQty,
      purchaseAmount: acc.purchaseAmount + row.purchaseAmount,
      pendingQty: acc.pendingQty + row.pendingQty,
      pendingAmount: acc.pendingAmount + row.pendingAmount,
    }),
    { salesQty: 0, salesAmount: 0, purchaseQty: 0, purchaseAmount: 0, pendingQty: 0, pendingAmount: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} title="Lots Matched" value={data.matchedCount} variant="success" />
        <StatCard icon={<Clock className="w-5 h-5" />} title="Pending Pavati" value={data.pendingCount} variant="warning" />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} title="Unmatched Purchase" value={data.unmatchedPurchaseCount} variant="destructive" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} title="Total Sales" value={data.salesRows.length} variant="default" />
      </div>

      {/* Monthly chart */}
      <MonthlyChart data={data} selectedMonths={selectedMonths} />

      {/* Commodity summary */}
      {data.summary.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Commodity Summary — FY {selectedFY}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                <tr>
                  {["Item","Sales Qty","Sales Amt","Purchase Qty","Purchase Amt","Pending Qty","Pending Amt"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.summary.map((row) => (
                  <tr key={row.item} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.item}</td>
                    <td className="px-4 py-3">{row.salesQty.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.salesAmount)}</td>
                    <td className="px-4 py-3">{row.purchaseQty.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.purchaseAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-400">{row.pendingQty.toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-400">{formatCurrency(row.pendingAmount)}</td>
                  </tr>
                ))}
                {data.summary.length > 1 && (
                  <tr className="bg-primary/5 border-t-2 border-primary/20">
                    <td className="px-4 py-3 font-bold text-foreground">Total</td>
                    <td className="px-4 py-3 font-bold">{summaryTotals.salesQty.toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(summaryTotals.salesAmount)}</td>
                    <td className="px-4 py-3 font-bold">{summaryTotals.purchaseQty.toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(summaryTotals.purchaseAmount)}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">{summaryTotals.pendingQty.toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">{formatCurrency(summaryTotals.pendingAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Downloads */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center space-x-2">
          <Download className="w-4 h-4 text-primary" /><span>Download Reports — FY {selectedFY}</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {downloadBtns.map(({ fileType, label, filename }) => (
            <button key={fileType} onClick={() => handleDownload(fileType, filename, selectedFY)} disabled={!!downloading}
              className="flex items-center space-x-2 px-4 py-3 rounded-xl border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-left">
              {downloading === fileType ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" /> : <FileSpreadsheet className="w-4 h-4 shrink-0 text-primary" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data tables */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border">
          <div className="flex rounded-xl overflow-hidden border border-border w-fit">
            {tabs.map((t, i) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn("flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium transition-colors",
                  i > 0 && "border-l border-border",
                  activeTab === t.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.shortLabel}</span>
                <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  activeTab === t.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {selectedIds.size > 0 && (
              <button onClick={() => handleBulkDelete(activeTab === "purchase" ? "purchase" : "sale")} disabled={bulkDeleting}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-destructive border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors disabled:opacity-50">
                {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete {selectedIds.size} selected</span>
              </button>
            )}
            <button onClick={() => setShowAddSale(true)} className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border hover:bg-muted rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /><span>Add Sale</span>
            </button>
            <button onClick={() => setShowAddPurchase(true)} className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border hover:bg-muted rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /><span>Add Purchase</span>
            </button>
            <button onClick={() => setShowDeleteByDate(true)} className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border hover:bg-muted rounded-lg transition-colors">
              <CalendarX className="w-3.5 h-3.5" /><span>Delete by Date</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          {/* ── PENDING / ALL-SALES TAB ── */}
          {(activeTab === "pending" || activeTab === "all-sales") && (
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-3 py-4 w-8">
                    <button onClick={() => {
                      const filtered = data.salesRows
                        .filter((r) => activeTab === "pending" ? r.status === "Pending" : true)
                        .filter((r) => matchF(formatDate(r.saleDate), sf.saleDate) && matchF(r.item, sf.item) && matchF(r.qty.toFixed(2), sf.qty) && matchF(r.rate, sf.rate) && matchF(r.amount, sf.amount) && matchF(r.purchaseBillDate ? formatDate(r.purchaseBillDate) : "", sf.billDate) && matchF(r.status, sf.status))
                        .map((r) => r.id!);
                      toggleAll(filtered);
                    }} className="p-0.5 hover:text-foreground transition-colors">
                      {selectedIds.size > 0 ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-4 font-semibold">Sale Date</th>
                  <th className="px-4 py-4 font-semibold">Item</th>
                  <th className="px-4 py-4 font-semibold text-right">Qty</th>
                  <th className="px-4 py-4 font-semibold text-right">Rate</th>
                  <th className="px-4 py-4 font-semibold text-right">Amount</th>
                  <th className="px-4 py-4 font-semibold">Bill Date</th>
                  {activeTab === "pending" && <th className="px-4 py-4 font-semibold text-center">Age</th>}
                  <th className="px-4 py-4 font-semibold text-center">Status</th>
                  <th className="px-4 py-4 font-semibold text-center">Actions</th>
                </tr>
                <tr className="bg-muted/30">
                  <th className="px-3 py-1.5" />
                  {(["saleDate","item","qty","rate","amount","billDate","status"] as const).map((col) => (
                    <th key={col} className="px-2 py-1.5 font-normal">
                      <input type="text" placeholder="Search…" value={sf[col]} onChange={(e) => setSf((p) => ({ ...p, [col]: e.target.value }))}
                        className="w-full px-2 py-1 text-xs font-normal normal-case rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </th>
                  ))}
                  {activeTab === "pending" && <th className="px-2 py-1.5" />}
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.salesRows
                  .filter((r) => activeTab === "pending" ? r.status === "Pending" : true)
                  .filter((r) => matchF(formatDate(r.saleDate), sf.saleDate) && matchF(r.item, sf.item) && matchF(r.qty.toFixed(2), sf.qty) && matchF(r.rate, sf.rate) && matchF(r.amount, sf.amount) && matchF(r.purchaseBillDate ? formatDate(r.purchaseBillDate) : "", sf.billDate) && matchF(r.status, sf.status))
                  .map((row) => {
                    const days = row.status === "Pending" ? daysSince(row.saleDate) : 0;
                    const hasLotInfo = !!(row.kpNo || row.farmerName || row.village);
                    return (
                      <tr key={row.id} className={cn("hover:bg-muted/30", selectedIds.has(row.id!) && "bg-primary/5")}>
                        <td className="px-3 py-3">
                          <button onClick={() => toggleId(row.id!)} className="p-0.5 hover:text-primary transition-colors">
                            {selectedIds.has(row.id!) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.saleDate)}</td>
                        <td className="px-4 py-3 font-medium">{row.item}</td>
                        <td className="px-4 py-3 text-right">{row.qty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{row.rate}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.purchaseBillDate ? formatDate(row.purchaseBillDate) : "—"}</td>
                        {activeTab === "pending" && (
                          <td className="px-4 py-3 text-center">
                            {row.status === "Pending" && (
                              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                                days > 30 ? "bg-destructive/20 text-destructive" : days > 14 ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground")}>
                                {days}d
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-1">
                            <button onClick={() => setEditSaleRow(row)} disabled={!!deletingId}
                              className={cn(actionBtnCls, "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10")} title="Edit record">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setLotInfoRow(row)}
                              className={cn(actionBtnCls, hasLotInfo ? "text-blue-400 hover:bg-blue-400/10" : "text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10")} title="Lot info (KP No., Farmer, Village)">
                              <Info className="w-4 h-4" />
                            </button>
                            {row.status === "Pending" && (
                              <>
                                <button onClick={() => setWhyUnmatched({ type: "sale", row })}
                                  className={cn(actionBtnCls, "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10")} title="Why didn't this match?">
                                  <HelpCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => setManualMatchSale(row)}
                                  className={cn(actionBtnCls, "text-muted-foreground hover:text-primary hover:bg-primary/10")} title="Manual match">
                                  <Link2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button onClick={() => row.id != null && handleDeleteRow("sale", row.id)} disabled={deletingId === row.id}
                              className={cn(actionBtnCls, "text-muted-foreground hover:text-destructive hover:bg-destructive/10")} title="Delete">
                              {deletingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {data.salesRows
                  .filter((r) => activeTab === "pending" ? r.status === "Pending" : true)
                  .filter((r) => matchF(formatDate(r.saleDate), sf.saleDate) && matchF(r.item, sf.item) && matchF(r.qty.toFixed(2), sf.qty) && matchF(r.rate, sf.rate) && matchF(r.amount, sf.amount) && matchF(r.purchaseBillDate ? formatDate(r.purchaseBillDate) : "", sf.billDate) && matchF(r.status, sf.status)).length === 0 && (
                  <tr><td colSpan={activeTab === "pending" ? 10 : 9} className="px-6 py-10 text-center text-muted-foreground">No records found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* ── PURCHASE EXCEPTIONS TAB ── */}
          {activeTab === "purchase" && (
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-3 py-4 w-8">
                    <button onClick={() => {
                      const filtered = data.purchaseRows.filter((r) => r.status !== "Matched")
                        .filter((r) => matchF(formatDate(r.billDate), pf.billDate) && matchF(formatDate(r.purchaseDate), pf.purchaseDate) && matchF(r.item, pf.item) && matchF(r.qty.toFixed(2), pf.qty) && matchF(r.rate, pf.rate) && matchF(r.amount, pf.amount) && matchF(r.status, pf.status))
                        .map((r) => r.id!);
                      toggleAll(filtered);
                    }} className="p-0.5 hover:text-foreground transition-colors">
                      {selectedIds.size > 0 ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-4 font-semibold">Bill Date</th>
                  <th className="px-4 py-4 font-semibold text-primary">Purchase Date</th>
                  <th className="px-4 py-4 font-semibold">Item</th>
                  <th className="px-4 py-4 font-semibold text-right">Qty</th>
                  <th className="px-4 py-4 font-semibold text-right">Rate</th>
                  <th className="px-4 py-4 font-semibold text-right">Amount</th>
                  <th className="px-4 py-4 font-semibold text-center">Status</th>
                  <th className="px-4 py-4 font-semibold text-center">Actions</th>
                </tr>
                <tr className="bg-muted/30">
                  <th className="px-3 py-1.5" />
                  {(["billDate","purchaseDate","item","qty","rate","amount","status"] as const).map((col) => (
                    <th key={col} className="px-2 py-1.5 font-normal">
                      <input type="text" placeholder="Search…" value={pf[col]} onChange={(e) => setPf((p) => ({ ...p, [col]: e.target.value }))}
                        className="w-full px-2 py-1 text-xs font-normal normal-case rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </th>
                  ))}
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.purchaseRows
                  .filter((r) => r.status !== "Matched")
                  .filter((r) => matchF(formatDate(r.billDate), pf.billDate) && matchF(formatDate(r.purchaseDate), pf.purchaseDate) && matchF(r.item, pf.item) && matchF(r.qty.toFixed(2), pf.qty) && matchF(r.rate, pf.rate) && matchF(r.amount, pf.amount) && matchF(r.status, pf.status))
                  .map((row) => {
                    const hasNote = !!notes[String(row.id)];
                    return (
                      <tr key={row.id} className={cn("hover:bg-muted/30", selectedIds.has(row.id!) && "bg-primary/5")}>
                        <td className="px-3 py-3">
                          <button onClick={() => toggleId(row.id!)} className="p-0.5 hover:text-primary transition-colors">
                            {selectedIds.has(row.id!) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.billDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-primary">{formatDate(row.purchaseDate)}</td>
                        <td className="px-4 py-3">{row.item}</td>
                        <td className="px-4 py-3 text-right">{row.qty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{row.rate}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-1">
                            <button onClick={() => setEditPurchaseRow(row)} disabled={!!deletingId}
                              className={cn(actionBtnCls, "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10")} title="Edit record">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setNoteModal({ id: row.id!, note: notes[String(row.id)] ?? "" })}
                              className={cn(actionBtnCls, hasNote ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
                              title={hasNote ? "Edit note" : "Add note"}>
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button onClick={() => setWhyUnmatched({ type: "purchase", row })}
                              className={cn(actionBtnCls, "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10")} title="Why didn't this match?">
                              <HelpCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => row.id != null && handleDeleteRow("purchase", row.id)} disabled={deletingId === row.id}
                              className={cn(actionBtnCls, "text-muted-foreground hover:text-destructive hover:bg-destructive/10")} title="Delete">
                              {deletingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {data.purchaseRows.filter((r) => r.status !== "Matched")
                  .filter((r) => matchF(formatDate(r.billDate), pf.billDate) && matchF(formatDate(r.purchaseDate), pf.purchaseDate) && matchF(r.item, pf.item) && matchF(r.qty.toFixed(2), pf.qty) && matchF(r.rate, pf.rate) && matchF(r.amount, pf.amount) && matchF(r.status, pf.status)).length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">All purchase records matched</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showDeleteByDate && <DeleteByDateModal salesDates={salesDates} purchaseDates={purchaseDates} onClose={() => setShowDeleteByDate(false)} onSuccess={onDataChange} userEmail={userEmail} />}
        {showAddSale && <AddSaleModal onClose={() => setShowAddSale(false)} onSuccess={onDataChange} />}
        {showAddPurchase && <AddPurchaseModal onClose={() => setShowAddPurchase(false)} onSuccess={onDataChange} />}
        {editSaleRow && <EditSaleModal row={editSaleRow} onClose={() => setEditSaleRow(null)} onSuccess={(d) => { onDataChange(d); setEditSaleRow(null); }} />}
        {editPurchaseRow && <EditPurchaseModal row={editPurchaseRow} onClose={() => setEditPurchaseRow(null)} onSuccess={(d) => { onDataChange(d); setEditPurchaseRow(null); }} />}
        {whyUnmatched && <WhyUnmatchedModal type={whyUnmatched.type} row={whyUnmatched.row} onClose={() => setWhyUnmatched(null)} />}
        {manualMatchSale && (
          <ManualMatchModal sale={manualMatchSale} allData={data} onClose={() => setManualMatchSale(null)}
            onSuccess={(d) => { onDataChange(d); setManualMatchSale(null); }} />
        )}
        {noteModal && (
          <NoteModal purchaseId={noteModal.id} initialNote={noteModal.note} onClose={() => setNoteModal(null)}
            onSaved={(id, note) => { setNotes((prev) => ({ ...prev, [String(id)]: note })); setNoteModal(null); }} />
        )}
        {lotInfoRow && <LotInfoModal row={lotInfoRow} onClose={() => setLotInfoRow(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Subscription Banner ─────────────────────────────────────────────────────── */
function SubscriptionBanner({ status }: { status: SubscriptionStatus }) {
  const { state, trialDaysLeft, daysRemaining, graceDaysLeft, expiresOn } = status;

  if (state === "active") return null;

  const configs: Record<Exclude<SubState, "active">, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
    trial: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      icon: <Clock className="w-4 h-4 text-blue-400 shrink-0" />,
      text: `Free trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining. Purchase a license to continue after your trial ends.`,
    },
    warning: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      icon: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
      text: `⚠️ Your license expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} (${expiresOn}). Contact us to renew.`,
    },
    grace: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      icon: <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />,
      text: `⚠️ Your license expired on ${expiresOn}. Grace period ends in ${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""}. Contact us to renew before the grace period ends.`,
    },
    locked: {
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      icon: <Lock className="w-4 h-4 text-destructive shrink-0" />,
      text: `🔒 License Expired. Contact us to renew your license.`,
    },
  };

  const cfg = configs[state as Exclude<SubState, "active">];
  if (!cfg) return null;

  return (
    <div className={cn("flex items-start space-x-3 px-4 py-3 rounded-xl border text-sm", cfg.bg, cfg.border)}>
      {cfg.icon}
      <span className="text-foreground/90">{cfg.text}</span>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [appMode, setAppMode] = useState<AppMode>("upload");
  const [salesFiles, setSalesFiles] = useState<File[]>([]);
  const [purchaseFiles, setPurchaseFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<ReconciliationResult | null>(null);
  const [fileResults, setFileResults] = useState<FileImportResult[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const availableFYs = getAvailableFYs();

  useEffect(() => {
    fetch(`${BASE}/api/subscription/status`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSubStatus(d as SubscriptionStatus); })
      .catch(() => {});
  }, []);

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports, error: reportsError } = useGetReports({
    query: { enabled: appMode === "reports" },
  });

  useEffect(() => {
    if (!reportsError) return;
    const e = reportsError as { status?: number; data?: { error?: string } };
    if (e.status === 401 && e.data?.error === "reauth_required") window.location.href = `${BASE}/api/login`;
  }, [reportsError]);

  useEffect(() => { setSelectedMonths([]); }, [selectedFY]);

  const [liveReportsData, setLiveReportsData] = useState<ReconciliationResult | null>(null);

  const handleRun = async () => {
    if (salesFiles.length === 0 && purchaseFiles.length === 0) return;

    setUploadError(""); setUploading(true); setFileResults(null);
    try {
      const formData = new FormData();
      salesFiles.forEach((f) => formData.append("salesFile", f));
      purchaseFiles.forEach((f) => formData.append("purchaseFile", f));

      const res = await fetch(`${BASE}/api/reconciliation/run`, { method: "POST", credentials: "include", body: formData });
      const data = await res.json();
      if (res.status === 401 && data.error === "reauth_required") { window.location.href = `${BASE}/api/login`; return; }
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const { fileResults: fr, ...result } = data as ReconciliationResult & { fileResults?: FileImportResult[] };
      setUploadResult(result as ReconciliationResult);
      if (fr && fr.length > 0) setFileResults(fr);
    } catch (e) { setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again."); }
    finally { setUploading(false); }
  };

  const handleNewUpload = () => { setSalesFiles([]); setPurchaseFiles([]); setUploadResult(null); setUploadError(""); setFileResults(null); };
  const handleSwitchToReports = () => { setAppMode("reports"); setLiveReportsData(null); refetchReports(); };
  const handleReportsDataChange = (data: ReconciliationResult) => setLiveReportsData(data);

  const canUpload = subStatus ? subStatus.canUpload : true;
  const isRunDisabled = uploading || !canUpload || (salesFiles.length === 0 && purchaseFiles.length === 0);

  const displayName = user?.firstName || user?.email?.split("@")[0] || "User";
  const rawReportsData = liveReportsData ?? reportsData;
  const fyReportsData = rawReportsData ? filterResultByFY(rawReportsData, selectedFY) : null;
  const fyUploadData = uploadResult ? filterResultByFY(uploadResult, selectedFY) : null;

  const availableMonths = [...new Set([
    ...(fyReportsData?.salesRows.map((r) => monthKey(r.saleDate)) ?? []),
    ...(fyReportsData?.purchaseRows.map((r) => monthKey(r.billDate)) ?? []),
    ...(fyUploadData?.salesRows.map((r) => monthKey(r.saleDate)) ?? []),
    ...(fyUploadData?.purchaseRows.map((r) => monthKey(r.billDate)) ?? []),
  ])].filter(Boolean).sort();

  const displayReportsData = fyReportsData ? filterResultByMonths(fyReportsData, selectedMonths) : null;
  const displayUploadResult = fyUploadData ? filterResultByMonths(fyUploadData, selectedMonths) : null;

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <h1 className="font-display font-bold text-xl text-foreground hidden sm:block">Stock Reconciler</h1>
          </div>
          <div className="flex items-center space-x-2">
            {appMode === "upload" && uploadResult && (
              <button onClick={handleNewUpload} className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors">
                <RefreshCcw className="w-4 h-4" /><span className="hidden sm:inline">New Upload</span>
              </button>
            )}
            <div className="relative flex items-center">
              <select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)}
                className="appearance-none bg-muted/50 hover:bg-muted border border-border text-foreground text-sm font-medium pl-3 pr-8 py-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary">
                {availableFYs.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
            </div>
            {availableMonths.length > 0 && (
              <span className="hidden sm:block">
                <MultiMonthDropdown months={availableMonths} selected={selectedMonths} onChange={setSelectedMonths} />
              </span>
            )}
            <button onClick={appMode === "reports" ? () => setAppMode("upload") : handleSwitchToReports}
              className={cn("flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                appMode === "reports" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground")}>
              {appMode === "reports" ? <><Upload className="w-4 h-4" /><span>Upload</span></> : <><BarChart3 className="w-4 h-4" /><span>Reports</span></>}
            </button>
            <div className="flex items-center space-x-2 pl-2 border-l border-border">
              <div className="flex items-center space-x-1.5 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="hidden md:inline max-w-[120px] truncate">{displayName}</span>
              </div>
              <button onClick={logout} title="Log out"
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {subStatus && subStatus.state !== "active" && (
          <SubscriptionBanner status={subStatus} />
        )}
        <AnimatePresence mode="wait">
          {appMode === "reports" && (
            <motion.div key="reports-mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {reportsLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">Loading your saved records...</p>
                </div>
              ) : displayReportsData && (displayReportsData.salesRows.length > 0 || displayReportsData.purchaseRows.length > 0) ? (
                <ResultsView data={displayReportsData} onDataChange={handleReportsDataChange} selectedFY={selectedFY} selectedMonths={selectedMonths} userEmail={user?.email ?? undefined} />
              ) : (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
                  <div className="p-6 bg-muted/50 rounded-full"><FileSpreadsheet className="w-12 h-12 text-muted-foreground" /></div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">No Records for FY {selectedFY}</h3>
                    <p className="text-muted-foreground mt-1">Upload files with dates in this financial year or select a different FY from the dropdown.</p>
                  </div>
                  <button onClick={() => setAppMode("upload")}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
                    <Upload className="w-4 h-4" /><span>Go to Upload</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {appMode === "upload" && (
            <motion.div key="upload-mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <AnimatePresence>
                {fileResults && fileResults.length > 0 && (
                  <motion.div key="file-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <FileImportBanner results={fileResults} onClose={() => setFileResults(null)} />
                  </motion.div>
                )}

                {!uploadResult && (
                  <motion.div key="upload-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                    className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-border">
                      <h2 className="text-xl font-display font-bold text-foreground flex items-center space-x-2">
                        <LayoutDashboard className="w-6 h-6 text-primary" /><span>Upload & Match</span>
                      </h2>
                      <button onClick={() => setShowFormatGuide((v) => !v)}
                        className="mt-3 flex items-center space-x-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showFormatGuide && "rotate-180")} />
                        <span>{showFormatGuide ? "Hide format guide" : "View required file format"}</span>
                      </button>
                      <AnimatePresence>
                        {showFormatGuide && (
                          <motion.div key="format-guide" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="rounded-xl border border-border bg-white/5 p-4 space-y-2">
                                <p className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center space-x-1.5"><FileSpreadsheet className="w-3.5 h-3.5 text-primary" /><span>Sales Bill — Required Columns</span></p>
                                <table className="w-full text-xs text-muted-foreground">
                                  <thead><tr className="border-b border-border/50"><th className="text-left py-1 pr-3 font-semibold text-foreground/70">Column Header</th><th className="text-left py-1 font-semibold text-foreground/70">Example</th></tr></thead>
                                  <tbody className="divide-y divide-border/30">
                                    {[["Sale Date","15/04/2025"],["Item / Commodity","Onion"],["Qty (QTL)","120.50"],["Rate","850"],["Amount","102425"],["KP No. (optional)","KP001"],["Farmer Name (optional)","Rajesh Patil"],["Village (optional)","Nashik"]].map(([col,ex]) => (
                                      <tr key={col}><td className="py-1 pr-3 font-medium text-foreground/80">{col}</td><td className="py-1 text-muted-foreground">{ex}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="text-[11px] text-muted-foreground/70">Date format: DD/MM/YYYY or YYYY-MM-DD · KP No., Farmer Name, Village are optional</p>
                              </div>
                              <div className="rounded-xl border border-border bg-white/5 p-4 space-y-2">
                                <p className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center space-x-1.5"><FileSpreadsheet className="w-3.5 h-3.5 text-primary" /><span>Purchase Bill — Required Columns</span></p>
                                <table className="w-full text-xs text-muted-foreground">
                                  <thead><tr className="border-b border-border/50"><th className="text-left py-1 pr-3 font-semibold text-foreground/70">Column Header</th><th className="text-left py-1 font-semibold text-foreground/70">Example</th></tr></thead>
                                  <tbody className="divide-y divide-border/30">
                                    {[["Date / Bill Date","20/04/2025"],["Purchase Date","15/04/2025"],["Item / Commodity","Onion"],["Qty (QTL)","120.50"],["Rate","850"],["Amount","102425"]].map(([col,ex]) => (
                                      <tr key={col}><td className="py-1 pr-3 font-medium text-foreground/80">{col}</td><td className="py-1 text-muted-foreground">{ex}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="text-[11px] text-muted-foreground/70">Bill Date = payment date · Purchase Date = original purchase date · Accepts .xlsx and .xls</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="p-6 md:p-8">
                      {!canUpload && (
                        <div className="mb-6 flex items-center space-x-3 p-4 bg-muted/60 border border-border rounded-xl">
                          <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
                          <p className="text-sm text-muted-foreground">Upload is disabled. Your saved records are still available in Reports.</p>
                        </div>
                      )}
                      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-8", !canUpload && "pointer-events-none opacity-40")}>
                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-foreground">Sales Data</label>
                          <FileDropzone label="Sales Excel" files={salesFiles} onFilesChange={setSalesFiles} />
                        </div>
                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-foreground">Purchase Data</label>
                          <FileDropzone label="Purchase Excel" files={purchaseFiles} onFilesChange={setPurchaseFiles} />
                        </div>
                      </div>
                      {uploadError && (
                        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                          <p className="text-sm text-destructive">{uploadError}</p>
                        </div>
                      )}
                      <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <p className="text-xs text-muted-foreground">Re-uploading the same date + commodity replaces only those records.</p>
                        <button onClick={handleRun} disabled={isRunDisabled}
                          className="flex items-center justify-center space-x-2 w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
                          {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></> : <><ArrowRightLeft className="w-5 h-5" /><span>Run Match</span></>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {uploadResult && displayUploadResult && (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <ResultsView data={displayUploadResult} onDataChange={setUploadResult} selectedFY={selectedFY} selectedMonths={selectedMonths} userEmail={user?.email ?? undefined} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
