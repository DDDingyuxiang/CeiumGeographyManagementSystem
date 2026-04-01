import { Router } from "express";
import { handleAnalysisTask } from "../controllers/analysisController.js";
import { verifyToken } from "../middleware/auth.js"; 

const router = Router();

// 所有分析任务都必须经过 authMiddleware
// 这会确保 req.user 存在，从而在 Controller 中获取 userId
router.post("/task", verifyToken, handleAnalysisTask);

export default router;