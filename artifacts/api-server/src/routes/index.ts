import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inferenceRouter from "./inference";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inferenceRouter);

export default router;
