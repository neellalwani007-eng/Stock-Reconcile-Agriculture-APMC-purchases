import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import {
  parseSalesSheet,
  parsePurchaseSheet,
  runMatching,
  buildResult,
  buildUpdatedSalesExcel,
  buildPendingPavatiExcel,
  buildDatewiseReportExcel,
  buildPurchaseExceptionsExcel,
  buildMonthlyMatrixExcel,
  type SaleRow,
  type PurchaseRow,
  type ReconciliationResult,
} from "../lib/reconciliation.js";
import {
  readUserData,
  writeUserData,
  DriveInsufficientScopeError,
  type DriveUserData,
  type DrSaleRecord,
  type DrPurchaseRecord,
} from "../lib/drive.js";
import { updateSession, type SessionData } from "../lib/auth.js";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function handleDriveError(err: unknown, res: Response, fallbackMsg: string): void {
  if (err instanceof DriveInsufficientScopeError) {
    res.status(401).json({ error: "reauth_required", message: err.message });
  } else {
    res.status(500).json({ error: fallbackMsg });
  }
}

// Merge rows from multiple files
function parseSalesFiles(
  files: Express.Multer.File[],
): ReturnType<typeof parseSalesSheet> {
  const all: ReturnType<typeof parseSalesSheet> = [];
  for (const f of files) all.push(...parseSalesSheet(f.buffer));
  return all;
}

function parsePurchaseFiles(
  files: Express.Multer.File[],
): ReturnType<typeof parsePurchaseSheet> {
  const all: ReturnType<typeof parsePurchaseSheet> = [];
  for (const f of files) all.push(...parsePurchaseSheet(f.buffer));
  return all;
}

function drSaleToRow(r: DrSaleRecord): SaleRow {
  return {
    id: r.id,
    saleDate: r.saleDate,
    item: r.item,
    qty: parseFloat(r.qty),
    rate: parseFloat(r.rate),
    amount: parseFloat(r.amount),
    purchaseBillDate: r.purchaseBillDate,
    status: r.status,
  };
}

function drPurchaseToRow(r: DrPurchaseRecord): PurchaseRow {
  return {
    id: r.id,
    billDate: r.billDate,
    purchaseDate: r.purchaseDate,
    item: r.item,
    qty: parseFloat(r.qty),
    rate: parseFloat(r.rate),
    amount: parseFloat(r.amount),
    status: r.status,
  };
}

// Read user data from Drive, with token refresh callback
async function getDataFromDrive(
  req: Request & { sessionId: string; sessionData: SessionData },
): Promise<DriveUserData> {
  const onTokenRefresh = async (tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }) => {
    if (tokens.access_token) {
      req.sessionData.access_token = tokens.access_token;
    }
    if (tokens.refresh_token) {
      req.sessionData.refresh_token = tokens.refresh_token;
    }
    if (tokens.expiry_date) {
      req.sessionData.expires_at = Math.floor(tokens.expiry_date / 1000);
    }
    await updateSession(req.sessionId, req.sessionData);
  };
  return readUserData(req.sessionData, onTokenRefresh);
}

// Write user data to Drive, with token refresh callback
async function saveDataToDrive(
  req: Request & { sessionId: string; sessionData: SessionData },
  data: DriveUserData,
): Promise<void> {
  const onTokenRefresh = async (tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }) => {
    if (tokens.access_token) {
      req.sessionData.access_token = tokens.access_token;
    }
    if (tokens.refresh_token) {
      req.sessionData.refresh_token = tokens.refresh_token;
    }
    if (tokens.expiry_date) {
      req.sessionData.expires_at = Math.floor(tokens.expiry_date / 1000);
    }
    await updateSession(req.sessionId, req.sessionData);
  };
  await writeUserData(req.sessionData, data, onTokenRefresh);
}

// Run matching on all data and persist results to Drive
async function runMatchingForUser(
  req: Request & { sessionId: string; sessionData: SessionData },
): Promise<ReconciliationResult> {
  const data = await getDataFromDrive(req);

  // Reset all matches
  for (const s of data.sales) {
    if (s.status === "Matched") {
      s.status = "Pending";
      s.purchaseBillDate = null;
    }
  }
  for (const p of data.purchases) {
    if (p.status === "Matched") {
      p.status = "Unmatched";
    }
  }

  const saleRows = data.sales.map(drSaleToRow);
  const purchaseRows = data.purchases.map(drPurchaseToRow);

  const { updates } = runMatching(saleRows, purchaseRows);

  for (const { saleId, purchaseId, purchaseBillDate } of updates) {
    const sale = data.sales.find((s) => s.id === saleId);
    const purchase = data.purchases.find((p) => p.id === purchaseId);
    if (sale) {
      sale.status = "Matched";
      sale.purchaseBillDate = purchaseBillDate;
    }
    if (purchase) {
      purchase.status = "Matched";
    }
  }

  await saveDataToDrive(req, data);

  return buildResult(
    data.sales.map(drSaleToRow),
    data.purchases.map(drPurchaseToRow),
  );
}

// POST /reconciliation/run — upload files
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
    const authedReq = req as Request & {
      sessionId: string;
      sessionData: SessionData;
    };

    try {
      const files = req.files as Record<string, Express.Multer.File[]>;

      if (!files["salesFile"] && !files["purchaseFile"]) {
        res
          .status(400)
          .json({
            error: "Please provide at least one file (sales or purchase).",
          });
        return;
      }

      const data = await getDataFromDrive(authedReq);

      if (files["salesFile"]) {
        const newSalesRows = parseSalesFiles(files["salesFile"]);
        if (newSalesRows.length === 0) {
          res.status(400).json({
            error:
              "Sales file(s) appear empty or headers not recognized. Expected: Sale Date, Item, Qty, Rate, Amount",
          });
          return;
        }
        // Dedup: remove ALL existing sales for dates in the file (regardless of status)
        const datesInFile = new Set(newSalesRows.map((r) => r.saleDate));
        data.sales = data.sales.filter((s) => !datesInFile.has(s.saleDate));
        // Insert new rows
        for (const r of newSalesRows) {
          data.sales.push({
            id: data.nextSaleId++,
            saleDate: r.saleDate,
            item: r.item,
            qty: String(r.qty),
            rate: String(r.rate),
            amount: String(r.amount),
            status: "Pending",
            purchaseBillDate: null,
          });
        }
      }

      if (files["purchaseFile"]) {
        const newPurchaseRows = parsePurchaseFiles(files["purchaseFile"]);
        if (newPurchaseRows.length === 0) {
          res.status(400).json({
            error:
              "Purchase file(s) appear empty or headers not recognized. Expected: Date, Purchase Date, Item, QTY, Rate, Amount",
          });
          return;
        }
        // Dedup: remove ALL existing purchases for bill dates in the file (regardless of status)
        const datesInFile = new Set(newPurchaseRows.map((r) => r.billDate));
        data.purchases = data.purchases.filter((p) => !datesInFile.has(p.billDate));
        // Insert new rows
        for (const r of newPurchaseRows) {
          data.purchases.push({
            id: data.nextPurchaseId++,
            billDate: r.billDate,
            purchaseDate: r.purchaseDate,
            item: r.item,
            qty: String(r.qty),
            rate: String(r.rate),
            amount: String(r.amount),
            status: "Unmatched",
          });
        }
      }

      await saveDataToDrive(authedReq, data);

      // Now run matching
      const result = await runMatchingForUser(authedReq);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "Reconciliation run failed");
      handleDriveError(err, res, "Failed to process files. Ensure they are valid Excel files.");
    }
  },
);

// GET /reconciliation/reports
router.get("/reports", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(buildResult([], []));
    return;
  }
  const authedReq = req as Request & {
    sessionId: string;
    sessionData: SessionData;
  };
  try {
    const data = await getDataFromDrive(authedReq);
    res.json(
      buildResult(
        data.sales.map(drSaleToRow),
        data.purchases.map(drPurchaseToRow),
      ),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load reports from Drive");
    handleDriveError(err, res, "Failed to load reports from Google Drive.");
  }
});

// POST /reconciliation/records/sale — add individual sale record
router.post("/records/sale", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const authedReq = req as Request & {
    sessionId: string;
    sessionData: SessionData;
  };
  const { saleDate, item, qty, rate, amount } = req.body as {
    saleDate: string;
    item: string;
    qty: number;
    rate: number;
    amount: number;
  };
  if (!saleDate || !item || !qty || !rate || !amount) {
    res
      .status(400)
      .json({ error: "All fields required: saleDate, item, qty, rate, amount" });
    return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    data.sales.push({
      id: data.nextSaleId++,
      saleDate,
      item: String(item).trim(),
      qty: String(qty),
      rate: String(rate),
      amount: String(amount),
      status: "Pending",
      purchaseBillDate: null,
    });
    await saveDataToDrive(authedReq, data);
    const result = await runMatchingForUser(authedReq);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to add sale record");
    handleDriveError(err, res, "Failed to add sale record.");
  }
});

// POST /reconciliation/records/purchase — add individual purchase record
router.post("/records/purchase", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const authedReq = req as Request & {
    sessionId: string;
    sessionData: SessionData;
  };
  const { billDate, purchaseDate, item, qty, rate, amount } = req.body as {
    billDate: string;
    purchaseDate: string;
    item: string;
    qty: number;
    rate: number;
    amount: number;
  };
  if (!billDate || !purchaseDate || !item || !qty || !rate || !amount) {
    res.status(400).json({
      error:
        "All fields required: billDate, purchaseDate, item, qty, rate, amount",
    });
    return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    data.purchases.push({
      id: data.nextPurchaseId++,
      billDate,
      purchaseDate,
      item: String(item).trim(),
      qty: String(qty),
      rate: String(rate),
      amount: String(amount),
      status: "Unmatched",
    });
    await saveDataToDrive(authedReq, data);
    const result = await runMatchingForUser(authedReq);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to add purchase record");
    handleDriveError(err, res, "Failed to add purchase record.");
  }
});

// DELETE /reconciliation/records/sale/:id
router.delete("/records/sale/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const authedReq = req as Request & {
    sessionId: string;
    sessionData: SessionData;
  };
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    const idx = data.sales.findIndex((s) => s.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    const existing = data.sales[idx];
    // If matched, reset the linked purchase
    if (existing.status === "Matched" && existing.purchaseBillDate) {
      const linkedPurchase = data.purchases.find(
        (p) =>
          p.status === "Matched" &&
          p.billDate === existing.purchaseBillDate &&
          p.item === existing.item &&
          p.qty === existing.qty,
      );
      if (linkedPurchase) {
        linkedPurchase.status = "Unmatched";
      }
    }
    data.sales.splice(idx, 1);
    await saveDataToDrive(authedReq, data);
    const result = await runMatchingForUser(authedReq);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to delete sale record");
    handleDriveError(err, res, "Failed to delete sale record.");
  }
});

// DELETE /reconciliation/records/purchase/:id
router.delete(
  "/records/purchase/:id",
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Please log in." });
      return;
    }
    const authedReq = req as Request & {
      sessionId: string;
      sessionData: SessionData;
    };
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id." });
      return;
    }
    try {
      const data = await getDataFromDrive(authedReq);
      const idx = data.purchases.findIndex((p) => p.id === id);
      if (idx === -1) {
        res.status(404).json({ error: "Record not found." });
        return;
      }
      data.purchases.splice(idx, 1);
      await saveDataToDrive(authedReq, data);
      const result = await runMatchingForUser(authedReq);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "Failed to delete purchase record");
      handleDriveError(err, res, "Failed to delete purchase record.");
    }
  },
);

// DELETE /reconciliation/records/date — delete all records for a specific date
router.delete("/records/date", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const authedReq = req as Request & {
    sessionId: string;
    sessionData: SessionData;
  };
  const { date, type } = req.body as { date?: string; type?: "sale" | "purchase" };

  if (!date || !type || !["sale", "purchase"].includes(type)) {
    res.status(400).json({
      error: "Provide date (YYYY-MM-DD) and type ('sale' or 'purchase').",
    });
    return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    if (type === "sale") {
      data.sales = data.sales.filter((s) => s.saleDate !== date);
    } else {
      data.purchases = data.purchases.filter((p) => p.billDate !== date);
    }
    await saveDataToDrive(authedReq, data);
    const result = await runMatchingForUser(authedReq);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to delete records by date");
    handleDriveError(err, res, "Failed to delete records.");
  }
});

// FY helpers
function getFYFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

// POST /reconciliation/download/:fileType
router.post("/download/:fileType", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please log in." });
    return;
  }
  const authedReq = req as Request & {
    sessionId: string;
    sessionData: SessionData;
  };
  try {
    const { fileType } = req.params;
    const { fy } = req.body as { fy?: string };
    const data = await getDataFromDrive(authedReq);

    const filteredSales = fy
      ? data.sales.filter((s) => getFYFromDate(s.saleDate) === fy)
      : data.sales;
    const filteredPurchases = fy
      ? data.purchases.filter((p) => getFYFromDate(p.billDate) === fy)
      : data.purchases;

    const result = buildResult(
      filteredSales.map(drSaleToRow),
      filteredPurchases.map(drPurchaseToRow),
    );

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
      case "monthly-matrix-qty":
        buffer = buildMonthlyMatrixExcel(result, "qty", fy ?? "");
        filename = `monthly_matrix_qty_${fy ?? "all"}.xlsx`;
        break;
      case "monthly-matrix-amount":
        buffer = buildMonthlyMatrixExcel(result, "amount", fy ?? "");
        filename = `monthly_matrix_amount_${fy ?? "all"}.xlsx`;
        break;
      default:
        res.status(400).json({ error: `Unknown fileType: ${fileType}` });
        return;
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Download failed");
    handleDriveError(err, res, "Failed to generate download file.");
  }
});

export default router;
