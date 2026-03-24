import * as XLSX from "xlsx";

export interface SaleRow {
  id?: number;
  saleDate: string;
  item: string;
  qty: number;
  rate: number;
  amount: number;
  purchaseBillDate: string | null;
  status: "Matched" | "Pending";
}

export interface PurchaseRow {
  id?: number;
  billDate: string;
  purchaseDate: string;
  item: string;
  qty: number;
  rate: number;
  amount: number;
  status: "Matched" | "Unmatched" | "Extra";
}

export interface ItemSummary {
  item: string;
  salesQty: number;
  salesAmount: number;
  purchaseQty: number;
  purchaseAmount: number;
  pendingQty: number;
  pendingAmount: number;
}

export interface ReconciliationResult {
  salesRows: SaleRow[];
  purchaseRows: PurchaseRow[];
  summary: ItemSummary[];
  matchedCount: number;
  pendingCount: number;
  unmatchedPurchaseCount: number;
}

export interface MatchUpdate {
  saleId: number;
  purchaseId: number;
  purchaseBillDate: string;
}

function normalizeDate(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return String(val);
    const month = String(d.m).padStart(2, "0");
    const day = String(d.d).padStart(2, "0");
    return `${d.y}-${month}-${day}`;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, "0");
      const month = ddmmyyyy[2].padStart(2, "0");
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }
    const isoLike = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (isoLike) {
      const year = isoLike[1];
      const month = isoLike[2].padStart(2, "0");
      const day = isoLike[3].padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return trimmed;
  }
  return String(val);
}

function normalizeNum(val: unknown): number {
  if (typeof val === "number") return Math.round(val * 10000) / 10000;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/,/g, ""));
    return isNaN(n) ? 0 : Math.round(n * 10000) / 10000;
  }
  return 0;
}

function normalizeStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().toLowerCase();
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function headerMap(headers: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h !== undefined && h !== null) {
      map[String(h).trim().toLowerCase()] = i;
    }
  });
  return map;
}

function findCol(hm: Record<string, number>, ...candidates: string[]): number {
  for (const c of candidates) {
    if (hm[c.toLowerCase()] !== undefined) return hm[c.toLowerCase()];
  }
  return -1;
}

export function parseSalesSheet(buffer: Buffer): Omit<SaleRow, "id">[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });
  if (raw.length < 2) return [];

  const hm = headerMap(raw[0] as unknown[]);
  const datecol = findCol(hm, "sale date", "saledate", "date");
  const itemcol = findCol(hm, "item", "commodity", "product", "name");
  const qtycol = findCol(hm, "qty", "quantity", "qtl", "qty (qtl)");
  const ratecol = findCol(hm, "rate", "price");
  const amtcol = findCol(hm, "amount", "amt", "total");

  const rows: Omit<SaleRow, "id">[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (!r || r.length === 0) continue;
    const item = normalizeStr(r[itemcol]);
    if (!item) continue;
    const qty = normalizeNum(r[qtycol]);
    if (qty === 0) continue;
    rows.push({
      saleDate: normalizeDate(r[datecol]),
      item: toTitleCase(String(r[itemcol] ?? "").trim()),
      qty,
      rate: normalizeNum(r[ratecol]),
      amount: normalizeNum(r[amtcol]),
      purchaseBillDate: null,
      status: "Pending",
    });
  }
  return rows;
}

export function parsePurchaseSheet(buffer: Buffer): Omit<PurchaseRow, "id">[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });
  if (raw.length < 2) return [];

  const hm = headerMap(raw[0] as unknown[]);
  const billdatecol = findCol(hm, "date", "bill date", "billdate", "payment date");
  const purdatecol = findCol(hm, "purchase date", "purchasedate", "original purchase date", "orig date");
  const itemcol = findCol(hm, "item", "commodity", "product", "name");
  const qtycol = findCol(hm, "qty", "quantity", "qtl", "qty (qtl)");
  const ratecol = findCol(hm, "rate", "price");
  const amtcol = findCol(hm, "amount", "amt", "total");

  const rows: Omit<PurchaseRow, "id">[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    if (!r || r.length === 0) continue;
    const item = normalizeStr(r[itemcol]);
    if (!item) continue;
    const qty = normalizeNum(r[qtycol]);
    if (qty === 0) continue;
    rows.push({
      billDate: normalizeDate(r[billdatecol]),
      purchaseDate: normalizeDate(r[purdatecol]),
      item: toTitleCase(String(r[itemcol] ?? "").trim()),
      qty,
      rate: normalizeNum(r[ratecol]),
      amount: normalizeNum(r[amtcol]),
      status: "Unmatched",
    });
  }
  return rows;
}

const AMOUNT_TOLERANCE = 0.02;

function lotsMatch(
  saleQty: number, saleRate: number, saleAmount: number,
  purQty: number, purRate: number, purAmount: number,
): boolean {
  if (saleQty !== purQty) return false;
  if (saleRate !== purRate) return false;
  if (Math.abs(saleAmount - purAmount) > AMOUNT_TOLERANCE) return false;
  return true;
}

/**
 * Run 1-to-1 matching between pending sales and unmatched purchases.
 * Qty and Rate must match exactly; Amount may differ by up to ±0.2.
 * Returns a list of match pairs (saleId, purchaseId, purchaseBillDate).
 * Mutates salesRows and purchaseRows in-place to update status/purchaseBillDate.
 */
export function runMatching(
  salesRows: SaleRow[],
  purchaseRows: PurchaseRow[]
): { updates: MatchUpdate[] } {
  const purchaseUsed = new Set<number>();
  const updates: MatchUpdate[] = [];

  for (const sale of salesRows) {
    if (sale.status === "Matched") continue;
    const saleItemNorm = normalizeStr(sale.item);

    for (let pi = 0; pi < purchaseRows.length; pi++) {
      if (purchaseUsed.has(pi)) continue;
      const pur = purchaseRows[pi];
      if (pur.status === "Matched") continue;
      if (normalizeStr(pur.item) !== saleItemNorm) continue;
      if (pur.purchaseDate !== sale.saleDate) continue;
      if (!lotsMatch(sale.qty, sale.rate, sale.amount, pur.qty, pur.rate, pur.amount)) continue;

      sale.purchaseBillDate = pur.billDate;
      sale.status = "Matched";
      purchaseRows[pi].status = "Matched";
      purchaseUsed.add(pi);

      if (sale.id !== undefined && pur.id !== undefined) {
        updates.push({ saleId: sale.id, purchaseId: pur.id, purchaseBillDate: pur.billDate });
      }
      break;
    }
  }

  return { updates };
}

export function buildSummary(salesRows: SaleRow[], purchaseRows: PurchaseRow[]): ItemSummary[] {
  const summaryMap: Record<string, ItemSummary> = {};

  for (const s of salesRows) {
    const key = normalizeStr(s.item);
    if (!summaryMap[key]) {
      summaryMap[key] = { item: s.item, salesQty: 0, salesAmount: 0, purchaseQty: 0, purchaseAmount: 0, pendingQty: 0, pendingAmount: 0 };
    }
    summaryMap[key].salesQty += s.qty;
    summaryMap[key].salesAmount += s.amount;
    if (s.status === "Pending") {
      summaryMap[key].pendingQty += s.qty;
      summaryMap[key].pendingAmount += s.amount;
    }
  }

  for (const p of purchaseRows) {
    const key = normalizeStr(p.item);
    if (!summaryMap[key]) {
      summaryMap[key] = { item: p.item, salesQty: 0, salesAmount: 0, purchaseQty: 0, purchaseAmount: 0, pendingQty: 0, pendingAmount: 0 };
    }
    summaryMap[key].purchaseQty += p.qty;
    summaryMap[key].purchaseAmount += p.amount;
  }

  return Object.values(summaryMap);
}

export function buildResult(salesRows: SaleRow[], purchaseRows: PurchaseRow[]): ReconciliationResult {
  const summary = buildSummary(salesRows, purchaseRows);
  return {
    salesRows,
    purchaseRows,
    summary,
    matchedCount: salesRows.filter((s) => s.status === "Matched").length,
    pendingCount: salesRows.filter((s) => s.status === "Pending").length,
    unmatchedPurchaseCount: purchaseRows.filter((p) => p.status !== "Matched").length,
  };
}

export function buildUpdatedSalesExcel(result: ReconciliationResult): Buffer {
  const wb = XLSX.utils.book_new();
  const data = [
    ["Sale Date", "Item", "Qty (QTL)", "Rate", "Amount", "Purchase Bill Date", "Status"],
    ...result.salesRows.map((r) => [r.saleDate, r.item, r.qty, r.rate, r.amount, r.purchaseBillDate ?? "", r.status]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Updated Sales");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildPendingPavatiExcel(result: ReconciliationResult): Buffer {
  const wb = XLSX.utils.book_new();
  const pending = result.salesRows.filter((r) => r.status === "Pending");
  const data = [
    ["Sale Date", "Commodity", "Quantity (QTL)", "Rate", "Amount"],
    ...pending.map((r) => [r.saleDate, r.item, r.qty, r.rate, r.amount]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Pending Pavati");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildDatewiseReportExcel(result: ReconciliationResult): Buffer {
  const wb = XLSX.utils.book_new();
  const sorted = [...result.salesRows].sort((a, b) => a.saleDate.localeCompare(b.saleDate));
  const data = [
    ["Sale Date", "Commodity", "Qty (QTL)", "Rate", "Amount", "Purchase Bill Date", "Status"],
    ...sorted.map((r) => [r.saleDate, r.item, r.qty, r.rate, r.amount, r.purchaseBillDate ?? "", r.status]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Date-wise Report");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildPurchaseExceptionsExcel(result: ReconciliationResult): Buffer {
  const wb = XLSX.utils.book_new();
  const exceptions = result.purchaseRows.filter((r) => r.status !== "Matched");
  const data = [
    ["Bill Date", "Purchase Date", "Commodity", "Qty (QTL)", "Rate", "Amount", "Status"],
    ...exceptions.map((r) => [r.billDate, r.purchaseDate, r.item, r.qty, r.rate, r.amount, r.status]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Purchase Exceptions");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
