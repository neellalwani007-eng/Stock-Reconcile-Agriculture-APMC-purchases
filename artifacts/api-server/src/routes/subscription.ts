import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const TRIAL_DAYS = 7;
const WARNING_DAYS = 30;
const GRACE_DAYS = 15;

export type SubState = "trial" | "active" | "warning" | "grace" | "locked";

export interface SubscriptionStatus {
  state: SubState;
  canUpload: boolean;
  trialDaysLeft?: number;
  daysRemaining?: number;
  graceDaysLeft?: number;
  expiresOn?: string;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const user = await db
    .select({ createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);

  if (!user) return { state: "locked", canUpload: false };

  const now = new Date();

  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.expiresOn))
    .limit(1);

  const latest = subs[0];

  if (latest) {
    const msToExpiry = latest.expiresOn.getTime() - now.getTime();
    const daysToExpiry = Math.floor(msToExpiry / (1000 * 60 * 60 * 24));
    const daysPastExpiry = Math.floor(-msToExpiry / (1000 * 60 * 60 * 24));

    if (daysToExpiry >= 0) {
      if (daysToExpiry <= WARNING_DAYS) {
        return { state: "warning", canUpload: true, daysRemaining: daysToExpiry, expiresOn: fmtDate(latest.expiresOn) };
      }
      return { state: "active", canUpload: true, daysRemaining: daysToExpiry, expiresOn: fmtDate(latest.expiresOn) };
    }

    const graceDaysLeft = GRACE_DAYS - daysPastExpiry;
    if (graceDaysLeft > 0) {
      return { state: "grace", canUpload: true, graceDaysLeft, expiresOn: fmtDate(latest.expiresOn) };
    }

    return { state: "locked", canUpload: false, expiresOn: fmtDate(latest.expiresOn) };
  }

  const trialDaysUsed = daysBetween(user.createdAt, now);
  const trialDaysLeft = Math.max(0, TRIAL_DAYS - trialDaysUsed);

  if (trialDaysLeft > 0) {
    return { state: "trial", canUpload: true, trialDaysLeft };
  }

  return { state: "locked", canUpload: false };
}

router.get("/status", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const status = await getSubscriptionStatus(req.user.id);
    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

export default router;
