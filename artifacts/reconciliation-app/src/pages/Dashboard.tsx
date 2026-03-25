import { useState, useEffect, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightLeft, CheckCircle2, AlertCircle, Download, LayoutDashboard, Clock,
  AlertTriangle, Loader2, RefreshCcw, BarChart3, Trash2, X, Upload, FileSpreadsheet,
  Plus, LogOut, User, CalendarX, ChevronDown, Edit2, Link2, HelpCircle, FileX,
  CheckSquare, Square, TrendingUp, CheckCheck,
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
type UploadMode = "both" | "sale-only" | "purchase-only";

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

function filterResultByMonth(result: ReconciliationResult, month: string): ReconciliationResult {
  if (!month) return result;
  const sales = result.salesRows.filter((r) => monthKey(r.saleDate) === month);
  const purchases = result.purchaseRows.filter((r) => monthKey(r.billDate) === month);
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
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      className="rounded-xl border border-border bg-card/80 backdrop-blur overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center space-x-2 text-sm font-semibold text-foreground">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <span>Import Results — {results.length} file{results.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="divide-y divide-border/50">
        {succeeded.map((r, i) => (
          <div key={i} className="flex items-start space-x-3 px-5 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.filename}</p>
              <p className="text-xs text-muted-foreground">{r.type === "sale" ? "Sales" : "Purchase"} · {r.rowCount} row{r.rowCount !== 1 ? "s" : ""} imported</p>
            </div>
          </div>
        ))}
        {failed.map((r, i) => (
          <div key={i} className="flex items-start space-x-3 px-5 py-3 bg-destructive/5">
            <FileX className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive truncate">{r.filename}</p>
              <p className="text-xs text-muted-foreground">{r.type === "sale" ? "Sales" : "Purchase"} · {r.error}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Monthly Chart ───────────────────────────────────────────────────────────── */
function MonthlyChart({ data }: { data: ReconciliationResult }) {
  const chartData = useMemo(() => {
    const map = new Map<string, { month: string; matched: number; pending: number }>();
    for (const s of data.salesRows) {
      const mk = monthKey(s.saleDate);
      if (!mk) continue;
      const entry = map.get(mk) ?? { month: monthLabel(mk), matched: 0, pending: 0 };
      if (s.status === "Matched") entry.matched += s.qty;
      else entry.pending += s.qty;
      map.set(mk, entry);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center space-x-2 mb-5">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Monthly Matched vs Pending (Qty)</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="matched" name="Matched" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" name="Pending" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Shared form field styles ─────────────────────────────────────────────────── */
const inputCls = "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors text-sm";

/* ── Delete by Date Modal ─────────────────────────────────────────────────────── */
function DeleteByDateModal({ salesDates, purchaseDates, onClose, onSuccess }: {
  salesDates: string[]; purchaseDates: string[];
  onClose: () => void; onSuccess: (data: ReconciliationResult) => void;
}) {
  const [type, setType] = useState<"sale" | "purchase">("sale");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const dates = type === "sale" ? salesDates : purchaseDates;

  const handleDelete = async () => {
    if (!date) return;
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/records/date", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, type }) });
      onSuccess(data);
      setSuccessMsg(`Records for ${formatDate(date)} deleted.`); setDate("");
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-destructive/10 rounded-lg"><CalendarX className="w-5 h-5 text-destructive" /></div>
            <h3 className="font-bold text-lg text-foreground">Delete by Date</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Record Type</label>
            <div className="flex rounded-xl overflow-hidden border border-border">
              {(["sale","purchase"] as const).map((t) => (
                <button key={t} onClick={() => { setType(t); setDate(""); }}
                  className={cn("flex-1 px-4 py-2.5 text-sm font-medium transition-colors capitalize",
                    type === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                  {t === "sale" ? "Sales" : "Purchases"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Select Date</label>
            <select value={date} onChange={(e) => setDate(e.target.value)} className={inputCls}>
              <option value="">-- Choose a date --</option>
              {dates.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}
            </select>
            {dates.length === 0 && <p className="text-xs text-muted-foreground">No {type} dates available.</p>}
          </div>
          {successMsg && <p className="text-sm text-green-400 flex items-center space-x-1"><span>✓</span><span>{successMsg}</span></p>}
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Close</button>
          <button onClick={handleDelete} disabled={!date || loading}
            className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{loading ? "Deleting..." : "Delete Records"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Reusable Sale Form Fields ─────────────────────────────────────────────────── */
function SaleFormFields({ form, onChange, amountManual, onAmountChange }: {
  form: { saleDate: string; item: string; qty: string; rate: string; amount: string };
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
    </div>
  );
}

/* ── Add Sale Modal ──────────────────────────────────────────────────────────── */
function AddSaleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({ saleDate: "", item: "", qty: "", rate: "", amount: "" });
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
    if (!form.saleDate || !form.item || !form.qty || !form.rate || !form.amount) { setError("All fields are required."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/records/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleDate: form.saleDate, item: form.item.trim(), qty: parseFloat(form.qty), rate: parseFloat(form.rate), amount: parseFloat(form.amount) }) });
      onSuccess(data); setSuccessMsg(`Sale added for ${formatDate(form.saleDate)}.`);
      setForm({ saleDate: "", item: "", qty: "", rate: "", amount: "" }); setAmountManual(false);
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
            <h3 className="font-bold text-lg text-foreground">Add Sale Record</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <SaleFormFields form={form} onChange={handleChange} amountManual={amountManual} onAmountChange={(v) => { setAmountManual(true); setForm((f) => ({ ...f, amount: v })); }} />
          {successMsg && <p className="text-sm text-green-400">✓ {successMsg}</p>}
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
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
  const [form, setForm] = useState({ saleDate: row.saleDate, item: row.item, qty: String(row.qty), rate: String(row.rate), amount: String(row.amount) });
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
    if (!form.saleDate || !form.item || !form.qty || !form.rate || !form.amount) { setError("All fields are required."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch(`/records/sale/${row.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleDate: form.saleDate, item: form.item.trim(), qty: parseFloat(form.qty), rate: parseFloat(form.rate), amount: parseFloat(form.amount) }) });
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
              <h3 className="font-bold text-lg text-foreground">Edit Sale Record</h3>
              <p className="text-xs text-muted-foreground">Changes will trigger re-matching</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <SaleFormFields form={form} onChange={handleChange} amountManual={amountManual} onAmountChange={(v) => { setAmountManual(true); setForm((f) => ({ ...f, amount: v })); }} />
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
function WhyUnmatchedModal({ type, row, allData, onClose }: {
  type: "sale" | "purchase";
  row: SaleRow | PurchaseRow;
  allData: ReconciliationResult;
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
          {result && result.globalReason && (
            <div className="p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{result.globalReason}</span>
            </div>
          )}
          {result && result.candidates.length === 0 && !result.globalReason && (
            <p className="text-sm text-muted-foreground text-center py-8">No candidate records found.</p>
          )}
          {result && result.candidates.map((c, idx) => (
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
    { key: "item",         label: "Item",          saleKey: "item",         purKey: "item" },
    { key: "date",         label: "Date",           saleKey: "saleDate",     purKey: "purchaseDate" },
    { key: "qty",          label: "Qty",            saleKey: "qty",          purKey: "qty" },
    { key: "rate",         label: "Rate",           saleKey: "rate",         purKey: "rate" },
    { key: "amount",       label: "Amount",         saleKey: "amount",       purKey: "amount" },
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
          saleId: sale.id,
          purchaseId: selectedPurchase.id,
          saleCorrections: Object.keys(saleCorr).length ? saleCorr : undefined,
          purchaseCorrections: Object.keys(purCorr).length ? purCorr : undefined,
        }),
      });
      onSuccess(data); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Link2 className="w-5 h-5 text-primary" /></div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Manual Match</h3>
              <p className="text-xs text-muted-foreground">
                Sale · {formatDate(sale.saleDate)} · {sale.item} · {sale.qty} QTL
              </p>
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

        {/* Step 1: Select a purchase */}
        {step === 1 && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-5 border-b border-border shrink-0">
              <p className="text-sm font-medium text-foreground mb-3">Select an unmatched purchase to link with this sale:</p>
              <input type="text" placeholder="Search by item, date, qty…" value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                className={cn(inputCls, "max-w-xs")} />
            </div>
            <div className="overflow-y-auto flex-1">
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
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.billDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDate(p.purchaseDate)}</td>
                        <td className="px-4 py-3">{p.item}</td>
                        <td className="px-4 py-3 text-right">{p.qty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{p.rate}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setSelectedPurchase(p); setStep(2); }}
                            className="px-3 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors">
                            Select
                          </button>
                        </td>
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

        {/* Step 2: Review & correct fields */}
        {step === 2 && selectedPurchase && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Review the field comparison below. Highlighted rows have mismatches — correct them before locking the match.
              </p>
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

function ResultsView({ data, onDataChange, selectedFY }: {
  data: ReconciliationResult;
  onDataChange: (d: ReconciliationResult) => void;
  selectedFY: string;
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
  const { handleDownload, downloading } = useReconciliationDownloads();

  // Reset selection when tab changes
  useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);

  // Search filters
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

  const tabs: { id: TabId; label: string; count: number; icon: ReactNode }[] = [
    { id: "pending",    label: "Pending Pavati",      count: data.pendingCount,             icon: <Clock className="w-4 h-4" /> },
    { id: "purchase",   label: "Purchase Exceptions", count: data.unmatchedPurchaseCount,   icon: <AlertCircle className="w-4 h-4" /> },
    { id: "all-sales",  label: "All Sales",           count: data.salesRows.length,          icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const downloadBtns = [
    { fileType: "updated-sales",      label: "Updated Sales",       filename: `updated_sales_${selectedFY}.xlsx` },
    { fileType: "pending-pavati",     label: "Pending Pavati",      filename: `pending_pavati_${selectedFY}.xlsx` },
    { fileType: "datewise-report",    label: "Datewise Report",     filename: `datewise_report_${selectedFY}.xlsx` },
    { fileType: "purchase-exceptions",label: "Purchase Exceptions", filename: `purchase_exceptions_${selectedFY}.xlsx` },
    { fileType: "monthly-matrix-qty", label: "Matrix (Qty)",        filename: `monthly_matrix_qty_${selectedFY}.xlsx` },
    { fileType: "monthly-matrix-amount",label:"Matrix (Amount)",    filename: `monthly_matrix_amount_${selectedFY}.xlsx` },
  ];

  const actionBtnCls = "p-1.5 rounded-lg transition-colors disabled:opacity-50";

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Matched" value={data.matchedCount} color="green" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending" value={data.pendingCount} color="amber" />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Exceptions" value={data.unmatchedPurchaseCount} color="red" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Total Sales" value={data.salesRows.length} color="blue" />
      </div>

      {/* Monthly chart */}
      <MonthlyChart data={data} />

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
        {/* Tabs + action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border">
          <div className="flex rounded-xl overflow-hidden border border-border w-fit">
            {tabs.map((t, i) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn("flex items-center space-x-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  i > 0 && "border-l border-border",
                  activeTab === t.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                {t.icon}<span>{t.label}</span>
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
          {/* ── PENDING PAVATI TAB ── */}
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
                  .map((row) => (
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
                  ))}
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
        {showDeleteByDate && <DeleteByDateModal salesDates={salesDates} purchaseDates={purchaseDates} onClose={() => setShowDeleteByDate(false)} onSuccess={onDataChange} />}
        {showAddSale && <AddSaleModal onClose={() => setShowAddSale(false)} onSuccess={onDataChange} />}
        {showAddPurchase && <AddPurchaseModal onClose={() => setShowAddPurchase(false)} onSuccess={onDataChange} />}
        {editSaleRow && <EditSaleModal row={editSaleRow} onClose={() => setEditSaleRow(null)} onSuccess={(d) => { onDataChange(d); setEditSaleRow(null); }} />}
        {editPurchaseRow && <EditPurchaseModal row={editPurchaseRow} onClose={() => setEditPurchaseRow(null)} onSuccess={(d) => { onDataChange(d); setEditPurchaseRow(null); }} />}
        {whyUnmatched && (
          <WhyUnmatchedModal type={whyUnmatched.type} row={whyUnmatched.row} allData={data} onClose={() => setWhyUnmatched(null)} />
        )}
        {manualMatchSale && (
          <ManualMatchModal sale={manualMatchSale} allData={data} onClose={() => setManualMatchSale(null)}
            onSuccess={(d) => { onDataChange(d); setManualMatchSale(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [appMode, setAppMode] = useState<AppMode>("upload");
  const [uploadMode, setUploadMode] = useState<UploadMode>("both");
  const [salesFiles, setSalesFiles] = useState<File[]>([]);
  const [purchaseFiles, setPurchaseFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<ReconciliationResult | null>(null);
  const [fileResults, setFileResults] = useState<FileImportResult[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const availableFYs = getAvailableFYs();

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports, error: reportsError } = useGetReports({
    query: { enabled: appMode === "reports" },
  });

  useEffect(() => {
    if (!reportsError) return;
    const e = reportsError as { status?: number; data?: { error?: string } };
    if (e.status === 401 && e.data?.error === "reauth_required") window.location.href = `${BASE}/api/login`;
  }, [reportsError]);

  useEffect(() => { setSelectedMonth(""); }, [selectedFY]);

  const [liveReportsData, setLiveReportsData] = useState<ReconciliationResult | null>(null);

  const handleRun = async () => {
    if (uploadMode === "both" && (salesFiles.length === 0 || purchaseFiles.length === 0)) return;
    if (uploadMode === "sale-only" && salesFiles.length === 0) return;
    if (uploadMode === "purchase-only" && purchaseFiles.length === 0) return;

    setUploadError(""); setUploading(true); setFileResults(null);
    try {
      const formData = new FormData();
      if (uploadMode !== "purchase-only") salesFiles.forEach((f) => formData.append("salesFile", f));
      if (uploadMode !== "sale-only") purchaseFiles.forEach((f) => formData.append("purchaseFile", f));

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

  const isRunDisabled = uploading ||
    (uploadMode === "both" && (salesFiles.length === 0 || purchaseFiles.length === 0)) ||
    (uploadMode === "sale-only" && salesFiles.length === 0) ||
    (uploadMode === "purchase-only" && purchaseFiles.length === 0);

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

  const displayReportsData = fyReportsData ? filterResultByMonth(fyReportsData, selectedMonth) : null;
  const displayUploadResult = fyUploadData ? filterResultByMonth(fyUploadData, selectedMonth) : null;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <h1 className="font-display font-bold text-xl text-foreground">Stock Reconciler</h1>
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
              <div className="relative flex items-center">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-muted/50 hover:bg-muted border border-border text-foreground text-sm font-medium pl-3 pr-8 py-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">All Months</option>
                  {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
              </div>
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
        <AnimatePresence mode="wait">
          {/* ── REPORTS MODE ── */}
          {appMode === "reports" && (
            <motion.div key="reports-mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {reportsLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">Loading your saved records...</p>
                </div>
              ) : displayReportsData && (displayReportsData.salesRows.length > 0 || displayReportsData.purchaseRows.length > 0) ? (
                <ResultsView data={displayReportsData} onDataChange={handleReportsDataChange} selectedFY={selectedFY} />
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

          {/* ── UPLOAD MODE ── */}
          {appMode === "upload" && (
            <motion.div key="upload-mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <AnimatePresence>
                {/* File import results banner */}
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
                      <p className="text-muted-foreground mt-1 text-sm">
                        Upload one or both files. Matching runs automatically against <strong>all your saved records</strong>.
                      </p>
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
                                    {[["Sale Date","15/04/2025"],["Item / Commodity","Onion"],["Qty (QTL)","120.50"],["Rate","850"],["Amount","102425"]].map(([col,ex]) => (
                                      <tr key={col}><td className="py-1 pr-3 font-medium text-foreground/80">{col}</td><td className="py-1 text-muted-foreground">{ex}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="text-[11px] text-muted-foreground/70">Date format: DD/MM/YYYY or YYYY-MM-DD · Amount auto-calculated from Qty × Rate</p>
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
                      <div className="flex rounded-xl overflow-hidden border border-border mb-8 w-fit">
                        {(["both","sale-only","purchase-only"] as UploadMode[]).map((mode, i) => (
                          <button key={mode} onClick={() => { setUploadMode(mode); if(mode==="sale-only") setPurchaseFiles([]); if(mode==="purchase-only") setSalesFiles([]); }}
                            className={cn("px-5 py-2.5 text-sm font-medium transition-colors", i > 0 && "border-l border-border",
                              uploadMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                            {mode === "both" ? "Sales + Purchase" : mode === "sale-only" ? "Sales Only" : "Purchase Only"}
                          </button>
                        ))}
                      </div>
                      <div className={cn("grid gap-8", uploadMode === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-lg")}>
                        {uploadMode !== "purchase-only" && (
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-foreground flex justify-between">
                              <span>Sales Data</span>{uploadMode === "both" && <span className="text-muted-foreground font-normal">Step 1</span>}
                            </label>
                            <FileDropzone label="Sales Excel" files={salesFiles} onFilesChange={setSalesFiles} />
                          </div>
                        )}
                        {uploadMode !== "sale-only" && (
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-foreground flex justify-between">
                              <span>Purchase Data</span>{uploadMode === "both" && <span className="text-muted-foreground font-normal">Step 2</span>}
                            </label>
                            <FileDropzone label="Purchase Excel" files={purchaseFiles} onFilesChange={setPurchaseFiles} />
                          </div>
                        )}
                      </div>
                      {uploadError && (
                        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                          <p className="text-sm text-destructive">{uploadError}</p>
                        </div>
                      )}
                      <div className="mt-8 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Re-uploading the same date replaces only unmatched records for that date.</p>
                        <button onClick={handleRun} disabled={isRunDisabled}
                          className="flex items-center space-x-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
                          {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></> : <><ArrowRightLeft className="w-5 h-5" /><span>Run Match</span></>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {uploadResult && displayUploadResult && (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <ResultsView data={displayUploadResult} onDataChange={setUploadResult} selectedFY={selectedFY} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
