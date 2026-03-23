import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reconciliationRouter from "./reconciliation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/reconciliation", reconciliationRouter);

export default router;
