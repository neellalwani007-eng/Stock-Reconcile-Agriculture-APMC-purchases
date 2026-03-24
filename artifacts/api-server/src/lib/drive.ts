import { google } from "googleapis";
import type { SessionData } from "./auth.js";

const DRIVE_FILE_NAME = "stock-reconciler-data.json";

export class DriveInsufficientScopeError extends Error {
  constructor() {
    super("Google Drive permission not granted. Please sign in again.");
    this.name = "DriveInsufficientScopeError";
  }
}

function isInsufficientScopeError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e["code"] === 403 || e["status"] === 403) {
    const response = e["response"] as Record<string, unknown> | undefined;
    const data = response?.["data"] as Record<string, unknown> | undefined;
    const error = data?.["error"] as Record<string, unknown> | undefined;
    const reason = (error?.["status"] as string) ?? "";
    if (reason === "PERMISSION_DENIED") return true;
    const details = error?.["details"] as Array<Record<string, unknown>> | undefined;
    if (details?.some((d) => d["reason"] === "ACCESS_TOKEN_SCOPE_INSUFFICIENT")) return true;
  }
  return false;
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface DrSaleRecord {
  id: number;
  saleDate: string;
  item: string;
  qty: string;
  rate: string;
  amount: string;
  status: "Pending" | "Matched";
  purchaseBillDate: string | null;
}

export interface DrPurchaseRecord {
  id: number;
  billDate: string;
  purchaseDate: string;
  item: string;
  qty: string;
  rate: string;
  amount: string;
  status: "Matched" | "Unmatched" | "Extra";
}

export interface DriveUserData {
  version: number;
  nextSaleId: number;
  nextPurchaseId: number;
  sales: DrSaleRecord[];
  purchases: DrPurchaseRecord[];
}

const EMPTY_DATA: DriveUserData = {
  version: 1,
  nextSaleId: 1,
  nextPurchaseId: 1,
  sales: [],
  purchases: [],
};

export function createDriveClient(
  session: SessionData,
  onTokenRefresh?: (tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) => void,
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expiry_date: session.expires_at ? session.expires_at * 1000 : undefined,
  });
  if (onTokenRefresh) {
    oauth2Client.on("tokens", onTokenRefresh);
  }
  return oauth2Client;
}

async function findOrCreateFile(
  drive: ReturnType<typeof google.drive>,
): Promise<string> {
  let list;
  try {
    list = await drive.files.list({
      spaces: "appDataFolder",
      q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
    });
  } catch (err) {
    if (isInsufficientScopeError(err)) throw new DriveInsufficientScopeError();
    throw err;
  }

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id!;
  }

  try {
    const created = await drive.files.create({
      requestBody: {
        name: DRIVE_FILE_NAME,
        parents: ["appDataFolder"],
        mimeType: "application/json",
      },
      media: {
        mimeType: "application/json",
        body: JSON.stringify(EMPTY_DATA),
      },
      fields: "id",
    });
    return created.data.id!;
  } catch (err) {
    if (isInsufficientScopeError(err)) throw new DriveInsufficientScopeError();
    throw err;
  }
}

export async function readUserData(
  session: SessionData,
  onTokenRefresh?: Parameters<typeof createDriveClient>[1],
): Promise<DriveUserData> {
  const auth = createDriveClient(session, onTokenRefresh);
  const drive = google.drive({ version: "v3", auth });

  const fileId = await findOrCreateFile(drive);

  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" },
    );
    const raw = res.data as string;
    const parsed = JSON.parse(raw) as DriveUserData;
    return {
      ...EMPTY_DATA,
      ...parsed,
      nextSaleId: parsed.nextSaleId ?? 1,
      nextPurchaseId: parsed.nextPurchaseId ?? 1,
      sales: (parsed.sales ?? []).map((s) => ({
        ...s,
        item: toTitleCase(s.item ?? ""),
      })),
      purchases: (parsed.purchases ?? []).map((p) => ({
        ...p,
        item: toTitleCase(p.item ?? ""),
      })),
    };
  } catch {
    return { ...EMPTY_DATA };
  }
}

export async function writeUserData(
  session: SessionData,
  data: DriveUserData,
  onTokenRefresh?: Parameters<typeof createDriveClient>[1],
): Promise<void> {
  const auth = createDriveClient(session, onTokenRefresh);
  const drive = google.drive({ version: "v3", auth });

  const fileId = await findOrCreateFile(drive);

  await drive.files.update({
    fileId,
    media: {
      mimeType: "application/json",
      body: JSON.stringify(data),
    },
  });
}
