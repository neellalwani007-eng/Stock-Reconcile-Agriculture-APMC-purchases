import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  LayoutDashboard,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCcw,
  BarChart3,
  Trash2,
  X,
  Upload,
  FileSpreadsheet,
  Plus,
  LogOut,
  User,
  CalendarX,
  ChevronDown,
} from "lucide-react";
import { useGetReports } from "@workspace/api-client-react";
import type { ReconciliationResult, SaleRow, PurchaseRow } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type AppMode = "upload" | "reports";
type UploadMode = "both" | "sale-only" | "purchase-only";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}/api/reconciliation${path}`, {
    credentials: "include",
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || "Request failed");
  }
  return res.json() as Promise<ReconciliationResult>;
}

/* ── Financial Year Helpers ── */
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
  for (let y = 2020; y <= currentStart; y++) {
    fys.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return fys;
}

function getFYFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

function filterResultByFY(result: ReconciliationResult, fy: string): ReconciliationResult {
  const sales = result.salesRows.filter((r) => getFYFromDate(r.saleDate) === fy);
  const purchases = result.purchaseRows.filter((r) => getFYFromDate(r.billDate) === fy);

  const matchedCount = sales.filter((r) => r.status === "Matched").length;
  const pendingCount = sales.filter((r) => r.status === "Pending").length;
  const unmatchedPurchaseCount = purchases.filter((r) => r.status !== "Matched").length;

  type SummaryEntry = { salesQty: number; salesAmount: number; purchaseQty: number; purchaseAmount: number; pendingQty: number; pendingAmount: number };
  const map = new Map<string, SummaryEntry>();
  const getEntry = (item: string) => map.get(item) ?? (map.set(item, { salesQty: 0, salesAmount: 0, purchaseQty: 0, purchaseAmount: 0, pendingQty: 0, pendingAmount: 0 }), map.get(item)!);

  for (const s of sales) {
    const e = getEntry(s.item);
    e.salesQty += s.qty; e.salesAmount += s.amount;
    if (s.status === "Pending") { e.pendingQty += s.qty; e.pendingAmount += s.amount; }
  }
  for (const p of purchases) {
    const e = getEntry(p.item);
    e.purchaseQty += p.qty; e.purchaseAmount += p.amount;
  }

  const summary = Array.from(map.entries()).map(([item, data]) => ({ item, ...data }));
  return { salesRows: sales, purchaseRows: purchases, matchedCount, pendingCount, unmatchedPurchaseCount, summary };
}

function useReconciliationDownloads() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (fileType: string, filename: string, fy?: string) => {
    try {
      setDownloading(fileType);
      const res = await fetch(`${BASE}/api/reconciliation/download/${fileType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fy }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Failed to download file. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return { handleDownload, downloading };
}

/* ── Delete by Date Modal ── */
function DeleteByDateModal({
  salesDates,
  purchaseDates,
  onClose,
  onSuccess,
}: {
  salesDates: string[];
  purchaseDates: string[];
  onClose: () => void;
  onSuccess: (data: ReconciliationResult) => void;
}) {
  const [type, setType] = useState<"sale" | "purchase">("sale");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dates = type === "sale" ? salesDates : purchaseDates;

  const handleDelete = async () => {
    if (!date) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/records/date", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, type }),
      });
      onSuccess(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <CalendarX className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Delete by Date</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Record Type</label>
            <div className="flex rounded-xl overflow-hidden border border-border">
              {(["sale", "purchase"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setType(t); setDate(""); }}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-sm font-medium transition-colors capitalize",
                    type === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "sale" ? "Sales" : "Purchases"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Select Date</label>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            >
              <option value="">-- Choose a date --</option>
              {dates.map((d) => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </select>
            {dates.length === 0 && (
              <p className="text-xs text-muted-foreground">No {type} dates available.</p>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center space-x-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!date || loading}
            className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{loading ? "Deleting..." : "Delete Records"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Add Sale Modal ── */
function AddSaleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({ saleDate: "", item: "", qty: "", rate: "", amount: "" });
  const [amountManual, setAmountManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFieldChange = (key: string, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if ((key === "qty" || key === "rate") && !amountManual) {
        const q = parseFloat(key === "qty" ? value : f.qty);
        const r = parseFloat(key === "rate" ? value : f.rate);
        if (!isNaN(q) && !isNaN(r)) next.amount = (q * r).toFixed(2);
        else next.amount = "";
      }
      return next;
    });
  };

  const handleAmountChange = (value: string) => {
    setAmountManual(true);
    setForm((f) => ({ ...f, amount: value }));
  };

  const handleSubmit = async () => {
    if (!form.saleDate || !form.item || !form.qty || !form.rate || !form.amount) {
      setError("All fields are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/records/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleDate: form.saleDate,
          item: form.item.trim(),
          qty: parseFloat(form.qty),
          rate: parseFloat(form.rate),
          amount: parseFloat(form.amount),
        }),
      });
      onSuccess(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add record");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors text-sm";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Add Sale Record</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sale Date</label>
              <input type="date" value={form.saleDate} onChange={(e) => handleFieldChange("saleDate", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item / Commodity</label>
              <input type="text" placeholder="e.g. Onion" value={form.item} onChange={(e) => handleFieldChange("item", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty (QTL)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.qty} onChange={(e) => handleFieldChange("qty", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.rate} onChange={(e) => handleFieldChange("rate", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Amount</span>
                {!amountManual && form.qty && form.rate && (
                  <span className="text-[10px] text-primary font-normal normal-case">Auto-calculated · editable</span>
                )}
              </label>
              <input type="number" step="0.01" placeholder="0.00" value={form.amount}
                onChange={(e) => handleAmountChange(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{loading ? "Adding..." : "Add Sale"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Add Purchase Modal ── */
function AddPurchaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (data: ReconciliationResult) => void }) {
  const [form, setForm] = useState({ billDate: "", purchaseDate: "", item: "", qty: "", rate: "", amount: "" });
  const [amountManual, setAmountManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFieldChange = (key: string, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if ((key === "qty" || key === "rate") && !amountManual) {
        const q = parseFloat(key === "qty" ? value : f.qty);
        const r = parseFloat(key === "rate" ? value : f.rate);
        if (!isNaN(q) && !isNaN(r)) next.amount = (q * r).toFixed(2);
        else next.amount = "";
      }
      return next;
    });
  };

  const handleAmountChange = (value: string) => {
    setAmountManual(true);
    setForm((f) => ({ ...f, amount: value }));
  };

  const handleSubmit = async () => {
    if (!form.billDate || !form.purchaseDate || !form.item || !form.qty || !form.rate || !form.amount) {
      setError("All fields are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/records/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billDate: form.billDate,
          purchaseDate: form.purchaseDate,
          item: form.item.trim(),
          qty: parseFloat(form.qty),
          rate: parseFloat(form.rate),
          amount: parseFloat(form.amount),
        }),
      });
      onSuccess(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add record");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors text-sm";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Add Purchase Record</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bill Date</label>
              <input type="date" value={form.billDate} onChange={(e) => handleFieldChange("billDate", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => handleFieldChange("purchaseDate", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item / Commodity</label>
              <input type="text" placeholder="e.g. Corn" value={form.item} onChange={(e) => handleFieldChange("item", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty (QTL)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.qty} onChange={(e) => handleFieldChange("qty", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.rate} onChange={(e) => handleFieldChange("rate", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Amount</span>
                {!amountManual && form.qty && form.rate && (
                  <span className="text-[10px] text-primary font-normal normal-case">Auto-calculated · editable</span>
                )}
              </label>
              <input type="number" step="0.01" placeholder="0.00" value={form.amount}
                onChange={(e) => handleAmountChange(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive flex items-center space-x-1"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{loading ? "Adding..." : "Add Purchase"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Results View ── */
function ResultsView({
  data,
  onDataChange,
  selectedFY,
}: {
  data: ReconciliationResult;
  onDataChange: (data: ReconciliationResult) => void;
  selectedFY: string;
}) {
  const [activeTab, setActiveTab] = useState<"sales" | "purchase" | "pending">("sales");
  const [showDeleteByDate, setShowDeleteByDate] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { handleDownload, downloading } = useReconciliationDownloads();

  const salesDates = [...new Set(data.salesRows.map((r) => r.saleDate))].sort();
  const purchaseDates = [...new Set(data.purchaseRows.map((r) => r.billDate))].sort();

  const handleDeleteRow = async (type: "sale" | "purchase", id: number) => {
    if (!confirm("Delete this record? Matching will be re-run automatically.")) return;
    setDeletingId(id);
    try {
      const result = await apiFetch(`/records/${type}/${id}`, { method: "DELETE" });
      onDataChange(result);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Exactly Matched Lots" value={data.matchedCount} icon={<CheckCircle2 className="w-8 h-8" />} variant="success" />
        <StatCard title="Pending Farmer Payments" value={data.pendingCount} icon={<Clock className="w-8 h-8" />} variant="warning" description="Sale rows without purchase data" />
        <StatCard title="Unmatched Purchases" value={data.unmatchedPurchaseCount} icon={<AlertCircle className="w-8 h-8" />} variant="destructive" description="Purchase data without sale entries" />
      </div>

      {/* Downloads + Quick Actions */}
      <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-lg text-foreground">Export Reports</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddSale(true)}
              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/30">
              <Plus className="w-4 h-4" /><span>Add Sale</span>
            </button>
            <button onClick={() => setShowAddPurchase(true)}
              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/30">
              <Plus className="w-4 h-4" /><span>Add Purchase</span>
            </button>
            <button onClick={() => setShowDeleteByDate(true)}
              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
              <CalendarX className="w-4 h-4" /><span>Delete by Date</span>
            </button>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: "updated-sales", label: "Updated Sales", desc: "With Bill Dates", filename: `updated_sales_${selectedFY}.xlsx` },
            { id: "pending-pavati", label: "Pending Pavati", desc: "Farmers awaiting payment", filename: `pending_pavati_${selectedFY}.xlsx` },
            { id: "datewise-report", label: "Date-wise Report", desc: "Grouped by sale date", filename: `datewise_report_${selectedFY}.xlsx` },
            { id: "purchase-exceptions", label: "Purchase Exceptions", desc: "Unmatched/Extra entries", filename: `purchase_exceptions_${selectedFY}.xlsx` },
          ].map((btn) => (
            <button key={btn.id} onClick={() => handleDownload(btn.id, btn.filename, selectedFY)} disabled={downloading !== null}
              className="flex flex-col items-center justify-center p-4 border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-center group">
              {downloading === btn.id ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              ) : (
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground text-primary transition-colors">
                  <Download className="w-6 h-6" />
                </div>
              )}
              <span className="font-semibold text-foreground">{btn.label}</span>
              <span className="text-xs text-muted-foreground mt-1">{btn.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Commodity Summary */}
      <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-display font-semibold text-lg text-foreground">Commodity Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Commodity</th>
                <th className="px-6 py-4 font-semibold text-right">Sales Qty</th>
                <th className="px-6 py-4 font-semibold text-right">Sales Amt</th>
                <th className="px-6 py-4 font-semibold text-right">Purchase Qty</th>
                <th className="px-6 py-4 font-semibold text-right">Purchase Amt</th>
                <th className="px-6 py-4 font-semibold text-right text-amber-400 bg-amber-900/30">Pending Qty</th>
                <th className="px-6 py-4 font-semibold text-right text-amber-400 bg-amber-900/30">Pending Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.summary.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{row.item}</td>
                  <td className="px-6 py-4 text-right">{row.salesQty.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(row.salesAmount)}</td>
                  <td className="px-6 py-4 text-right">{row.purchaseQty.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(row.purchaseAmount)}</td>
                  <td className="px-6 py-4 text-right font-bold text-amber-400 bg-amber-900/20">{row.pendingQty.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-amber-400 bg-amber-900/20">{formatCurrency(row.pendingAmount)}</td>
                </tr>
              ))}
              {data.summary.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Data Tabs */}
      <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border bg-muted/20 px-4 flex space-x-1 overflow-x-auto">
          {[
            { key: "sales", label: "All Sales" },
            { key: "pending", label: `Pending Pavati (${data.pendingCount})` },
            { key: "purchase", label: `Purchase Exceptions (${data.unmatchedPurchaseCount})` },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={cn("px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {(activeTab === "sales" || activeTab === "pending") && (
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold">Sale Date</th>
                  <th className="px-4 py-4 font-semibold">Item</th>
                  <th className="px-4 py-4 font-semibold text-right">Qty</th>
                  <th className="px-4 py-4 font-semibold text-right">Rate</th>
                  <th className="px-4 py-4 font-semibold text-right">Amount</th>
                  <th className="px-4 py-4 font-semibold">Bill Date</th>
                  <th className="px-4 py-4 font-semibold text-center">Status</th>
                  <th className="px-4 py-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.salesRows
                  .filter((r) => (activeTab === "pending" ? r.status === "Pending" : true))
                  .map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.saleDate)}</td>
                      <td className="px-4 py-3 font-medium">{row.item}</td>
                      <td className="px-4 py-3 text-right">{row.qty.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{row.rate}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {row.purchaseBillDate ? formatDate(row.purchaseBillDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => row.id != null && handleDeleteRow("sale", row.id)}
                          disabled={deletingId === row.id}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete this record"
                        >
                          {deletingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                {data.salesRows.filter((r) => activeTab === "pending" ? r.status === "Pending" : true).length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No records found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "purchase" && (
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold">Bill Date</th>
                  <th className="px-4 py-4 font-semibold text-primary">Purchase Date</th>
                  <th className="px-4 py-4 font-semibold">Item</th>
                  <th className="px-4 py-4 font-semibold text-right">Qty</th>
                  <th className="px-4 py-4 font-semibold text-right">Rate</th>
                  <th className="px-4 py-4 font-semibold text-right">Amount</th>
                  <th className="px-4 py-4 font-semibold text-center">Status</th>
                  <th className="px-4 py-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.purchaseRows
                  .filter((r) => r.status !== "Matched")
                  .map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.billDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-primary">{formatDate(row.purchaseDate)}</td>
                      <td className="px-4 py-3">{row.item}</td>
                      <td className="px-4 py-3 text-right">{row.qty.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{row.rate}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => row.id != null && handleDeleteRow("purchase", row.id)}
                          disabled={deletingId === row.id}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete this record"
                        >
                          {deletingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                {data.purchaseRows.filter((r) => r.status !== "Matched").length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">All purchase records matched</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Modals */}
      <AnimatePresence>
        {showDeleteByDate && (
          <DeleteByDateModal
            salesDates={salesDates}
            purchaseDates={purchaseDates}
            onClose={() => setShowDeleteByDate(false)}
            onSuccess={onDataChange}
          />
        )}
        {showAddSale && <AddSaleModal onClose={() => setShowAddSale(false)} onSuccess={onDataChange} />}
        {showAddPurchase && <AddPurchaseModal onClose={() => setShowAddPurchase(false)} onSuccess={onDataChange} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [appMode, setAppMode] = useState<AppMode>("upload");
  const [uploadMode, setUploadMode] = useState<UploadMode>("both");
  const [salesFiles, setSalesFiles] = useState<File[]>([]);
  const [purchaseFiles, setPurchaseFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<ReconciliationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const availableFYs = getAvailableFYs();

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useGetReports({
    query: { enabled: appMode === "reports" },
  });

  const [liveReportsData, setLiveReportsData] = useState<ReconciliationResult | null>(null);

  const handleRun = async () => {
    if (uploadMode === "both" && (salesFiles.length === 0 || purchaseFiles.length === 0)) return;
    if (uploadMode === "sale-only" && salesFiles.length === 0) return;
    if (uploadMode === "purchase-only" && purchaseFiles.length === 0) return;

    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      if (uploadMode !== "purchase-only") salesFiles.forEach((f) => formData.append("salesFile", f));
      if (uploadMode !== "sale-only") purchaseFiles.forEach((f) => formData.append("purchaseFile", f));

      const res = await fetch(`${BASE}/api/reconciliation/run`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadResult(data);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleNewUpload = () => {
    setSalesFiles([]);
    setPurchaseFiles([]);
    setUploadResult(null);
    setUploadError("");
  };

  const handleSwitchToReports = () => {
    setAppMode("reports");
    setLiveReportsData(null);
    refetchReports();
  };

  const handleReportsDataChange = (data: ReconciliationResult) => {
    setLiveReportsData(data);
  };

  const isRunDisabled =
    uploading ||
    (uploadMode === "both" && (salesFiles.length === 0 || purchaseFiles.length === 0)) ||
    (uploadMode === "sale-only" && salesFiles.length === 0) ||
    (uploadMode === "purchase-only" && purchaseFiles.length === 0);

  const displayName = user?.firstName || user?.email?.split("@")[0] || "User";
  const rawReportsData = liveReportsData ?? reportsData;
  const displayReportsData = rawReportsData ? filterResultByFY(rawReportsData, selectedFY) : null;
  const displayUploadResult = uploadResult ? filterResultByFY(uploadResult, selectedFY) : null;

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
              <button onClick={handleNewUpload}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors">
                <RefreshCcw className="w-4 h-4" />
                <span className="hidden sm:inline">New Upload</span>
              </button>
            )}
            {/* FY Selector */}
            <div className="relative flex items-center">
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="appearance-none bg-muted/50 hover:bg-muted border border-border text-foreground text-sm font-medium pl-3 pr-8 py-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {availableFYs.map((fy) => (
                  <option key={fy} value={fy}>FY {fy}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
            </div>
            <button
              onClick={appMode === "reports" ? () => setAppMode("upload") : handleSwitchToReports}
              className={cn("flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                appMode === "reports"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground")}>
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
                  <div className="p-6 bg-muted/50 rounded-full">
                    <FileSpreadsheet className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">No Records for FY {selectedFY}</h3>
                    <p className="text-muted-foreground mt-1">Upload files with dates in this financial year or select a different FY from the dropdown.</p>
                  </div>
                  <button onClick={() => setAppMode("upload")}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Go to Upload</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── UPLOAD MODE ── */}
          {appMode === "upload" && (
            <motion.div key="upload-mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <AnimatePresence>
                {!uploadResult && (
                  <motion.div key="upload-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                    className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-border">
                      <h2 className="text-xl font-display font-bold text-foreground flex items-center space-x-2">
                        <LayoutDashboard className="w-6 h-6 text-primary" />
                        <span>Upload & Match</span>
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Upload one or both files. Matching runs automatically against <strong>all your saved records</strong>.
                      </p>
                    </div>

                    <div className="p-6 md:p-8">
                      {/* Upload Mode Toggle — 3 options */}
                      <div className="flex rounded-xl overflow-hidden border border-border mb-8 w-fit">
                        {(["both", "sale-only", "purchase-only"] as UploadMode[]).map((mode, i) => (
                          <button key={mode}
                            onClick={() => {
                              setUploadMode(mode);
                              if (mode === "sale-only") setPurchaseFiles([]);
                              if (mode === "purchase-only") setSalesFiles([]);
                            }}
                            className={cn(
                              "px-5 py-2.5 text-sm font-medium transition-colors",
                              i > 0 && "border-l border-border",
                              uploadMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                            )}>
                            {mode === "both" ? "Sales + Purchase" : mode === "sale-only" ? "Sales Only" : "Purchase Only"}
                          </button>
                        ))}
                      </div>

                      <div className={cn("grid gap-8",
                        uploadMode === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-lg")}>
                        {uploadMode !== "purchase-only" && (
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-foreground flex justify-between">
                              <span>Sales Data</span>
                              {uploadMode === "both" && <span className="text-muted-foreground font-normal">Step 1</span>}
                            </label>
                            <FileDropzone label="Sales Excel" files={salesFiles} onFilesChange={setSalesFiles} />
                            {uploadMode === "sale-only" && (
                              <p className="text-xs text-muted-foreground bg-white/5 border border-white/15 rounded-lg px-3 py-2">
                                Sales will be added to your database. Matching runs against existing purchase records.
                              </p>
                            )}
                          </div>
                        )}
                        {uploadMode !== "sale-only" && (
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-foreground flex justify-between">
                              <span>Purchase Data</span>
                              {uploadMode === "both" && <span className="text-muted-foreground font-normal">Step 2</span>}
                            </label>
                            <FileDropzone label="Purchase Excel" files={purchaseFiles} onFilesChange={setPurchaseFiles} />
                            {uploadMode === "purchase-only" && (
                              <p className="text-xs text-muted-foreground bg-white/5 border border-white/15 rounded-lg px-3 py-2">
                                Purchase data will be matched against all your previously uploaded sales records.
                              </p>
                            )}
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
                        <p className="text-xs text-muted-foreground">
                          Re-uploading the same date replaces only unmatched records for that date.
                        </p>
                        <button onClick={handleRun} disabled={isRunDisabled}
                          className="flex items-center space-x-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
                          {uploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></>
                          ) : (
                            <><ArrowRightLeft className="w-5 h-5" /><span>Run Match</span></>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload Result */}
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
