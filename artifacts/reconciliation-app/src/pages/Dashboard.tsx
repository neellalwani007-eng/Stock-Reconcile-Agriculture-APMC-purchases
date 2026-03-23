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
  Lock,
  X,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { useRunReconciliation, useGetReports, useDeleteRecords } from "@workspace/api-client-react";
import type { ReconciliationResult } from "@workspace/api-client-react";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type AppMode = "upload" | "reports";
type UploadMode = "both" | "purchase-only";

function useReconciliationDownloads(data: ReconciliationResult | undefined) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (fileType: string, filename: string) => {
    if (!data) return;
    try {
      setDownloading(fileType);
      const res = await fetch(`/api/reconciliation/download/${fileType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

function DeleteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { mutate: deleteRecords, isPending } = useDeleteRecords({
    mutation: {
      onSuccess: () => {
        onSuccess();
        onClose();
      },
      onError: (err) => {
        setError(err.error || "Incorrect password.");
      },
    },
  });

  const handleDelete = () => {
    setError("");
    deleteRecords({ data: { password } });
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
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Delete All Records</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground text-sm">
            This will permanently delete <strong>all</strong> saved sales and purchase records from the database.
            This action cannot be undone.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>Enter Password to Confirm</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDelete()}
              placeholder="Enter password..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            />
            {error && (
              <p className="text-sm text-destructive flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex space-x-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!password || isPending}
            className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{isPending ? "Deleting..." : "Delete All"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ResultsView({
  data,
  showDeleteButton = false,
  onDelete,
}: {
  data: ReconciliationResult;
  showDeleteButton?: boolean;
  onDelete?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"sales" | "purchase" | "pending">("sales");
  const { handleDownload, downloading } = useReconciliationDownloads(data);

  return (
    <div className="space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Exactly Matched Lots"
          value={data.matchedCount}
          icon={<CheckCircle2 className="w-8 h-8" />}
          variant="success"
        />
        <StatCard
          title="Pending Farmer Payments"
          value={data.pendingCount}
          icon={<Clock className="w-8 h-8" />}
          variant="warning"
          description="Sale rows without purchase bills"
        />
        <StatCard
          title="Unmatched Purchases"
          value={data.unmatchedPurchaseCount}
          icon={<AlertCircle className="w-8 h-8" />}
          variant="destructive"
          description="Purchase bills without sale entries"
        />
      </div>

      {/* Downloads Section */}
      <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg text-foreground">Export Reports</h3>
          {showDeleteButton && (
            <button
              onClick={onDelete}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Records</span>
            </button>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: "updated-sales", label: "Updated Sales", desc: "With Bill Dates", filename: "updated_sales.xlsx" },
            { id: "pending-pavati", label: "Pending Pavati", desc: "Farmers awaiting payment", filename: "pending_pavati.xlsx" },
            { id: "datewise-report", label: "Date-wise Report", desc: "Grouped by sale date", filename: "datewise_report.xlsx" },
            { id: "purchase-exceptions", label: "Purchase Exceptions", desc: "Unmatched/Extra entries", filename: "purchase_exceptions.xlsx" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleDownload(btn.id, btn.filename)}
              disabled={downloading !== null}
              className="flex flex-col items-center justify-center p-4 border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-center group"
            >
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
                <th className="px-6 py-4 font-semibold text-right text-amber-600 bg-amber-50">Pending Qty</th>
                <th className="px-6 py-4 font-semibold text-right text-amber-600 bg-amber-50">Pending Amt</th>
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
                  <td className="px-6 py-4 text-right font-bold text-amber-600 bg-amber-50/50">{row.pendingQty.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-amber-600 bg-amber-50/50">{formatCurrency(row.pendingAmount)}</td>
                </tr>
              ))}
              {data.summary.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Data Tabs */}
      <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="border-b border-border bg-muted/20 px-4 flex space-x-1 overflow-x-auto">
          {[
            { key: "sales", label: "Sales Details" },
            { key: "pending", label: `Pending Pavati (${data.pendingCount})` },
            { key: "purchase", label: `Purchase Exceptions (${data.unmatchedPurchaseCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={cn(
                "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {(activeTab === "sales" || activeTab === "pending") && (
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Sale Date</th>
                  <th className="px-6 py-4 font-semibold">Item</th>
                  <th className="px-6 py-4 font-semibold text-right">Qty (QTL)</th>
                  <th className="px-6 py-4 font-semibold text-right">Rate</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                  <th className="px-6 py-4 font-semibold">Purchase Bill Date</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.salesRows
                  .filter((r) => (activeTab === "pending" ? r.status === "Pending" : true))
                  .map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-6 py-3 whitespace-nowrap">{formatDate(row.saleDate)}</td>
                      <td className="px-6 py-3 font-medium">{row.item}</td>
                      <td className="px-6 py-3 text-right">{row.qty.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right">{row.rate}</td>
                      <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                        {row.purchaseBillDate ? formatDate(row.purchaseBillDate) : "—"}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                {data.salesRows.filter((r) => (activeTab === "pending" ? r.status === "Pending" : true)).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "purchase" && (
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Bill Date</th>
                  <th className="px-6 py-4 font-semibold text-primary">Orig. Purchase Date</th>
                  <th className="px-6 py-4 font-semibold">Item</th>
                  <th className="px-6 py-4 font-semibold text-right">Qty (QTL)</th>
                  <th className="px-6 py-4 font-semibold text-right">Rate</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.purchaseRows
                  .filter((r) => r.status !== "Matched")
                  .map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-6 py-3 whitespace-nowrap">{formatDate(row.billDate)}</td>
                      <td className="px-6 py-3 whitespace-nowrap font-medium text-primary">{formatDate(row.purchaseDate)}</td>
                      <td className="px-6 py-3">{row.item}</td>
                      <td className="px-6 py-3 text-right">{row.qty.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right">{row.rate}</td>
                      <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                      <td className="px-6 py-3 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                {data.purchaseRows.filter((r) => r.status !== "Matched").length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">All purchase bills matched</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const [appMode, setAppMode] = useState<AppMode>("upload");
  const [uploadMode, setUploadMode] = useState<UploadMode>("both");
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ReconciliationResult | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { mutate: runReconciliation, isPending, error, reset: resetMutation } = useRunReconciliation({
    mutation: {
      onSuccess: (data) => {
        setUploadResult(data);
      },
    },
  });

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useGetReports({
    query: { enabled: appMode === "reports" },
  });

  const handleRun = () => {
    if (!purchaseFile) return;
    const formData = new FormData();
    if (salesFile) formData.append("salesFile", salesFile);
    formData.append("purchaseFile", purchaseFile);

    runReconciliation({ data: { salesFile: salesFile ?? undefined, purchaseFile } });
  };

  const handleNewUpload = () => {
    setSalesFile(null);
    setPurchaseFile(null);
    setUploadResult(null);
    resetMutation();
  };

  const handleSwitchToReports = () => {
    setAppMode("reports");
    refetchReports();
  };

  const handleSwitchToUpload = () => {
    setAppMode("upload");
  };

  const handleDeleteSuccess = () => {
    setUploadResult(null);
    refetchReports();
  };

  const isRunDisabled = !purchaseFile || isPending;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <h1 className="font-display font-bold text-xl text-foreground">AgriRecon System</h1>
          </div>
          <div className="flex items-center space-x-3">
            {appMode === "upload" && uploadResult && (
              <button
                onClick={handleNewUpload}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>New Upload</span>
              </button>
            )}
            <button
              onClick={appMode === "reports" ? handleSwitchToUpload : handleSwitchToReports}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                appMode === "reports"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {appMode === "reports" ? (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  <span>Reports</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        <AnimatePresence mode="wait">
          {/* ── REPORTS MODE ── */}
          {appMode === "reports" && (
            <motion.div
              key="reports-mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {reportsLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">Loading saved records...</p>
                </div>
              ) : reportsData && (reportsData.salesRows.length > 0 || reportsData.purchaseRows.length > 0) ? (
                <ResultsView
                  data={reportsData}
                  showDeleteButton
                  onDelete={() => setShowDeleteModal(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
                  <div className="p-6 bg-muted/50 rounded-full">
                    <FileSpreadsheet className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">No Records Yet</h3>
                    <p className="text-muted-foreground mt-1">Upload your sales and purchase files to start reconciling.</p>
                  </div>
                  <button
                    onClick={handleSwitchToUpload}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Go to Upload</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── UPLOAD MODE ── */}
          {appMode === "upload" && (
            <motion.div
              key="upload-mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Upload Panel (hide after result) */}
              <AnimatePresence>
                {!uploadResult && (
                  <motion.div
                    key="upload-panel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden"
                  >
                    <div className="p-6 md:p-8 border-b border-border">
                      <h2 className="text-xl font-display font-bold text-foreground flex items-center space-x-2">
                        <LayoutDashboard className="w-6 h-6 text-primary" />
                        <span>Upload & Match</span>
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Matches purchase bills against <strong>all saved sales records</strong> (including previous uploads).
                      </p>
                    </div>

                    <div className="p-6 md:p-8">
                      {/* Upload Mode Toggle */}
                      <div className="flex rounded-xl overflow-hidden border border-border mb-8 w-fit">
                        <button
                          onClick={() => setUploadMode("both")}
                          className={cn(
                            "px-5 py-2.5 text-sm font-medium transition-colors",
                            uploadMode === "both"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Sales + Purchase
                        </button>
                        <button
                          onClick={() => { setUploadMode("purchase-only"); setSalesFile(null); }}
                          className={cn(
                            "px-5 py-2.5 text-sm font-medium transition-colors border-l border-border",
                            uploadMode === "purchase-only"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Purchase Bills Only
                        </button>
                      </div>

                      <div className={cn("grid gap-8", uploadMode === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-lg")}>
                        {uploadMode === "both" && (
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-foreground flex justify-between">
                              <span>Sales Data</span>
                              <span className="text-muted-foreground font-normal">Step 1</span>
                            </label>
                            <FileDropzone label="Sales Excel" file={salesFile} onFileChange={setSalesFile} />
                          </div>
                        )}
                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-foreground flex justify-between">
                            <span>Purchase Bills</span>
                            {uploadMode === "both" && <span className="text-muted-foreground font-normal">Step 2</span>}
                          </label>
                          <FileDropzone label="Purchase Excel" file={purchaseFile} onFileChange={setPurchaseFile} />
                        </div>
                      </div>

                      {uploadMode === "purchase-only" && (
                        <p className="mt-4 text-sm text-muted-foreground flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>Purchase bills will be matched against <strong>all previously saved pending sales</strong>.</span>
                        </p>
                      )}

                      {error && (
                        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                          <div>
                            <h4 className="font-semibold text-destructive text-sm">Matching Failed</h4>
                            <p className="text-sm text-destructive/80 mt-0.5">{(error as { error?: string }).error || "An unknown error occurred"}</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={handleRun}
                          disabled={isRunDisabled}
                          className="flex items-center space-x-2 px-8 py-4 rounded-xl font-semibold text-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 ease-out w-full md:w-auto"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-6 h-6" />
                              <span>Run Strict Match</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Upload Result */}
              <AnimatePresence>
                {uploadResult && (
                  <motion.div
                    key="upload-result"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <ResultsView
                      data={uploadResult}
                      showDeleteButton
                      onDelete={() => setShowDeleteModal(true)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteModal
            onClose={() => setShowDeleteModal(false)}
            onSuccess={handleDeleteSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
