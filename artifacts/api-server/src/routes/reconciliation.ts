import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { and, eq, inArray } from "drizzle-orm";
import { db, saleRecords, purchaseRecords } from "@workspace/db";
import {
  parseSalesSheet,
  parsePurchaseSheet,
  runMatching,
  buildResult,
  buildUpdatedSalesExcel,
  buildPendingPavatiExcel,
  buildDatewiseReportExcel,
  buildPurchaseExceptionsExcel,
  type SaleRow,
  type PurchaseRow,
  type ReconciliationResult,
} from "../lib/reconciliation.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Merge rows from multiple files
function parseSalesFiles(files: Express.Multer.File[]): ReturnType<typeof parseSalesSheet> {
  const all: ReturnType<typeof parseSalesSheet> = [];
  for (const f of files) all.push(...parseSalesSheet(f.buffer));
  return all;
}

function parsePurchaseFiles(files: Express.Multer.File[]): ReturnType<typeof parsePurchaseSheet> {
  const all: ReturnType<typeof parsePurchaseSheet> = [];
  for (const f of files) all.push(...parsePurchaseSheet(f.buffer));
  return all;
}

function dbRowToSaleRow(r: typeof saleRecords.$inferSelect): SaleRow {
  return {
    id: r.id,
    saleDate: r.saleDate,
    item: r.item,
    qty: parseFloat(r.qty),
    rate: parseFloat(r.rate),
    amount: parseFloat(r.amount),
    purchaseBillDate: r.purchaseBillDate ?? null,
    status: r.status as "Matched" | "Pending",
  };
}

function dbRowToPurchaseRow(r: typeof purchaseRecords.$inferSelect): PurchaseRow {
  return {
    id: r.id,
    billDate: r.billDate,
    purchaseDate: r.purchaseDate,
    item: r.item,
    qty: parseFloat(r.qty),
    rate: parseFloat(r.rate),
    amount: parseFloat(r.amount),
    status: r.status as "Matched" | "Unmatched" | "Extra",
  };
}

async function loadAllFromDb(userId: string): Promise<{ salesRows: SaleRow[]; purchaseRows: PurchaseRow[] }> {
  const [allSales, allPurchases] = await Promise.all([
    db.select().from(saleRecords)
      .where(eq(saleRecords.userId, userId))
      .orderBy(saleRecords.saleDate, saleRecords.id),
    db.select().from(purchaseRecords)
      .where(eq(purchaseRecords.userId, userId))
      .orderBy(purchaseRecords.billDate, purchaseRecords.id),
  ]);
  return {
    salesRows: allSales.map(dbRowToSaleRow),
    purchaseRows: allPurchases.map(dbRowToPurchaseRow),
  };
}

// Re-run matching for all pending/unmatched records for a user and persist results
async function runMatchingForUser(userId: string): Promise<ReconciliationResult> {
  // Reset all matches first — find currently matched records and reset them
  await Promise.all([
    db.update(saleRecords)
      .set({ status: "Pending", purchaseBillDate: null })
      .where(and(eq(saleRecords.userId, userId), eq(saleRecords.status, "Matched"))),
    db.update(purchaseRecords)
      .set({ status: "Unmatched" })
      .where(and(eq(purchaseRecords.userId, userId), eq(purchaseRecords.status, "Matched"))),
  ]);

  const [allSales, allPurchases] = await Promise.all([
    db.select().from(saleRecords).where(eq(saleRecords.userId, userId)),
    db.select().from(purchaseRecords).where(eq(purchaseRecords.userId, userId)),
  ]);

  const pendingSaleRows: SaleRow[] = allSales.map(dbRowToSaleRow);
  const unmatchedPurchaseRows: PurchaseRow[] = allPurchases.map(dbRowToPurchaseRow);

  const { updates } = runMatching(pendingSaleRows, unmatchedPurchaseRows);

  if (updates.length > 0) {
    await Promise.all(
      updates.map(({ saleId, purchaseId, purchaseBillDate }) =>
        Promise.all([
          db.update(saleRecords)
            .set({ status: "Matched", purchaseBillDate })
            .where(and(eq(saleRecords.id, saleId), eq(saleRecords.userId, userId))),
          db.update(purchaseRecords)
            .set({ status: "Matched" })
            .where(and(eq(purchaseRecords.id, purchaseId), eq(purchaseRecords.userId, userId))),
        ])
      )
    );
  }

  const { salesRows, purchaseRows } = await loadAllFromDb(userId);
  return buildResult(salesRows, purchaseRows);
}

// POST /reconciliation/run — upload sale file only, purchase file only, or both
router.post(
  "/run",
  upload.fields([
    { name: "salesFile", maxCount: 20 },
    { name: "purchaseFile", maxCount: 20 },
  ]),
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Please log in to use this feature." });
      return;
    }
    const userId = req.user.id;

    try {
      const files = req.files as Record<string, Express.Multer.File[]>;

      if (!files["salesFile"] && !files["purchaseFile"]) {
        res.status(400).json({ error: "Please provide at least one file (sales or purchase)." });
        return;
      }

      // Process sales file if provided
      if (files["salesFile"]) {
        const newSalesRows = parseSalesSheet(files["salesFile"][0].buffer);
        if (newSalesRows.length === 0) {
          res.status(400).json({ error: "Sales file appears empty or headers not recognized. Expected: Sale Date, Item, Qty, Rate, Amount" });
          return;
        }
        // Deduplication: for each unique date in the file, remove existing Pending sales for that date
        const datesInFile = [...new Set(newSalesRows.map((r) => r.saleDate))];
        for (const date of datesInFile) {
          await db.delete(saleRecords).where(
            and(
              eq(saleRecords.userId, userId),
              eq(saleRecords.saleDate, date),
              eq(saleRecords.status, "Pending"),
            )
          );
        }
        // Insert all rows from file
        await db.insert(saleRecords).values(
          newSalesRows.map((r) => ({
            userId,
            saleDate: r.saleDate,
            item: r.item,
            qty: String(r.qty),
            rate: String(r.rate),
            amount: String(r.amount),
            status: "Pending",
          }))
        );
      }

      // Process purchase file if provided
      if (files["purchaseFile"]) {
        const newPurchaseRows = parsePurchaseSheet(files["purchaseFile"][0].buffer);
        if (newPurchaseRows.length === 0) {
          res.status(400).json({ error: "Purchase file appears empty or headers not recognized. Expected: Date, Purchase Date, Item, QTY, Rate, Amount" });
          return;
        }
        // Deduplication: for each unique bill date in the file, remove existing Unmatched purchases
        const datesInFile = [...new Set(newPurchaseRows.map((r) => r.billDate))];
        for (const date of datesInFile) {
          await db.delete(purchaseRecords).where(
            and(
              eq(purchaseRecords.userId, userId),
              eq(purchaseRecords.billDate, date),
              eq(purchaseRecords.status, "Unmatched"),
            )
          );
        }
        // Insert all rows from file
        await db.insert(purchaseRecords).values(
          newPurchaseRows.map((r) => ({
            userId,
            billDate: r.billDate,
            purchaseDate: r.purchaseDate,
            item: r.item,
            qty: String(r.qty),
            rate: String(r.rate),
            amount: String(r.amount),
            status: "Unmatched",
          }))
        );
      }

      const result = await runMatchingForUser(userId);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "Reconciliation run failed");
      res.status(400).json({ error: "Failed to process files. Ensure they are valid Excel files." });
    }
  }
);

// GET /reconciliation/reports
router.get("/reports", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(buildResult([], []));
    return;
  }
  try {
    const { salesRows, purchaseRows } = await loadAllFromDb(req.user.id);
    res.json(buildResult(salesRows, purchaseRows));
  } catch (err) {
    req.log.error({ err }, "Failed to load reports");
    res.status(500).json({ error: "Failed to load reports from database." });
  }
});

// POST /reconciliation/records/sale — add individual sale record
router.post("/records/sale", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const userId = req.user.id;
  const { saleDate, item, qty, rate, amount } = req.body as {
    saleDate: string; item: string; qty: number; rate: number; amount: number;
  };
  if (!saleDate || !item || !qty || !rate || !amount) {
    res.status(400).json({ error: "All fields required: saleDate, item, qty, rate, amount" });
    return;
  }
  try {
    await db.insert(saleRecords).values({
      userId,
      saleDate,
      item: String(item).trim(),
      qty: String(qty),
      rate: String(rate),
      amount: String(amount),
      status: "Pending",
    });
    const result = await runMatchingForUser(userId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to add sale record");
    res.status(500).json({ error: "Failed to add sale record." });
  }
});

// POST /reconciliation/records/purchase — add individual purchase record
router.post("/records/purchase", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const userId = req.user.id;
  const { billDate, purchaseDate, item, qty, rate, amount } = req.body as {
    billDate: string; purchaseDate: string; item: string; qty: number; rate: number; amount: number;
  };
  if (!billDate || !purchaseDate || !item || !qty || !rate || !amount) {
    res.status(400).json({ error: "All fields required: billDate, purchaseDate, item, qty, rate, amount" });
    return;
  }
  try {
    await db.insert(purchaseRecords).values({
      userId,
      billDate,
      purchaseDate,
      item: String(item).trim(),
      qty: String(qty),
      rate: String(rate),
      amount: String(amount),
      status: "Unmatched",
    });
    const result = await runMatchingForUser(userId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to add purchase record");
    res.status(500).json({ error: "Failed to add purchase record." });
  }
});

// DELETE /reconciliation/records/sale/:id
router.delete("/records/sale/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const userId = req.user.id;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  try {
    const [existing] = await db.select().from(saleRecords)
      .where(and(eq(saleRecords.id, id), eq(saleRecords.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    // If matched, unlink the matching purchase first
    if (existing.status === "Matched") {
      // Find matching purchase to reset
      await db.update(purchaseRecords)
        .set({ status: "Unmatched" })
        .where(and(
          eq(purchaseRecords.userId, userId),
          eq(purchaseRecords.billDate, existing.purchaseBillDate ?? ""),
          eq(purchaseRecords.purchaseDate, existing.saleDate),
          eq(purchaseRecords.item, existing.item),
          eq(purchaseRecords.qty, existing.qty),
          eq(purchaseRecords.status, "Matched"),
        ));
    }
    await db.delete(saleRecords).where(and(eq(saleRecords.id, id), eq(saleRecords.userId, userId)));
    const result = await runMatchingForUser(userId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to delete sale record");
    res.status(500).json({ error: "Failed to delete sale record." });
  }
});

// DELETE /reconciliation/records/purchase/:id
router.delete("/records/purchase/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const userId = req.user.id;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  try {
    const [existing] = await db.select().from(purchaseRecords)
      .where(and(eq(purchaseRecords.id, id), eq(purchaseRecords.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    await db.delete(purchaseRecords).where(and(eq(purchaseRecords.id, id), eq(purchaseRecords.userId, userId)));
    const result = await runMatchingForUser(userId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to delete purchase record");
    res.status(500).json({ error: "Failed to delete purchase record." });
  }
});

// DELETE /reconciliation/records/date — delete all records for a specific date (sales or purchases)
router.delete("/records/date", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const userId = req.user.id;
  const { date, type } = req.body as { date?: string; type?: "sale" | "purchase" };

  if (!date || !type || !["sale", "purchase"].includes(type)) {
    res.status(400).json({ error: "Provide date (YYYY-MM-DD) and type ('sale' or 'purchase')." });
    return;
  }
  try {
    if (type === "sale") {
      await db.delete(saleRecords).where(
        and(eq(saleRecords.userId, userId), eq(saleRecords.saleDate, date))
      );
    } else {
      await db.delete(purchaseRecords).where(
        and(eq(purchaseRecords.userId, userId), eq(purchaseRecords.billDate, date))
      );
    }
    const result = await runMatchingForUser(userId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to delete records by date");
    res.status(500).json({ error: "Failed to delete records." });
  }
});

// POST /reconciliation/download/:fileType
router.post("/download/:fileType", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  try {
    const { fileType } = req.params;
    // Always fetch fresh data from DB for the user
    const { salesRows, purchaseRows } = await loadAllFromDb(req.user.id);
    const result = buildResult(salesRows, purchaseRows);

    let buffer: Buffer;
    let filename: string;

    switch (fileType) {
      case "updated-sales":
        buffer = buildUpdatedSalesExcel(result);
        filename = "updated_sales.xlsx";
        break;
      case "pending-pavati":
        buffer = buildPendingPavatiExcel(result);
        filename = "pending_pavati.xlsx";
        break;
      case "datewise-report":
        buffer = buildDatewiseReportExcel(result);
        filename = "datewise_report.xlsx";
        break;
      case "purchase-exceptions":
        buffer = buildPurchaseExceptionsExcel(result);
        filename = "purchase_exceptions.xlsx";
        break;
      default:
        res.status(400).json({ error: `Unknown fileType: ${fileType}` });
        return;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Download failed");
    res.status(400).json({ error: "Failed to generate download file." });
  }
});

export default router;
