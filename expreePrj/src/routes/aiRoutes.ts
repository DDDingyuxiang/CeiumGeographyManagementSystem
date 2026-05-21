import { Router } from "express";
import { handleCreateAnalysisPlan } from "../controllers/aiController.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/plan", verifyToken, handleCreateAnalysisPlan);

export default router;
