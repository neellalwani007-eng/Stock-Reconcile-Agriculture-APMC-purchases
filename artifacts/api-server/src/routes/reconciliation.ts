import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import {
  parseSalesSheet,
  parsePurchaseSheet,
  runMatching,
  buildUpdatedSalesExcel,
  buildPendingPavatiExcel,
  buildDatewiseReportExcel,
  buildPurchaseExceptionsExcel,
  type ReconciliationResult,
} from "../lib/reconciliation.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post(
  "/run",
  upload.fields([
    { name: "salesFile", maxCount: 1 },
    { name: "purchaseFile", maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      if (!files["salesFile"] || !files["purchaseFile"]) {
        res.status(400).json({ error: "Both salesFile and purchaseFile are required." });
        return;
      }

      const salesBuffer = files["salesFile"][0].buffer;
      const purchaseBuffer = files["purchaseFile"][0].buffer;

      const salesRows = parseSalesSheet(salesBuffer);
      const purchaseRows = parsePurchaseSheet(purchaseBuffer);

      if (salesRows.length === 0) {
        res.status(400).json({ error: "Sales file appears empty or headers not recognized." });
        return;
      }
      if (purchaseRows.length === 0) {
        res.status(400).json({ error: "Purchase file appears empty or headers not recognized." });
        return;
      }

      const result = runMatching(salesRows, purchaseRows);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "Reconciliation run failed");
      res.status(400).json({ error: "Failed to process files. Ensure they are valid Excel files." });
    }
  }
);

router.post("/download/:fileType", (req: Request, res: Response) => {
  try {
    const { fileType } = req.params;
    const result: ReconciliationResult = req.body;

    if (!result || !result.salesRows || !result.purchaseRows) {
      res.status(400).json({ error: "Invalid reconciliation result in request body." });
      return;
    }

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
      default:
        res.status(400).json({ error: `Unknown fileType: ${fileType}` });
        return;
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Download failed");
    res.status(400).json({ error: "Failed to generate download file." });
  }
});

export default router;
