import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileSpreadsheet, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  LayoutDashboard,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCcw
} from "lucide-react";
import { useRunReconciliation } from "@workspace/api-client-react";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useReconciliationDownloads } from "@/hooks/use-reconciliation-downloads";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export default function Dashboard() {
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"sales" | "purchase" | "pending">("sales");

  const { mutate: runReconciliation, data, isPending, error, reset } = useRunReconciliation();
  const { handleDownload, downloading } = useReconciliationDownloads(data);

  const handleRun = () => {
    if (salesFile && purchaseFile) {
      runReconciliation({
        data: {
          salesFile,
          purchaseFile
        }
      });
    }
  };

  const handleReset = () => {
    setSalesFile(null);
    setPurchaseFile(null);
    reset();
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <h1 className="font-display font-bold text-xl text-foreground">
              AgriRecon System
            </h1>
          </div>
          {data && (
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>New Reconciliation</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Upload Section - Only show if no data yet */}
        <AnimatePresence mode="wait">
          {!data && (
            <motion.div 
              key="upload-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, height: 0 }}
              className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-border">
                <h2 className="text-xl font-display font-bold text-foreground flex items-center space-x-2">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                  <span>Data Import</span>
                </h2>
                <p className="text-muted-foreground mt-1">
                  Upload your sales and purchase bill records to identify pending farmer payments.
                </p>
              </div>
              
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground flex justify-between">
                      <span>Sales Data</span>
                      <span className="text-muted-foreground font-normal">Step 1</span>
                    </label>
                    <FileDropzone 
                      label="Sales Excel" 
                      file={salesFile} 
                      onFileChange={setSalesFile} 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground flex justify-between">
                      <span>Purchase Bills</span>
                      <span className="text-muted-foreground font-normal">Step 2</span>
                    </label>
                    <FileDropzone 
                      label="Purchase Excel" 
                      file={purchaseFile} 
                      onFileChange={setPurchaseFile} 
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive-foreground rounded-xl flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                    <div>
                      <h4 className="font-semibold text-destructive">Reconciliation Failed</h4>
                      <p className="text-sm opacity-90">{error.error || "An unknown error occurred"}</p>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleRun}
                    disabled={!salesFile || !purchaseFile || isPending}
                    className="
                      flex items-center space-x-2 px-8 py-4 rounded-xl font-semibold text-lg
                      bg-primary text-primary-foreground shadow-lg shadow-primary/25
                      hover:shadow-xl hover:-translate-y-0.5
                      active:translate-y-0 active:shadow-md
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                      transition-all duration-200 ease-out w-full md:w-auto
                    "
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Processing Exact Matching...</span>
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

        {/* Results Section */}
        <AnimatePresence>
          {data && (
            <motion.div
              key="results-section"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="space-y-8"
            >
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
                <div className="p-6 border-b border-border bg-muted/20">
                  <h3 className="font-display font-semibold text-lg text-foreground">Export Reports</h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 'updated-sales', label: 'Updated Sales', desc: 'With Bill Dates' },
                    { id: 'pending-pavati', label: 'Pending Pavati', desc: 'Farmers awaiting payment' },
                    { id: 'datewise-report', label: 'Date-wise Report', desc: 'Grouped by sale date' },
                    { id: 'purchase-exceptions', label: 'Purchase Exceptions', desc: 'Unmatched/Extra entries' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => handleDownload(btn.id as any, `${btn.id}.xlsx`)}
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

              {/* Commodity Summary Table */}
              <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
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
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Detailed Data Tabs */}
              <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="border-b border-border bg-muted/20 px-4 flex space-x-1 overflow-x-auto">
                  <button 
                    onClick={() => setActiveTab('sales')}
                    className={cn(
                      "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                      activeTab === 'sales' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sales Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('pending')}
                    className={cn(
                      "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                      activeTab === 'pending' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Pending Pavati (Unmatched)
                  </button>
                  <button 
                    onClick={() => setActiveTab('purchase')}
                    className={cn(
                      "px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                      activeTab === 'purchase' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Purchase Exceptions
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  {/* Sales Table */}
                  {(activeTab === 'sales' || activeTab === 'pending') && (
                    <table className="w-full text-sm text-left relative">
                      <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Sale Date</th>
                          <th className="px-6 py-4 font-semibold">Item</th>
                          <th className="px-6 py-4 font-semibold text-right">Qty (QTL)</th>
                          <th className="px-6 py-4 font-semibold text-right">Rate</th>
                          <th className="px-6 py-4 font-semibold text-right">Amount</th>
                          <th className="px-6 py-4 font-semibold">Bill Date</th>
                          <th className="px-6 py-4 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.salesRows
                          .filter(r => activeTab === 'pending' ? r.status === 'Pending' : true)
                          .map((row, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-6 py-3 whitespace-nowrap">{formatDate(row.saleDate)}</td>
                            <td className="px-6 py-3 font-medium">{row.item}</td>
                            <td className="px-6 py-3 text-right">{row.qty.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right">{row.rate}</td>
                            <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                              {row.purchaseBillDate ? formatDate(row.purchaseBillDate) : '-'}
                            </td>
                            <td className="px-6 py-3 text-center">
                              <StatusBadge status={row.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Purchase Table */}
                  {activeTab === 'purchase' && (
                    <table className="w-full text-sm text-left relative">
                      <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 border-b border-border shadow-sm z-10">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Bill Date</th>
                          <th className="px-6 py-4 font-semibold text-primary">Orig. Pur. Date</th>
                          <th className="px-6 py-4 font-semibold">Item</th>
                          <th className="px-6 py-4 font-semibold text-right">Qty (QTL)</th>
                          <th className="px-6 py-4 font-semibold text-right">Rate</th>
                          <th className="px-6 py-4 font-semibold text-right">Amount</th>
                          <th className="px-6 py-4 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.purchaseRows.map((row, i) => (
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
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
