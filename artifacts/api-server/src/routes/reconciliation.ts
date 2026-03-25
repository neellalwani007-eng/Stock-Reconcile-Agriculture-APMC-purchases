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

export interface FileImportResult {
  filename: string;
  type: "sale" | "purchase";
  success: boolean;
  rowCount: number;
  error?: string;
}

function handleDriveError(err: unknown, res: Response, fallbackMsg: string): void {
  if (err instanceof DriveInsufficientScopeError) {
    res.status(401).json({ error: "reauth_required", message: err.message });
  } else {
    res.status(500).json({ error: fallbackMsg });
  }
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

async function getDataFromDrive(
  req: Request & { sessionId: string; sessionData: SessionData },
): Promise<DriveUserData> {
  const onTokenRefresh = async (tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }) => {
    if (tokens.access_token) req.sessionData.access_token = tokens.access_token;
    if (tokens.refresh_token) req.sessionData.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) req.sessionData.expires_at = Math.floor(tokens.expiry_date / 1000);
    await updateSession(req.sessionId, req.sessionData);
  };
  return readUserData(req.sessionData, onTokenRefresh);
}

async function saveDataToDrive(
  req: Request & { sessionId: string; sessionData: SessionData },
  data: DriveUserData,
): Promise<void> {
  const onTokenRefresh = async (tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }) => {
    if (tokens.access_token) req.sessionData.access_token = tokens.access_token;
    if (tokens.refresh_token) req.sessionData.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) req.sessionData.expires_at = Math.floor(tokens.expiry_date / 1000);
    await updateSession(req.sessionId, req.sessionData);
  };
  await writeUserData(req.sessionData, data, onTokenRefresh);
}

async function runMatchingForUser(
  req: Request & { sessionId: string; sessionData: SessionData },
): Promise<ReconciliationResult> {
  const data = await getDataFromDrive(req);

  for (const s of data.sales) {
    if (s.status === "Matched") {
      s.status = "Pending";
      s.purchaseBillDate = null;
    }
  }
  for (const p of data.purchases) {
    if (p.status === "Matched") p.status = "Unmatched";
  }

  const saleRows = data.sales.map(drSaleToRow);
  const purchaseRows = data.purchases.map(drPurchaseToRow);
  const { updates } = runMatching(saleRows, purchaseRows);

  for (const { saleId, purchaseId, purchaseBillDate } of updates) {
    const sale = data.sales.find((s) => s.id === saleId);
    const purchase = data.purchases.find((p) => p.id === purchaseId);
    if (sale) { sale.status = "Matched"; sale.purchaseBillDate = purchaseBillDate; }
    if (purchase) purchase.status = "Matched";
  }

  await saveDataToDrive(req, data);
  return buildResult(data.sales.map(drSaleToRow), data.purchases.map(drPurchaseToRow));
}

// ── POST /reconciliation/run — upload files ──────────────────────────────────
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
    const authedReq = req as Request & { sessionId: string; sessionData: SessionData };

    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      if (!files["salesFile"] && !files["purchaseFile"]) {
        res.status(400).json({ error: "Please provide at least one file (sales or purchase)." });
        return;
      }

      const fileResults: FileImportResult[] = [];
      const data = await getDataFromDrive(authedReq);

      // Parse sale files individually — track per-file results
      if (files["salesFile"]) {
        const allSaleRows: ReturnType<typeof parseSalesSheet> = [];
        for (const f of files["salesFile"]) {
          try {
            const rows = parseSalesSheet(f.buffer);
            if (rows.length === 0) {
              fileResults.push({
                filename: f.originalname,
                type: "sale",
                success: false,
                rowCount: 0,
                error: "No data rows found. Check headers: Sale Date, Item, Qty, Rate, Amount",
              });
            } else {
              fileResults.push({ filename: f.originalname, type: "sale", success: true, rowCount: rows.length });
              allSaleRows.push(...rows);
            }
          } catch (e) {
            fileResults.push({
              filename: f.originalname,
              type: "sale",
              success: false,
              rowCount: 0,
              error: e instanceof Error ? e.message : "Failed to parse file — not a valid Excel file",
            });
          }
        }

        if (allSaleRows.length > 0) {
          const datesInFile = new Set(allSaleRows.map((r) => r.saleDate));
          data.sales = data.sales.filter((s) => !datesInFile.has(s.saleDate));
          for (const r of allSaleRows) {
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
      }

      // Parse purchase files individually — track per-file results
      if (files["purchaseFile"]) {
        const allPurchaseRows: ReturnType<typeof parsePurchaseSheet> = [];
        for (const f of files["purchaseFile"]) {
          try {
            const rows = parsePurchaseSheet(f.buffer);
            if (rows.length === 0) {
              fileResults.push({
                filename: f.originalname,
                type: "purchase",
                success: false,
                rowCount: 0,
                error: "No data rows found. Check headers: Date, Purchase Date, Item, QTY, Rate, Amount",
              });
            } else {
              fileResults.push({ filename: f.originalname, type: "purchase", success: true, rowCount: rows.length });
              allPurchaseRows.push(...rows);
            }
          } catch (e) {
            fileResults.push({
              filename: f.originalname,
              type: "purchase",
              success: false,
              rowCount: 0,
              error: e instanceof Error ? e.message : "Failed to parse file — not a valid Excel file",
            });
          }
        }

        if (allPurchaseRows.length > 0) {
          const datesInFile = new Set(allPurchaseRows.map((r) => r.billDate));
          data.purchases = data.purchases.filter((p) => !datesInFile.has(p.billDate));
          for (const r of allPurchaseRows) {
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
      }

      await saveDataToDrive(authedReq, data);
      const result = await runMatchingForUser(authedReq);
      res.json({ ...result, fileResults });
    } catch (err) {
      req.log.error({ err }, "Reconciliation run failed");
      handleDriveError(err, res, "Failed to process files. Ensure they are valid Excel files.");
    }
  },
);

// ── GET /reconciliation/reports ──────────────────────────────────────────────
router.get("/reports", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json(buildResult([], []));
    return;
  }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  try {
    const data = await getDataFromDrive(authedReq);
    res.json(buildResult(data.sales.map(drSaleToRow), data.purchases.map(drPurchaseToRow)));
  } catch (err) {
    req.log.error({ err }, "Failed to load reports from Drive");
    handleDriveError(err, res, "Failed to load reports from Google Drive.");
  }
});

// ── POST /reconciliation/records/sale — add sale record ─────────────────────
router.post("/records/sale", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const { saleDate, item, qty, rate, amount } = req.body as { saleDate: string; item: string; qty: number; rate: number; amount: number };
  if (!saleDate || !item || !qty || !rate || !amount) {
    res.status(400).json({ error: "All fields required: saleDate, item, qty, rate, amount" }); return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    data.sales.push({ id: data.nextSaleId++, saleDate, item: String(item).trim(), qty: String(qty), rate: String(rate), amount: String(amount), status: "Pending", purchaseBillDate: null });
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to add sale record");
    handleDriveError(err, res, "Failed to add sale record.");
  }
});

// ── PUT /reconciliation/records/sale/:id — edit sale record ──────────────────
router.put("/records/sale/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  const { saleDate, item, qty, rate, amount } = req.body as { saleDate?: string; item?: string; qty?: number; rate?: number; amount?: number };
  try {
    const data = await getDataFromDrive(authedReq);
    const rec = data.sales.find((s) => s.id === id);
    if (!rec) { res.status(404).json({ error: "Record not found." }); return; }
    if (saleDate !== undefined) rec.saleDate = saleDate;
    if (item !== undefined) rec.item = String(item).trim();
    if (qty !== undefined) rec.qty = String(qty);
    if (rate !== undefined) rec.rate = String(rate);
    if (amount !== undefined) rec.amount = String(amount);
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to edit sale record");
    handleDriveError(err, res, "Failed to edit sale record.");
  }
});

// ── POST /reconciliation/records/purchase — add purchase record ──────────────
router.post("/records/purchase", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const { billDate, purchaseDate, item, qty, rate, amount } = req.body as { billDate: string; purchaseDate: string; item: string; qty: number; rate: number; amount: number };
  if (!billDate || !purchaseDate || !item || !qty || !rate || !amount) {
    res.status(400).json({ error: "All fields required: billDate, purchaseDate, item, qty, rate, amount" }); return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    data.purchases.push({ id: data.nextPurchaseId++, billDate, purchaseDate, item: String(item).trim(), qty: String(qty), rate: String(rate), amount: String(amount), status: "Unmatched" });
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to add purchase record");
    handleDriveError(err, res, "Failed to add purchase record.");
  }
});

// ── PUT /reconciliation/records/purchase/:id — edit purchase record ───────────
router.put("/records/purchase/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  const { billDate, purchaseDate, item, qty, rate, amount } = req.body as { billDate?: string; purchaseDate?: string; item?: string; qty?: number; rate?: number; amount?: number };
  try {
    const data = await getDataFromDrive(authedReq);
    const rec = data.purchases.find((p) => p.id === id);
    if (!rec) { res.status(404).json({ error: "Record not found." }); return; }
    if (billDate !== undefined) rec.billDate = billDate;
    if (purchaseDate !== undefined) rec.purchaseDate = purchaseDate;
    if (item !== undefined) rec.item = String(item).trim();
    if (qty !== undefined) rec.qty = String(qty);
    if (rate !== undefined) rec.rate = String(rate);
    if (amount !== undefined) rec.amount = String(amount);
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to edit purchase record");
    handleDriveError(err, res, "Failed to edit purchase record.");
  }
});

// ── DELETE /reconciliation/records/sale/:id ──────────────────────────────────
router.delete("/records/sale/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  try {
    const data = await getDataFromDrive(authedReq);
    const idx = data.sales.findIndex((s) => s.id === id);
    if (idx === -1) { res.status(404).json({ error: "Record not found." }); return; }
    const existing = data.sales[idx];
    if (existing.status === "Matched" && existing.purchaseBillDate) {
      const linked = data.purchases.find((p) => p.status === "Matched" && p.billDate === existing.purchaseBillDate && p.item === existing.item && p.qty === existing.qty);
      if (linked) linked.status = "Unmatched";
    }
    data.sales.splice(idx, 1);
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to delete sale record");
    handleDriveError(err, res, "Failed to delete sale record.");
  }
});

// ── DELETE /reconciliation/records/purchase/:id ──────────────────────────────
router.delete("/records/purchase/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  try {
    const data = await getDataFromDrive(authedReq);
    const idx = data.purchases.findIndex((p) => p.id === id);
    if (idx === -1) { res.status(404).json({ error: "Record not found." }); return; }
    data.purchases.splice(idx, 1);
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to delete purchase record");
    handleDriveError(err, res, "Failed to delete purchase record.");
  }
});

// ── DELETE /reconciliation/records/bulk — bulk delete multiple records ────────
router.delete("/records/bulk", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const { type, ids } = req.body as { type?: "sale" | "purchase"; ids?: number[] };
  if (!type || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "Provide type ('sale' or 'purchase') and a non-empty array of ids." }); return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    const idSet = new Set(ids);
    if (type === "sale") {
      for (const s of data.sales.filter((s) => idSet.has(s.id))) {
        if (s.status === "Matched" && s.purchaseBillDate) {
          const linked = data.purchases.find((p) => p.status === "Matched" && p.billDate === s.purchaseBillDate && p.item === s.item && p.qty === s.qty);
          if (linked) linked.status = "Unmatched";
        }
      }
      data.sales = data.sales.filter((s) => !idSet.has(s.id));
    } else {
      data.purchases = data.purchases.filter((p) => !idSet.has(p.id));
    }
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to bulk delete records");
    handleDriveError(err, res, "Failed to delete records.");
  }
});

// ── DELETE /reconciliation/records/date — delete all records for a date ──────
router.delete("/records/date", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const { date, type } = req.body as { date?: string; type?: "sale" | "purchase" };
  if (!date || !type || !["sale", "purchase"].includes(type)) {
    res.status(400).json({ error: "Provide date (YYYY-MM-DD) and type ('sale' or 'purchase')." }); return;
  }
  try {
    const data = await getDataFromDrive(authedReq);
    if (type === "sale") data.sales = data.sales.filter((s) => s.saleDate !== date);
    else data.purchases = data.purchases.filter((p) => p.billDate !== date);
    await saveDataToDrive(authedReq, data);
    res.json(await runMatchingForUser(authedReq));
  } catch (err) {
    req.log.error({ err }, "Failed to delete records by date");
    handleDriveError(err, res, "Failed to delete records.");
  }
});

// ── POST /reconciliation/why-unmatched — explain why a record didn't match ───
router.post("/why-unmatched", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  const { type, id } = req.body as { type?: "sale" | "purchase"; id?: number };
  if (!type || !id) { res.status(400).json({ error: "Provide type and id." }); return; }

  try {
    const data = await getDataFromDrive(authedReq);

    if (type === "sale") {
      const sale = data.sales.find((s) => s.id === id);
      if (!sale) { res.status(404).json({ error: "Record not found." }); return; }

      const unmatched = data.purchases.filter((p) => p.status !== "Matched");
      if (unmatched.length === 0) {
        res.json({ globalReason: "No unmatched purchase records exist in the system.", candidates: [] }); return;
      }

      // Find purchases for same item
      const sameItem = unmatched.filter((p) => p.item.trim().toLowerCase() === sale.item.trim().toLowerCase());
      const pool = sameItem.length > 0 ? sameItem : unmatched;

      const candidates = pool.slice(0, 20).map((p) => {
        const reasons: { field: string; saleValue: string; purchaseValue: string; ok: boolean }[] = [
          { field: "Item", saleValue: sale.item, purchaseValue: p.item, ok: sale.item.trim().toLowerCase() === p.item.trim().toLowerCase() },
          { field: "Purchase Date", saleValue: sale.saleDate, purchaseValue: p.purchaseDate, ok: sale.saleDate === p.purchaseDate },
          { field: "Qty", saleValue: sale.qty, purchaseValue: p.qty, ok: parseFloat(sale.qty) === parseFloat(p.qty) },
          { field: "Rate", saleValue: sale.rate, purchaseValue: p.rate, ok: parseFloat(sale.rate) === parseFloat(p.rate) },
          { field: "Amount", saleValue: sale.amount, purchaseValue: p.amount, ok: Math.abs(parseFloat(sale.amount) - parseFloat(p.amount)) <= 0.02 },
        ];
        const matchScore = reasons.filter((r) => r.ok).length;
        return { purchaseId: p.id, billDate: p.billDate, reasons, matchScore };
      });
      candidates.sort((a, b) => b.matchScore - a.matchScore);
      res.json({ candidates: candidates.slice(0, 5) });

    } else {
      const purchase = data.purchases.find((p) => p.id === id);
      if (!purchase) { res.status(404).json({ error: "Record not found." }); return; }

      const pending = data.sales.filter((s) => s.status !== "Matched");
      if (pending.length === 0) {
        res.json({ globalReason: "No pending sale records exist in the system.", candidates: [] }); return;
      }

      const sameItem = pending.filter((s) => s.item.trim().toLowerCase() === purchase.item.trim().toLowerCase());
      const pool = sameItem.length > 0 ? sameItem : pending;

      const candidates = pool.slice(0, 20).map((s) => {
        const reasons: { field: string; saleValue: string; purchaseValue: string; ok: boolean }[] = [
          { field: "Item", saleValue: s.item, purchaseValue: purchase.item, ok: s.item.trim().toLowerCase() === purchase.item.trim().toLowerCase() },
          { field: "Sale Date vs Purchase Date", saleValue: s.saleDate, purchaseValue: purchase.purchaseDate, ok: s.saleDate === purchase.purchaseDate },
          { field: "Qty", saleValue: s.qty, purchaseValue: purchase.qty, ok: parseFloat(s.qty) === parseFloat(purchase.qty) },
          { field: "Rate", saleValue: s.rate, purchaseValue: purchase.rate, ok: parseFloat(s.rate) === parseFloat(purchase.rate) },
          { field: "Amount", saleValue: s.amount, purchaseValue: purchase.amount, ok: Math.abs(parseFloat(s.amount) - parseFloat(purchase.amount)) <= 0.02 },
        ];
        const matchScore = reasons.filter((r) => r.ok).length;
        return { saleId: s.id, saleDate: s.saleDate, reasons, matchScore };
      });
      candidates.sort((a, b) => b.matchScore - a.matchScore);
      res.json({ candidates: candidates.slice(0, 5) });
    }
  } catch (err) {
    req.log.error({ err }, "Why-unmatched failed");
    handleDriveError(err, res, "Failed to analyse record.");
  }
});

// ── POST /reconciliation/manual-match — force-link a sale to a purchase ──────
router.post("/manual-match", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };

  const { saleId, purchaseId, saleCorrections, purchaseCorrections } = req.body as {
    saleId: number;
    purchaseId: number;
    saleCorrections?: { saleDate?: string; item?: string; qty?: string; rate?: string; amount?: string };
    purchaseCorrections?: { billDate?: string; purchaseDate?: string; item?: string; qty?: string; rate?: string; amount?: string };
  };

  if (!saleId || !purchaseId) { res.status(400).json({ error: "Provide saleId and purchaseId." }); return; }

  try {
    const data = await getDataFromDrive(authedReq);
    const sale = data.sales.find((s) => s.id === saleId);
    const purchase = data.purchases.find((p) => p.id === purchaseId);
    if (!sale) { res.status(404).json({ error: "Sale record not found." }); return; }
    if (!purchase) { res.status(404).json({ error: "Purchase record not found." }); return; }

    // Apply corrections to sale record
    if (saleCorrections) {
      if (saleCorrections.saleDate !== undefined) sale.saleDate = saleCorrections.saleDate;
      if (saleCorrections.item !== undefined) sale.item = saleCorrections.item.trim();
      if (saleCorrections.qty !== undefined) sale.qty = saleCorrections.qty;
      if (saleCorrections.rate !== undefined) sale.rate = saleCorrections.rate;
      if (saleCorrections.amount !== undefined) sale.amount = saleCorrections.amount;
    }

    // Apply corrections to purchase record
    if (purchaseCorrections) {
      if (purchaseCorrections.billDate !== undefined) purchase.billDate = purchaseCorrections.billDate;
      if (purchaseCorrections.purchaseDate !== undefined) purchase.purchaseDate = purchaseCorrections.purchaseDate;
      if (purchaseCorrections.item !== undefined) purchase.item = purchaseCorrections.item.trim();
      if (purchaseCorrections.qty !== undefined) purchase.qty = purchaseCorrections.qty;
      if (purchaseCorrections.rate !== undefined) purchase.rate = purchaseCorrections.rate;
      if (purchaseCorrections.amount !== undefined) purchase.amount = purchaseCorrections.amount;
    }

    // Force-link the pair
    sale.status = "Matched";
    sale.purchaseBillDate = purchase.billDate;
    purchase.status = "Matched";

    await saveDataToDrive(authedReq, data);
    res.json(buildResult(data.sales.map(drSaleToRow), data.purchases.map(drPurchaseToRow)));
  } catch (err) {
    req.log.error({ err }, "Manual match failed");
    handleDriveError(err, res, "Failed to manually match records.");
  }
});

// FY helper
function getFYFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

// ── POST /reconciliation/download/:fileType ───────────────────────────────────
router.post("/download/:fileType", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Please log in." }); return; }
  const authedReq = req as Request & { sessionId: string; sessionData: SessionData };
  try {
    const { fileType } = req.params;
    const { fy } = req.body as { fy?: string };
    const data = await getDataFromDrive(authedReq);

    const filteredSales = fy ? data.sales.filter((s) => getFYFromDate(s.saleDate) === fy) : data.sales;
    const filteredPurchases = fy ? data.purchases.filter((p) => getFYFromDate(p.billDate) === fy) : data.purchases;
    const result = buildResult(filteredSales.map(drSaleToRow), filteredPurchases.map(drPurchaseToRow));

    let buffer: Buffer;
    let filename: string;

    switch (fileType) {
      case "updated-sales":    buffer = buildUpdatedSalesExcel(result);                       filename = "updated_sales.xlsx";                          break;
      case "pending-pavati":   buffer = buildPendingPavatiExcel(result);                      filename = "pending_pavati.xlsx";                         break;
      case "datewise-report":  buffer = buildDatewiseReportExcel(result);                     filename = "datewise_report.xlsx";                        break;
      case "purchase-exceptions": buffer = buildPurchaseExceptionsExcel(result);              filename = "purchase_exceptions.xlsx";                    break;
      case "monthly-matrix-qty":    buffer = buildMonthlyMatrixExcel(result, "qty", fy ?? "");    filename = `monthly_matrix_qty_${fy ?? "all"}.xlsx`;    break;
      case "monthly-matrix-amount": buffer = buildMonthlyMatrixExcel(result, "amount", fy ?? ""); filename = `monthly_matrix_amount_${fy ?? "all"}.xlsx`; break;
      default: res.status(400).json({ error: `Unknown fileType: ${fileType}` }); return;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Download failed");
    handleDriveError(err, res, "Failed to generate download file.");
  }
});

export default router;
