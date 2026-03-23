import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
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

const DELETE_PASSWORD = "Correct";

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

async function loadAllFromDb(): Promise<{ salesRows: SaleRow[]; purchaseRows: PurchaseRow[] }> {
  const [allSales, allPurchases] = await Promise.all([
    db.select().from(saleRecords).orderBy(saleRecords.saleDate, saleRecords.id),
    db.select().from(purchaseRecords).orderBy(purchaseRecords.billDate, purchaseRecords.id),
  ]);
  return {
    salesRows: allSales.map(dbRowToSaleRow),
    purchaseRows: allPurchases.map(dbRowToPurchaseRow),
  };
}

// POST /reconciliation/run
router.post(
  "/run",
  upload.fields([
    { name: "salesFile", maxCount: 1 },
    { name: "purchaseFile", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;

      if (!files["purchaseFile"]) {
        res.status(400).json({ error: "purchaseFile is required." });
        return;
      }

      // Parse new purchase rows
      const newPurchaseRows = parsePurchaseSheet(files["purchaseFile"][0].buffer);
      if (newPurchaseRows.length === 0) {
        res.status(400).json({ error: "Purchase file appears empty or headers not recognized. Expected columns: Date, Purchase Date, Item, QTY, Rate, Amount" });
        return;
      }

      // Parse new sales rows (optional)
      let newSalesRows: ReturnType<typeof parseSalesSheet> = [];
      if (files["salesFile"]) {
        newSalesRows = parseSalesSheet(files["salesFile"][0].buffer);
        if (newSalesRows.length === 0) {
          res.status(400).json({ error: "Sales file appears empty or headers not recognized. Expected columns: Sale Date, Item, Qty, Rate, Amount" });
          return;
        }
      }

      // Insert new sales rows into DB (as Pending)
      if (newSalesRows.length > 0) {
        await db.insert(saleRecords).values(
          newSalesRows.map((r) => ({
            saleDate: r.saleDate,
            item: r.item,
            qty: String(r.qty),
            rate: String(r.rate),
            amount: String(r.amount),
            status: "Pending",
          }))
        );
      }

      // Insert new purchase rows into DB (as Unmatched)
      await db.insert(purchaseRecords).values(
        newPurchaseRows.map((r) => ({
          billDate: r.billDate,
          purchaseDate: r.purchaseDate,
          item: r.item,
          qty: String(r.qty),
          rate: String(r.rate),
          amount: String(r.amount),
          status: "Unmatched",
        }))
      );

      // Load ALL pending/unmatched records from DB for matching
      const [allPendingSales, allUnmatchedPurchases] = await Promise.all([
        db.select().from(saleRecords).where(eq(saleRecords.status, "Pending")),
        db.select().from(purchaseRecords).where(eq(purchaseRecords.status, "Unmatched")),
      ]);

      const pendingSaleRows: SaleRow[] = allPendingSales.map(dbRowToSaleRow);
      const unmatchedPurchaseRows: PurchaseRow[] = allUnmatchedPurchases.map(dbRowToPurchaseRow);

      // Run exact matching
      const { updates } = runMatching(pendingSaleRows, unmatchedPurchaseRows);

      // Persist match results to DB
      if (updates.length > 0) {
        await Promise.all(
          updates.map(({ saleId, purchaseId, purchaseBillDate }) =>
            Promise.all([
              db.update(saleRecords)
                .set({ status: "Matched", purchaseBillDate })
                .where(eq(saleRecords.id, saleId)),
              db.update(purchaseRecords)
                .set({ status: "Matched" })
                .where(eq(purchaseRecords.id, purchaseId)),
            ])
          )
        );
      }

      // Load full updated state from DB and return
      const { salesRows, purchaseRows } = await loadAllFromDb();
      const result = buildResult(salesRows, purchaseRows);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "Reconciliation run failed");
      res.status(400).json({ error: "Failed to process files. Ensure they are valid Excel files." });
    }
  }
);

// GET /reconciliation/reports
router.get("/reports", async (req: Request, res: Response) => {
  try {
    const { salesRows, purchaseRows } = await loadAllFromDb();
    const result = buildResult(salesRows, purchaseRows);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to load reports");
    res.status(500).json({ error: "Failed to load reports from database." });
  }
});

// DELETE /reconciliation/records
router.delete("/records", async (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || password !== DELETE_PASSWORD) {
      res.status(401).json({ error: "Incorrect password. Access denied." });
      return;
    }

    const [deletedSalesResult, deletedPurchasesResult] = await Promise.all([
      db.delete(saleRecords),
      db.delete(purchaseRecords),
    ]);

    res.json({
      message: "All records deleted successfully.",
      deletedSales: deletedSalesResult.rowCount ?? 0,
      deletedPurchases: deletedPurchasesResult.rowCount ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to delete records");
    res.status(500).json({ error: "Failed to delete records." });
  }
});

// POST /reconciliation/download/:fileType
router.post("/download/:fileType", (req: Request, res: Response) => {
  try {
    const { fileType } = req.params;
    const result: ReconciliationResult = req.body;

    if (!result || !result.salesRows || !result.purchaseRows) {
      res.status(400).json({ error: "Invalid reconciliation result in request body." });
      return;
    }

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
