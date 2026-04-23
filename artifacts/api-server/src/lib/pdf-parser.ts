// Import from the library core to avoid the known test-file bug in pdf-parse@1.1.1 index.js
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – no types for the internal path, but the function signature is identical
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { normalizeDate, normalizeNum, normalizeStr } from "./reconciliation.js";
import type { SaleRow, PurchaseRow } from "./reconciliation.js";

const UNIT_TOKENS = new Set([
  "qtl", "qtls", "bag", "bags", "kg", "kgs", "unit", "units",
  "pcs", "no", "nos", "mtr", "mtrs", "ltr", "ltrs", "ton", "tons",
  "quintal", "quintals", "mt", "mts",
]);

const SKIP_PREFIXES = [
  "total", "grand total", "sub total", "subtotal", "net total", "net amount",
];

const HEADER_CANDIDATES = [
  "date", "item", "commodity", "qty", "quantity", "rate", "amount",
  "amt", "particulars", "description",
];

const PDF_UNRECOGNISED_ERROR =
  "PDF format not recognised. Please export as Excel instead.";

// ─── Column map derived from the PDF header row ───────────────────────────────

interface PdfColMap {
  /** 0-based position among the numeric tokens on a data row for qty   */
  qtyPos: number;
  /** 0-based position among the numeric tokens on a data row for rate  */
  ratePos: number;
  /** 0-based position among the numeric tokens on a data row for amount */
  amtPos: number;
}

function buildColMap(headerLine: string): PdfColMap {
  const tokens = headerLine.toLowerCase().split(/\s+/);

  // Record the token position for each meaningful column keyword
  const pos: Record<string, number> = {};
  tokens.forEach((t, i) => {
    if (t.includes("qty") || t.includes("quantity")) pos["qty"] = pos["qty"] ?? i;
    else if (t.includes("rate") || t.includes("price")) pos["rate"] = pos["rate"] ?? i;
    else if (t.includes("amount") || t === "amt" || t.includes("total")) pos["amount"] = pos["amount"] ?? i;
  });

  // Derive relative ordering among numeric columns (left-to-right in header)
  const numericEntries = (["qty", "rate", "amount"] as const)
    .map((key) => ({ key, idx: pos[key] ?? Infinity }))
    .sort((a, b) => a.idx - b.idx);

  const rank = (key: string) => numericEntries.findIndex((e) => e.key === key);

  // Default to Tally standard order: qty=0, rate=1, amount=last
  const qtyRank = rank("qty");
  const rateRank = rank("rate");
  const amtRank = rank("amount");

  return {
    qtyPos: qtyRank >= 0 ? qtyRank : 0,
    ratePos: rateRank >= 0 ? rateRank : 1,
    amtPos: amtRank >= 0 ? amtRank : numericEntries.length - 1,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function extractText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

function isNumericToken(token: string): boolean {
  return /^[\d,]+(\.\d+)?$/.test(token);
}

function isDateToken(token: string): boolean {
  return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(token);
}

function findGlobalDate(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/date\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
    if (m) return normalizeDate(m[1]);
  }
  return "";
}

/** Return the 0-based line index of the header row, or -1. */
function findHeaderLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    let hits = 0;
    for (const kw of HEADER_CANDIDATES) {
      if (lower.includes(kw)) hits++;
    }
    if (hits >= 3) return i;
  }
  return -1;
}

interface RowData {
  item: string;
  date: string;
  numbers: number[];
}

function tokenizeDataRow(line: string): RowData | null {
  const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
  const numbers: number[] = [];
  const textParts: string[] = [];
  let date = "";

  for (const token of tokens) {
    if (isDateToken(token)) {
      date = normalizeDate(token);
    } else if (UNIT_TOKENS.has(token.toLowerCase())) {
      // skip unit tokens (Qtl, Kg, Bag, etc.)
    } else if (isNumericToken(token)) {
      numbers.push(normalizeNum(token));
    } else {
      textParts.push(token);
    }
  }

  const item = textParts.join(" ").trim();
  if (!item) return null;
  // Use shared normalizeStr for skip-prefix check (consistent with reconciliation.ts)
  const itemNorm = normalizeStr(item);
  if (SKIP_PREFIXES.some((p) => itemNorm.startsWith(p))) return null;
  if (numbers.length === 0) return null;

  return { item, date, numbers };
}

function safeAt(arr: number[], pos: number): number {
  if (pos < 0 || pos >= arr.length) return 0;
  return arr[pos];
}

// ─── Public parsers ───────────────────────────────────────────────────────────

export async function parseSalesPdf(buffer: Buffer): Promise<Omit<SaleRow, "id">[]> {
  const text = await extractText(buffer);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const headerIdx = findHeaderLine(lines);
  if (headerIdx === -1) {
    throw new Error(PDF_UNRECOGNISED_ERROR);
  }

  const colMap = buildColMap(lines[headerIdx]);
  const globalDate = findGlobalDate(lines.slice(0, headerIdx + 1));

  const rows: Omit<SaleRow, "id">[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parsed = tokenizeDataRow(lines[i]);
    if (!parsed) continue;

    const qty = safeAt(parsed.numbers, colMap.qtyPos);
    if (qty === 0) continue;

    const rate = safeAt(parsed.numbers, colMap.ratePos);
    const amtIdx = colMap.amtPos >= parsed.numbers.length
      ? parsed.numbers.length - 1
      : colMap.amtPos;
    const amount = safeAt(parsed.numbers, amtIdx);
    const saleDate = parsed.date || globalDate;

    rows.push({
      saleDate,
      item: toTitleCase(parsed.item),
      qty,
      rate,
      amount,
      purchaseBillDate: null,
      status: "Pending",
    });
  }

  if (rows.length === 0) {
    throw new Error(PDF_UNRECOGNISED_ERROR);
  }

  return rows;
}

export async function parsePurchasePdf(buffer: Buffer): Promise<Omit<PurchaseRow, "id">[]> {
  const text = await extractText(buffer);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const headerIdx = findHeaderLine(lines);
  if (headerIdx === -1) {
    throw new Error(PDF_UNRECOGNISED_ERROR);
  }

  const colMap = buildColMap(lines[headerIdx]);
  const globalDate = findGlobalDate(lines.slice(0, headerIdx + 1));

  const rows: Omit<PurchaseRow, "id">[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parsed = tokenizeDataRow(lines[i]);
    if (!parsed) continue;

    const qty = safeAt(parsed.numbers, colMap.qtyPos);
    if (qty === 0) continue;

    const rate = safeAt(parsed.numbers, colMap.ratePos);
    const amtIdx = colMap.amtPos >= parsed.numbers.length
      ? parsed.numbers.length - 1
      : colMap.amtPos;
    const amount = safeAt(parsed.numbers, amtIdx);
    const billDate = parsed.date || globalDate;

    rows.push({
      billDate,
      purchaseDate: billDate,
      item: toTitleCase(parsed.item),
      qty,
      rate,
      amount,
      status: "Unmatched",
    });
  }

  if (rows.length === 0) {
    throw new Error(PDF_UNRECOGNISED_ERROR);
  }

  return rows;
}
