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
  kpNo?: string;
  farmerName?: string;
  village?: string;
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

function optStr(r: unknown[], col: number): string | undefined {
  if (col === -1 || r[col] == null || String(r[col]).trim() === "") return undefined;
  return String(r[col]).trim();
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
  const kpNoCol = findCol(hm, "kp no.", "kp no", "kp no.", "kpno", "kp");
  const farmerCol = findCol(hm, "farmer name", "farmer", "grower name", "grower");
  const villageCol = findCol(hm, "village", "vill", "location", "village name");

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
      kpNo: optStr(r, kpNoCol),
      farmerName: optStr(r, farmerCol),
      village: optStr(r, villageCol),
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
  const effectivePurDateCol = purdatecol !== -1 ? purdatecol : billdatecol;
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
      purchaseDate: normalizeDate(r[effectivePurDateCol]),
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
    ["Sale Date", "Item", "Qty (QTL)", "Rate", "Amount", "KP No.", "Farmer Name", "Village", "Purchase Bill Date", "Status"],
    ...result.salesRows.map((r) => [
      r.saleDate, r.item, r.qty, r.rate, r.amount,
      r.kpNo ?? "", r.farmerName ?? "", r.village ?? "",
      r.purchaseBillDate ?? "", r.status,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Updated Sales");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildPendingPavatiExcel(result: ReconciliationResult): Buffer {
  const wb = XLSX.utils.book_new();
  const pending = result.salesRows.filter((r) => r.status === "Pending");
  const data = [
    ["Sale Date", "Commodity", "Quantity (QTL)", "Rate", "Amount", "KP No.", "Farmer Name", "Village"],
    ...pending.map((r) => [
      r.saleDate, r.item, r.qty, r.rate, r.amount,
      r.kpNo ?? "", r.farmerName ?? "", r.village ?? "",
    ]),
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

export function buildPurchaseExceptionsExcel(
  result: ReconciliationResult,
  notes: Record<string, string> = {},
): Buffer {
  const wb = XLSX.utils.book_new();
  const exceptions = result.purchaseRows.filter((r) => r.status !== "Matched");
  const data = [
    ["Bill Date", "Purchase Date", "Commodity", "Qty (QTL)", "Rate", "Amount", "Status", "Note"],
    ...exceptions.map((r) => [
      r.billDate, r.purchaseDate, r.item, r.qty, r.rate, r.amount, r.status,
      notes[String(r.id)] ?? "",
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Purchase Exceptions");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function monthOf(d: string): string { return d ? d.slice(0, 7) : ""; }

function sortedUniq(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}

export function buildMonthlyMatrixExcel(
  result: ReconciliationResult,
  mode: "qty" | "amount",
  fy: string,
): Buffer {
  const wb = XLSX.utils.book_new();

  function getFY(dateStr: string): string {
    const d = new Date(dateStr);
    const mo = d.getMonth() + 1;
    const yr = d.getFullYear();
    return mo >= 4 ? `${yr}-${String(yr + 1).slice(-2)}` : `${yr - 1}-${String(yr).slice(-2)}`;
  }
  const sales = result.salesRows.filter((r) => getFY(r.saleDate) === fy);
  const purchases = result.purchaseRows.filter((r) => getFY(r.billDate) === fy);

  const items = sortedUniq([
    ...sales.map((r) => r.item),
    ...purchases.map((r) => r.item),
  ]);

  const allMonths = sortedUniq([
    ...sales.map((r) => monthOf(r.saleDate)),
    ...purchases.map((r) => monthOf(r.billDate)),
  ]);

  const MNAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function monthLabel(ym: string): string {
    const [y, m] = ym.split("-");
    return `${MNAMES[parseInt(m) - 1]} ${y}`;
  }

  for (const item of items) {
    const itemSales = sales.filter((r) => r.item === item);
    const itemPurchases = purchases.filter((r) => r.item === item);

    type CellKey = string;
    const cellMap = new Map<CellKey, number>();
    for (const s of itemSales) {
      if (s.status === "Matched" && s.purchaseBillDate) {
        const key: CellKey = `${s.saleDate}|${s.purchaseBillDate}`;
        cellMap.set(key, (cellMap.get(key) ?? 0) + (mode === "qty" ? s.qty : s.amount));
      }
    }

    for (const monthKey of allMonths) {
      const billDates = sortedUniq(
        itemPurchases
          .filter((r) => monthOf(r.billDate) === monthKey)
          .map((r) => r.billDate),
      );

      const thisMonthSaleDates = sortedUniq(
        itemSales
          .filter((r) => monthOf(r.saleDate) === monthKey)
          .map((r) => r.saleDate),
      );

      const cfMap = new Map<string, number>();

      for (const s of itemSales) {
        if (monthOf(s.saleDate) >= monthKey) continue;
        const val = mode === "qty" ? s.qty : s.amount;

        if (s.status === "Pending") {
          cfMap.set(s.saleDate, (cfMap.get(s.saleDate) ?? 0) + val);
        } else if (
          s.status === "Matched" &&
          s.purchaseBillDate &&
          monthOf(s.purchaseBillDate) === monthKey
        ) {
          cfMap.set(s.saleDate, (cfMap.get(s.saleDate) ?? 0) + val);
        }
      }

      const carryForwardSaleDates = sortedUniq([...cfMap.keys()]);
      const carryForwardRows: { label: string; saleDate: string; opPay: number }[] =
        carryForwardSaleDates.map((sd) => ({
          label: fmtDate(sd),
          saleDate: sd,
          opPay: cfMap.get(sd) ?? 0,
        }));

      const cfSdSet = new Set(carryForwardSaleDates);
      const rowSaleDates: { label: string; saleDate: string; opPay: number }[] = [
        ...carryForwardRows,
        ...thisMonthSaleDates
          .filter((sd) => !cfSdSet.has(sd))
          .map((sd) => ({ label: fmtDate(sd), saleDate: sd, opPay: 0 })),
      ];

      if (rowSaleDates.length === 0 && billDates.length === 0) continue;

      const header: (string | number)[] = [
        "Date",
        ...billDates.map(fmtDate),
        "Total",
        "Op Pay",
        "Bill Qty",
        "Pending Pay",
      ];
      const aoa: (string | number)[][] = [header];

      const colTotals: number[] = new Array(billDates.length).fill(0);
      let grandTotal = 0;
      let totalBillQty = 0;
      let opPayTotal = 0;
      let pendingPayTotal = 0;

      for (const { label, saleDate, opPay } of rowSaleDates) {
        const isCarryForward = cfSdSet.has(saleDate);

        const billQty = isCarryForward
          ? opPay
          : itemSales
              .filter((r) => r.saleDate === saleDate)
              .reduce((a, r) => a + (mode === "qty" ? r.qty : r.amount), 0);

        const rowValues: number[] = billDates.map((bd) => {
          const key: CellKey = `${saleDate}|${bd}`;
          return cellMap.get(key) ?? 0;
        });

        const rowTotal = rowValues.reduce((a, v) => a + v, 0);

        const pendingPay = isCarryForward
          ? Math.max(0, opPay - rowTotal)
          : Math.max(0, billQty - rowTotal);

        const row: (string | number)[] = [
          label,
          ...rowValues.map((v) => (v > 0 ? v : "")),
          rowTotal > 0 ? rowTotal : "",
          opPay > 0 ? opPay : "",
          billQty > 0 ? billQty : "",
          pendingPay > 0 ? pendingPay : "",
        ];
        aoa.push(row);

        rowValues.forEach((v, i) => { colTotals[i] += v; });
        grandTotal += rowTotal;
        totalBillQty += billQty;
        opPayTotal += opPay;
        pendingPayTotal += pendingPay;
      }

      const totalRow: (string | number)[] = [
        "Total",
        ...colTotals.map((v) => (v > 0 ? v : "")),
        grandTotal > 0 ? grandTotal : "",
        opPayTotal > 0 ? opPayTotal : "",
        totalBillQty > 0 ? totalBillQty : "",
        pendingPayTotal > 0 ? pendingPayTotal : "",
      ];
      aoa.push(totalRow);

      const sheetName = `${monthLabel(monthKey)} - ${item}`.slice(0, 31);
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      ws["!cols"] = [{ wch: 14 }, ...billDates.map(() => ({ wch: 12 })), { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];

      for (let C = range.s.c; C <= range.e.c; C++) {
        const hCell = XLSX.utils.encode_cell({ r: 0, c: C });
        const tCell = XLSX.utils.encode_cell({ r: aoa.length - 1, c: C });
        if (ws[hCell]) ws[hCell].s = { font: { bold: true }, fill: { fgColor: { rgb: "1A4731" } }, fontColor: { rgb: "FFFFFF" } };
        if (ws[tCell]) ws[tCell].s = { font: { bold: true }, fill: { fgColor: { rgb: "D9EAD3" } } };
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["No data available for the selected FY"]]);
    XLSX.utils.book_append_sheet(wb, ws, "No Data");
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
