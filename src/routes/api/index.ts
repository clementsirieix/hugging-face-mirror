import { Router } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";

const router = Router();

router.use("/health", healthRouter);
router.use("/jobs", jobsRouter);

export default router;
