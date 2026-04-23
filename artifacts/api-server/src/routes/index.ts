import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reconciliationRouter from "./reconciliation";
import subscriptionRouter from "./subscription";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/reconciliation", reconciliationRouter);
router.use("/subscription", subscriptionRouter);
router.use("/admin", adminRouter);

export default router;
