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

// ─── Tally bill detection & parsing ──────────────────────────────────────────
//
// Tally (Adat / Commission agent) PDF bills have a specific format:
//   • Header row has all column names concatenated: "ItemAmountRateQtls"
//   • Each data entry spans TWO lines:
//       Line 1: "{ItemName}{Amount}"   e.g. "Onion17,460.00"
//       Line 2: "{Rate}{Qty}"          e.g. "970.0018.00"
//   • The bill date is NOT in the "Date :" field but encoded in the invoice
//     number, e.g. "50324-2-2026" = bill #503, date 24-Feb-2026
//   • Page headers repeat on each page but are safely skipped
//   • Footer summary lines (Adat, Market Fees, Grand-Total, etc.) don't match
//     the two-line data pattern and are safely ignored

/**
 * Returns true when the header line is a Tally-style concatenated header.
 * Tally prints column names without spaces: "ItemAmountRateQtls".
 */
function isTallyHeaderLine(line: string): boolean {
  const n = line.toLowerCase().replace(/\s/g, "");
  return (
    // Forward order: Item → Amount → Rate → Qtls
    (n.includes("item") && n.includes("amount") && n.includes("rate") && (n.includes("qtl") || n.includes("qty"))) ||
    // Reverse order variant: Item → Rate → Qtls → Amount
    (n.includes("item") && n.includes("rate") && (n.includes("qtl") || n.includes("qty")) && n.includes("amount"))
  ) && n.length < 50; // must be a short header, not a long body line
}

/**
 * Try to extract date from a Tally invoice number string.
 * Format: "{billNo}{DD}-{M/MM}-{YYYY}"  e.g. "50324-2-2026" → 2026-02-24
 * Prefers a 2-digit day interpretation, falls back to 1-digit.
 */
function parseTallyInvoiceDate(invNo: string): string {
  // Split by "-" → ["50324", "2", "2026"]  or ["503", "24", "2", "2026"] etc.
  const parts = invNo.trim().replace(/\s/g, "").split("-");
  if (parts.length < 3) return "";

  const year = parts[parts.length - 1];
  const month = parts[parts.length - 2];

  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) return "";

  const m = parseInt(month, 10);
  if (m < 1 || m > 12) return "";

  const firstPart = parts.slice(0, parts.length - 2).join(""); // e.g. "503" + "24" if 4 parts

  // Try to take the last 2 digits as the day first
  if (firstPart.length >= 2) {
    const day2 = parseInt(firstPart.slice(-2), 10);
    if (day2 >= 1 && day2 <= 31) {
      const dd = String(day2).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  // Fall back: last 1 digit as day
  if (firstPart.length >= 1) {
    const day1 = parseInt(firstPart.slice(-1), 10);
    if (day1 >= 1 && day1 <= 9) {
      const dd = String(day1).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  return "";
}

/**
 * Extract the bill date from the Tally PDF.
 * Looks for "Inv No." followed by the invoice number (on same or next line).
 * Falls back to scanning for any standard date pattern.
 */
function extractTallyDate(lines: string[]): string {
  // First try: find "Inv No." line and read the invoice number
  for (let i = 0; i < lines.length; i++) {
    if (/inv\s*no/i.test(lines[i])) {
      // Invoice number might be on the same line after ":" or on the next line
      const sameLine = lines[i].replace(/inv\s*no\.?\s*:?\s*/i, "").trim();
      if (sameLine) {
        const d = parseTallyInvoiceDate(sameLine);
        if (d) return d;
      }
      // Try next non-empty line
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j].trim();
        if (candidate && /^\d/.test(candidate)) {
          const d = parseTallyInvoiceDate(candidate);
          if (d) return d;
          break;
        }
      }
    }
  }

  // Second try: standard "Date : DD/MM/YYYY" pattern in the doc
  const standard = findGlobalDate(lines);
  if (standard) return standard;

  return "";
}

interface TallyRowRaw {
  item: string;
  qty: number;
  rate: number;
  amount: number;
  date: string;
}

/**
 * Parse rows from a Tally-format PDF after the header has been identified.
 * Each data entry spans two lines:
 *   Line 1: "{Item}{Amount}"  – item text immediately followed by amount number
 *   Line 2: "{Rate}{Qty}"     – two numbers concatenated (rate then qty)
 *
 * Lines that don't match this pattern are skipped individually (page breaks,
 * repeated headers, footer summaries, bank details, etc.).
 */
function parseTallyRows(lines: string[], firstHeaderIdx: number, globalDate: string): TallyRowRaw[] {
  const results: TallyRowRaw[] = [];

  // Regex for line 1: text prefix immediately followed by an amount number.
  // Examples: "Onion17,460.00", "Red Onion9,216.90"
  const LINE1_RE = /^([a-zA-Z][a-zA-Z\s]*?)\s*([\d,]+\.\d{2})$/;

  // Regex for line 2: two decimal numbers concatenated.
  // Examples: "970.0018.00", "1,100.0025.95", "300.002.50"
  const LINE2_RE = /^([\d,]+\.\d{2})([\d,]+\.\d+)$/;

  let i = firstHeaderIdx + 1;

  while (i < lines.length) {
    const line1 = lines[i];

    // Skip repeated Tally column headers (appear at top of each page)
    if (isTallyHeaderLine(line1)) {
      i++;
      continue;
    }

    const m1 = line1.match(LINE1_RE);
    if (!m1) {
      i++;
      continue;
    }

    // Check that line 2 exists and matches the rate+qty pattern
    const line2 = lines[i + 1];
    if (!line2) {
      i++;
      continue;
    }

    const m2 = line2.match(LINE2_RE);
    if (!m2) {
      // line1 matched but line2 didn't — treat line1 as a non-data line and skip
      i++;
      continue;
    }

    const item = m1[1].trim();
    const amount = normalizeNum(m1[2]);
    const rate = normalizeNum(m2[1]);
    const qty = normalizeNum(m2[2]);

    // Skip rows that look like summary/footer items
    const itemNorm = normalizeStr(item);
    if (SKIP_PREFIXES.some((p) => itemNorm.startsWith(p))) {
      i += 2;
      continue;
    }

    if (qty > 0 && rate > 0 && amount > 0) {
      results.push({ item, qty, rate, amount, date: globalDate });
    }

    i += 2; // consume both lines
  }

  return results;
}

// ─── Public parsers ───────────────────────────────────────────────────────────

export async function parseSalesPdf(buffer: Buffer): Promise<Omit<SaleRow, "id">[]> {
  const text = await extractText(buffer);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const headerIdx = findHeaderLine(lines);
  if (headerIdx === -1) {
    throw new Error(PDF_UNRECOGNISED_ERROR);
  }

  // ── Tally bill format (concatenated header, two-line rows) ──────────────────
  if (isTallyHeaderLine(lines[headerIdx])) {
    const globalDate = extractTallyDate(lines);
    const tallyRows = parseTallyRows(lines, headerIdx, globalDate);

    if (tallyRows.length === 0) {
      throw new Error("No data rows found in this Tally bill. Ensure the PDF is a valid Adat/commission bill.");
    }

    return tallyRows.map((r) => ({
      saleDate: r.date,
      item: toTitleCase(r.item),
      qty: r.qty,
      rate: r.rate,
      amount: r.amount,
      purchaseBillDate: null,
      status: "Pending" as const,
    }));
  }

  // ── Generic single-line-per-row format ──────────────────────────────────────
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

  // ── Tally bill format (concatenated header, two-line rows) ──────────────────
  if (isTallyHeaderLine(lines[headerIdx])) {
    const globalDate = extractTallyDate(lines);
    const tallyRows = parseTallyRows(lines, headerIdx, globalDate);

    if (tallyRows.length === 0) {
      throw new Error("No data rows found in this Tally bill. Ensure the PDF is a valid Adat/commission bill.");
    }

    return tallyRows.map((r) => ({
      billDate: r.date,
      purchaseDate: r.date,
      item: toTitleCase(r.item),
      qty: r.qty,
      rate: r.rate,
      amount: r.amount,
      status: "Unmatched" as const,
    }));
  }

  // ── Generic single-line-per-row format ──────────────────────────────────────
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
