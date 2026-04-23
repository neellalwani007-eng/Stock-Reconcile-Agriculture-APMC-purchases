// Import from the library core to avoid the known test-file bug in pdf-parse@1.1.1 index.js
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – no types for the internal path, but the function signature is identical
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { normalizeDate, normalizeNum } from "./reconciliation.js";
import type { SaleRow, PurchaseRow } from "./reconciliation.js";

const UNIT_TOKENS = new Set([
  "qtl", "qtls", "bag", "bags", "kg", "kgs", "unit", "units",
  "pcs", "no", "nos", "mtr", "mtrs", "ltr", "ltrs", "ton", "tons",
  "quintal", "quintals", "mt", "mts",
]);

const SKIP_PREFIXES = [
  "total", "grand total", "sub total", "subtotal", "net total", "net amount",
];

const HEADER_KEYWORDS = [
  "date", "item", "commodity", "qty", "quantity", "rate", "amount",
  "amt", "particulars", "description",
];

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

function findHeaderLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    let hits = 0;
    for (const kw of HEADER_KEYWORDS) {
      if (lower.includes(kw)) hits++;
    }
    if (hits >= 3) return i;
  }
  return -1;
}

interface RowTokens {
  item: string;
  date: string;
  numbers: number[];
}

function tokenizeLine(line: string): RowTokens | null {
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
  const itemLower = item.toLowerCase();

  if (!item) return null;
  if (SKIP_PREFIXES.some((p) => itemLower.startsWith(p))) return null;
  if (numbers.length === 0) return null;

  return { item, date, numbers };
}

const PDF_UNRECOGNISED_ERROR =
  "PDF format not recognised. Please export as Excel instead.";

export async function parseSalesPdf(buffer: Buffer): Promise<Omit<SaleRow, "id">[]> {
  const text = await extractText(buffer);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const globalDate = findGlobalDate(lines);
  const headerIdx = findHeaderLine(lines);
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;

  const rows: Omit<SaleRow, "id">[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parsed = tokenizeLine(lines[i]);
    if (!parsed) continue;

    // Tally column order: qty, rate, amount (amount is always last)
    const qty = parsed.numbers[0] ?? 0;
    if (qty === 0) continue;

    const rate = parsed.numbers.length >= 2 ? parsed.numbers[1] : 0;
    const amount =
      parsed.numbers.length >= 3 ? parsed.numbers[parsed.numbers.length - 1] : 0;
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

  const globalDate = findGlobalDate(lines);
  const headerIdx = findHeaderLine(lines);
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;

  const rows: Omit<PurchaseRow, "id">[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parsed = tokenizeLine(lines[i]);
    if (!parsed) continue;

    const qty = parsed.numbers[0] ?? 0;
    if (qty === 0) continue;

    const rate = parsed.numbers.length >= 2 ? parsed.numbers[1] : 0;
    const amount =
      parsed.numbers.length >= 3 ? parsed.numbers[parsed.numbers.length - 1] : 0;
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
