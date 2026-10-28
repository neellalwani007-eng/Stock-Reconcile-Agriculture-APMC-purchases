import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getSubscriptionStatus } from "./subscription.js";

const router: IRouter = Router();

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "";

function isAdmin(req: Request): boolean {
  return req.isAuthenticated() && !!ADMIN_EMAIL && req.user.email === ADMIN_EMAIL;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

router.use((req: Request, res: Response, next) => {
  if (!isAdmin(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
});

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);

    const withStatus = await Promise.all(
      users.map(async (u) => {
        const subs = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.userId, u.id))
          .orderBy(desc(subscriptionsTable.expiresOn))
          .limit(1);

        const status = await getSubscriptionStatus(u.id);

        return {
          ...u,
          subscription: subs[0] ?? null,
          status,
        };
      })
    );

    res.json(withStatus);
  } catch {
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.post("/users/:userId/license", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const years = Number(req.body?.years);

  if (![1, 2, 3].includes(years)) {
    res.status(400).json({ error: "years must be 1, 2, or 3" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .orderBy(desc(subscriptionsTable.expiresOn))
      .limit(1);

    const now = new Date();
    const baseDate = existing[0] && existing[0].expiresOn > now ? existing[0].expiresOn : now;
    const expiresOn = addYears(baseDate, years);

    await db.insert(subscriptionsTable).values({
      userId,
      durationYears: years,
      activatedOn: now,
      expiresOn,
      issuedBy: req.user.email ?? "admin",
    });

    const status = await getSubscriptionStatus(userId);
    res.json({ ok: true, expiresOn, status });
  } catch {
    res.status(500).json({ error: "Failed to issue license" });
  }
});

router.delete("/users/:userId/license", async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to revoke license" });
  }
});

export default router;
