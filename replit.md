# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Agricultural Trading Reconciliation System for commodity trading businesses.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (provisioned but not used for reconciliation — stateless file processing)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Excel processing**: xlsx (SheetJS)
- **File upload**: multer (memory storage)
- **Frontend**: React + Vite, Tailwind CSS, react-dropzone, framer-motion, lucide-react

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/reconciliation.ts   # Core matching logic
│   │       └── routes/reconciliation.ts # /api/reconciliation/* routes
│   └── reconciliation-app/ # React + Vite frontend
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
1. Filter by same commodity (item name)
2. Match Sale Date = Purchase Date (original purchase date field in purchase bill)
3. Exact match on ALL of: Qty + Rate + Amount (NO tolerance)
4. 1-to-1 lot matching (no splitting, no combining, no FIFO)
5. Unmatched sales → "Pending" (pending farmer pavati/payment)

### API Endpoints
- `POST /api/reconciliation/run` — multipart upload (salesFile, purchaseFile), returns ReconciliationResult JSON
- `POST /api/reconciliation/download/:fileType` — body is ReconciliationResult, returns Excel binary
  - fileType: updated-sales, pending-pavati, datewise-report, purchase-exceptions

### Expected Excel Column Names
**Sales file**: Sale Date, Item, Qty, Rate, Amount
**Purchase file**: Date (bill/payment date), Purchase Date (original purchase date), Item, QTY, Rate, Amount

### Output Files
1. **Updated Sales** — all sales with Purchase Bill Date column filled for matched rows
2. **Pending Pavati** — only unmatched/pending farmer payment rows
3. **Date-wise Report** — all sales with match status
4. **Purchase Exceptions** — unmatched/extra purchase bill entries

## Root Scripts
- `pnpm run build` — runs typecheck first, then recursively runs build
- `pnpm run typecheck` — runs tsc --build --emitDeclarationOnly using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas from OpenAPI spec
