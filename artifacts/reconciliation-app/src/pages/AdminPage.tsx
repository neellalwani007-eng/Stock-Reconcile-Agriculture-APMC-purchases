import { useState, useEffect } from "react";
import { ArrowRightLeft, Users, CheckCircle2, AlertTriangle, Lock, Clock, RefreshCcw, Loader2, LogOut, ShieldCheck } from "lucide-react";
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

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  subscription: {
    id: string;
    durationYears: number;
    activatedOn: string;
    expiresOn: string;
  } | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/admin/users`, { credentials: "include" });
      if (res.status === 404) { setError("Access denied."); setLoading(false); return; }
      if (!res.ok) throw new Error("Failed to load");
      setUsers(await res.json());
    } catch { setError("Failed to load users. Make sure ADMIN_EMAIL is set correctly."); }
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
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">User Licenses</h2>
            <span className="text-sm text-muted-foreground">({users.length} total)</span>
          </div>
          <button onClick={fetchUsers} disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            <span>Refresh</span>
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
          <div className="text-center py-20 text-muted-foreground">No users yet.</div>
        )}

        {!loading && !error && users.length > 0 && (
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

        <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">How to issue licenses:</p>
          <p>• <strong>+1yr / +3yr</strong> — adds 1 or 3 years to the existing expiry (or from today if expired/no license)</p>
          <p>• <strong>Revoke</strong> — immediately locks the user out (upload disabled, reports still accessible)</p>
          <p>• Trial users have 7 days from signup. Warning banner appears 30 days before expiry. 15-day grace period after expiry.</p>
        </div>
      </main>
    </div>
  );
}
