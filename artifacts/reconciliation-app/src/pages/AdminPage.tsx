import { useState, useEffect } from "react";
import { ArrowRightLeft, Users, CheckCircle2, AlertTriangle, Lock, Clock, RefreshCcw, Loader2, LogOut, ShieldCheck, Receipt, Save } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

type SubState = "trial" | "active" | "warning" | "grace" | "locked";

interface SubStatus {
  state: SubState;
  canUpload: boolean;
  daysRemaining?: number;
  trialDaysLeft?: number;
  graceDaysLeft?: number;
  expiresOn?: string;
}

interface AdminSubscription {
  id: string;
  userId: string;
  durationYears: number;
  activatedOn: string;
  expiresOn: string;
  paymentSource: string | null;
  paymentReference: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  subscription: AdminSubscription | null;
  subscriptions: AdminSubscription[];
  status: SubStatus;
}

function stateBadge(state: SubState) {
  const map: Record<SubState, { label: string; cls: string }> = {
    trial:   { label: "Trial",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    active:  { label: "Active",  cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    warning: { label: "Expiring",cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    grace:   { label: "Grace",   cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    locked:  { label: "Locked",  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const { label, cls } = map[state];
  return <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full border", cls)}>{label}</span>;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<"licenses" | "payments">("licenses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState<string | null>(null);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { source: string; reference: string }>>({});
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const [paymentMessages, setPaymentMessages] = useState<Record<string, { text: string; error?: boolean }>>({});

  const fetchUsers = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/admin/users`, { credentials: "include" });
      if (res.status === 404) { setError("Access denied."); setLoading(false); return; }
      if (!res.ok) {
        setError(`The server returned an error (${res.status}). Check the server logs and database migration.`);
        return;
      }
      setUsers(await res.json());
    } catch {
      setError("Could not reach the server. Check the API service.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const issueLicense = async (userId: string, years: number) => {
    setIssuing(userId + "-" + years);
    try {
      const res = await fetch(`${BASE}/api/admin/users/${userId}/license`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ years }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchUsers();
    } catch { alert("Failed to issue license. Please try again."); }
    finally { setIssuing(null); }
  };

  const revokeLicense = async (userId: string) => {
    if (!confirm("Revoke all licenses for this user?")) return;
    setIssuing(userId + "-revoke");
    try {
      const res = await fetch(`${BASE}/api/admin/users/${userId}/license`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      await fetchUsers();
    } catch { alert("Failed to revoke. Please try again."); }
    finally { setIssuing(null); }
  };

  const updatePaymentDraft = (subscriptionId: string, key: "source" | "reference", value: string, subscription: AdminSubscription) => {
    setPaymentDrafts((drafts) => ({
      ...drafts,
      [subscriptionId]: {
        source: drafts[subscriptionId]?.source ?? subscription.paymentSource ?? "",
        reference: drafts[subscriptionId]?.reference ?? subscription.paymentReference ?? "",
        [key]: value,
      },
    }));
    setPaymentMessages((messages) => {
      const next = { ...messages };
      delete next[subscriptionId];
      return next;
    });
  };

  const savePaymentDetails = async (owner: AdminUser, subscription: AdminSubscription) => {
    const draft = paymentDrafts[subscription.id] ?? {
      source: subscription.paymentSource ?? "",
      reference: subscription.paymentReference ?? "",
    };
    setSavingPayment(subscription.id);
    setPaymentMessages((messages) => {
      const next = { ...messages };
      delete next[subscription.id];
      return next;
    });
    try {
      const res = await fetch(`${BASE}/api/admin/users/${encodeURIComponent(owner.id)}/license/${encodeURIComponent(subscription.id)}/payment`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentSource: draft.source, paymentReference: draft.reference }),
      });
      if (!res.ok) throw new Error("Could not save payment details.");
      const data = await res.json() as { subscription: AdminSubscription };
      const updated = data.subscription;
      setUsers((current) => current.map((u) => u.id !== owner.id ? u : {
        ...u,
        subscription: u.subscription?.id === updated.id ? updated : u.subscription,
        subscriptions: u.subscriptions.map((entry) => entry.id === updated.id ? updated : entry),
      }));
      setPaymentDrafts((drafts) => ({
        ...drafts,
        [updated.id]: {
          source: updated.paymentSource ?? "",
          reference: updated.paymentReference ?? "",
        },
      }));
      setPaymentMessages((messages) => ({ ...messages, [updated.id]: { text: "Saved" } }));
    } catch {
      setPaymentMessages((messages) => ({ ...messages, [subscription.id]: { text: "Save failed. Try again.", error: true } }));
    } finally {
      setSavingPayment(null);
    }
  };

  const paymentRows = users
    .flatMap((owner) => owner.subscriptions.map((subscription) => ({ owner, subscription })))
    .sort((a, b) => new Date(b.subscription.activatedOn).getTime() - new Date(a.subscription.activatedOn).getTime());

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">Stock Reconciler</h1>
              <p className="text-xs text-muted-foreground -mt-0.5 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" /><span>Admin Panel</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <button onClick={logout} title="Log out"
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {activeTab === "licenses" ? <Users className="w-5 h-5 text-primary" /> : <Receipt className="w-5 h-5 text-primary" />}
            <div>
              <h2 className="text-xl font-bold text-foreground">{activeTab === "licenses" ? "User Licenses" : "Payment Ref No."}</h2>
              <p className="text-xs text-muted-foreground">
                {activeTab === "licenses" ? `${users.length} users` : `${paymentRows.length} license payment records`}
              </p>
            </div>
          </div>
          <button onClick={fetchUsers} disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button onClick={() => setActiveTab("licenses")}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "licenses" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <span className="inline-flex items-center gap-2"><Users className="w-4 h-4" />User Licenses</span>
          </button>
          <button onClick={() => setActiveTab("payments")}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "payments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <span className="inline-flex items-center gap-2"><Receipt className="w-4 h-4" />Payment Ref No.</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && !error && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">{activeTab === "licenses" ? "No users yet." : "No license payment records yet."}</div>
        )}

        {!loading && !error && users.length > 0 && activeTab === "licenses" && (
          <div className="space-y-3">
            {users.map((u) => {
              const { status, subscription } = u;
              const isIssuingAny = issuing?.startsWith(u.id);
              return (
                <div key={u.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-semibold text-foreground truncate">
                          {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "—"}
                        </span>
                        {stateBadge(status.state)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground flex-wrap gap-y-1">
                        <span>Joined: {fmtDate(u.createdAt)}</span>
                        {subscription && <span>License: {subscription.durationYears}yr · Expires: {fmtDate(subscription.expiresOn)}</span>}
                        {status.state === "trial" && <span className="text-blue-400">Trial: {status.trialDaysLeft}d left</span>}
                        {status.state === "warning" && <span className="text-yellow-400">Expires in {status.daysRemaining}d</span>}
                        {status.state === "grace" && <span className="text-orange-400">Grace: {status.graceDaysLeft}d left</span>}
                        {status.state === "locked" && <span className="text-red-400">Locked</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-2">
                      {[1, 3].map((yrs) => (
                        <button key={yrs}
                          onClick={() => issueLicense(u.id, yrs)}
                          disabled={!!issuing}
                          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                          {issuing === u.id + "-" + yrs
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle2 className="w-3 h-3" />}
                          <span>{subscription && subscription.expiresOn > new Date().toISOString() ? "+" : ""}{yrs}yr License</span>
                        </button>
                      ))}
                      {subscription && (
                        <button onClick={() => revokeLicense(u.id)} disabled={!!issuing}
                          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                          {issuing === u.id + "-revoke" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && users.length > 0 && activeTab === "payments" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">License payment details</h3>
              <p className="mt-1 text-xs text-muted-foreground">Record where each payment came from and its reference number.</p>
            </div>
            {paymentRows.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">No license payment records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm text-left">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">License</th>
                      <th className="px-4 py-3 font-semibold">Payment received from</th>
                      <th className="px-4 py-3 font-semibold">Reference no.</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paymentRows.map(({ owner, subscription }) => {
                      const draft = paymentDrafts[subscription.id] ?? {
                        source: subscription.paymentSource ?? "",
                        reference: subscription.paymentReference ?? "",
                      };
                      const message = paymentMessages[subscription.id];
                      const isDirty = draft.source !== (subscription.paymentSource ?? "")
                        || draft.reference !== (subscription.paymentReference ?? "");
                      return (
                        <tr key={subscription.id} className="align-top hover:bg-muted/10">
                          <td className="px-4 py-4">
                            <p className="font-medium text-foreground">{owner.firstName || owner.lastName ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : "—"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{owner.email}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Issued {fmtDate(subscription.activatedOn)}</p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <p className="font-medium text-foreground">{subscription.durationYears} year{subscription.durationYears === 1 ? "" : "s"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Expires {fmtDate(subscription.expiresOn)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <input type="text" maxLength={160} value={draft.source}
                              aria-label={`Payment received from for ${owner.email}`}
                              onChange={(e) => updatePaymentDraft(subscription.id, "source", e.target.value, subscription)}
                              placeholder="UPI, bank, cash, etc."
                              className="w-full min-w-44 px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </td>
                          <td className="px-4 py-4">
                            <input type="text" maxLength={200} value={draft.reference}
                              aria-label={`Payment reference number for ${owner.email}`}
                              onChange={(e) => updatePaymentDraft(subscription.id, "reference", e.target.value, subscription)}
                              placeholder="Transaction / receipt number"
                              className="w-full min-w-52 px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button onClick={() => savePaymentDetails(owner, subscription)}
                              disabled={!isDirty || savingPayment === subscription.id}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                              {savingPayment === subscription.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              <span>{savingPayment === subscription.id ? "Saving" : "Save"}</span>
                            </button>
                            {message && <p className={cn("mt-1.5 text-[11px]", message.error ? "text-destructive" : "text-green-400")}>{message.text}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "licenses" && (
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">How to issue licenses:</p>
            <p>• <strong>+1yr / +3yr</strong> — adds 1 or 3 years to the existing expiry (or from today if expired/no license)</p>
            <p>• <strong>Revoke</strong> — immediately locks the user out (upload disabled, reports still accessible)</p>
            <p>• Trial users have 7 days from signup. Warning banner appears 30 days before expiry. 15-day grace period after expiry.</p>
          </div>
        )}
      </main>
    </div>
  );
}
