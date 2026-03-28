# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Agricultural Trading Reconciliation System for commodity trading businesses.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Authentication**: Direct Google OAuth 2.0 (replaces Replit Auth/OIDC)
- **Storage**: Google Drive appdata folder per user (via `googleapis`) — zero DB cost per user
- **Database**: PostgreSQL + Drizzle ORM — used only for sessions table (auth tokens); sale/purchase data lives in Drive
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Excel processing**: xlsx (SheetJS)
- **File upload**: multer (memory storage)
- **Frontend**: React + Vite, Tailwind CSS, react-dropzone, framer-motion, lucide-react, recharts

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── reconciliation.ts   # Core matching logic + Excel builders
│   │       │   ├── drive.ts            # Google Drive storage (DriveUserData with notes, deletePassword)
│   │       │   └── auth.ts             # Session management
│   │       └── routes/reconciliation.ts # /api/reconciliation/* routes
│   └── reconciliation-app/ # React + Vite frontend
│       └── src/pages/Dashboard.tsx    # Main dashboard — all UI features
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── pnpm-workspace.yaml
```

## Reconciliation System

### Business Logic
- Goods are purchased from farmers in APMC market (Day 1), sold same day
- Farmers collect payment later → Purchase Bill is generated on payment date
- Sale Date ≠ Purchase Bill Date but quantities/rates/amounts are related

### Matching Algorithm (artifacts/api-server/src/lib/reconciliation.ts)
1. Filter by same commodity (item name, case-insensitive)
2. Match Sale Date = Purchase Date (original purchase date field in purchase bill)
3. Exact match on ALL of: Qty + Rate + Amount (±0.02 tolerance on Amount only)
4. 1-to-1 lot matching (no splitting, no combining, no FIFO)
5. Unmatched sales → "Pending" (pending farmer pavati/payment)

### Drive Data Model (DriveUserData)
```typescript
{
  sales: DrSaleRecord[];        // id, saleDate, item, qty, rate, amount, kpNo?, farmerName?, village?, status, purchaseBillDate
  purchases: DrPurchaseRecord[]; // id, billDate, purchaseDate, item, qty, rate, amount, status
  nextSaleId: number;
  nextPurchaseId: number;
  notes: Record<string, string>; // purchase record notes keyed by id string
  deletePassword?: string;       // optional, defaults to "confirm" if absent
}
```

### API Endpoints
- `POST /api/reconciliation/run` — multipart upload (salesFile, purchaseFile)
- `GET /api/reconciliation/reports` — load all saved records
- `GET /api/reconciliation/notes` — load all purchase notes
- `GET /api/reconciliation/settings` — { hasCustomPassword: boolean }
- `PUT /api/reconciliation/settings/delete-password` — change delete password
- `POST /api/reconciliation/settings/reset-delete-password` — reset to default "confirm"
- `POST /api/reconciliation/records/sale` — add sale (with optional kpNo, farmerName, village)
- `PUT /api/reconciliation/records/sale/:id` — edit sale
- `DELETE /api/reconciliation/records/sale/:id` — delete sale
- `POST /api/reconciliation/records/purchase` — add purchase
- `PUT /api/reconciliation/records/purchase/:id` — edit purchase
- `PUT /api/reconciliation/records/purchase/:id/note` — save/clear note
- `DELETE /api/reconciliation/records/purchase/:id` — delete purchase
- `DELETE /api/reconciliation/records/bulk` — bulk delete by ids
- `DELETE /api/reconciliation/records/date` — delete by date array + password verification
- `POST /api/reconciliation/why-unmatched` — explain non-match with top candidates
- `POST /api/reconciliation/manual-match` — force link sale to purchase with optional corrections
- `POST /api/reconciliation/download/:fileType` — Excel download

### Output Files (6 reports)
1. **Updated Sales** — all sales with Purchase Bill Date column filled for matched rows + KP/Farmer/Village
2. **Pending Pavati** — only unmatched/pending farmer payment rows
3. **Date-wise Report** — all sales with match status
4. **Purchase Exceptions** — unmatched/extra purchase bill entries + notes column
5. **Monthly Matrix (Qty)** — cross-tab matrix per commodity per month
6. **Monthly Matrix (Amount)** — same as above but in amount

### Sale Record Fields
**Required**: saleDate, item, qty, rate, amount
**Optional**: kpNo (KP No.), farmerName (Farmer Name), village (Village)

## Frontend Features (Dashboard.tsx)

### Core
- Google OAuth login, per-user data via Google Drive
- Upload mode (sales + purchase Excel) + Reports mode (saved data)
- FY selector (format "2025-26") + Multi-month dropdown (array-based filtering)

### Charts
- **MonthlyChart**: Qty/Amount tabs; when exactly 1 month selected → day-wise bar chart; else monthly

### Sale Records
- **LotInfoModal**: Info button on sale rows shows KP No., Farmer Name, Village
- **SaleFormFields**: Reusable form with optional KP No., Farmer Name, Village fields

### Purchase Records
- **NoteModal**: Note button on purchase exception rows for adding/editing per-record notes
- Notes are persisted to Google Drive and shown inline

### Delete by Date
- **DeleteByDateModal**: Multi-select checklist of dates + password verification
  - "Change Password": old/new/confirm form
  - "Forgot Password?": shows user email, offers one-click reset to default "confirm"
  - Default password: "confirm"; custom password stored as `deletePassword` in Drive

### Manual Match
- Step 1: Close Matches section (score ≥ 3/5) shown above All Unmatched list
- Step 2: Side-by-side field comparison with inline correction

### Summary Table
- Total row at bottom when multiple commodities

## Root Scripts
- `pnpm run build` — runs typecheck first, then recursively runs build
- `pnpm run typecheck` — runs tsc --build --emitDeclarationOnly using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas from OpenAPI spec
