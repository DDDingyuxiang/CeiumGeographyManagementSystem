import express, { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ServerResponse } from "http";
import userRoutes from "./routes/userRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import { startExtractedFilesCleanupJob } from "./jobs/cleanupExtractedFiles.js";

dotenv.config();

const app: express.Express = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("/api/datasets/cleanup", cors());

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res: ServerResponse) => {
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    },
  }),
);

app.use(
  "/temp-analysis",
  express.static(path.join(process.cwd(), "geoserver_data", "temp_analysis"), {
    setHeaders: (res: ServerResponse) => {
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoUrl = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cesium_db";
mongoose
  .connect(mongoUrl)
  .then(() => console.log("数据库连接成功"))
  .catch((err) => console.error("数据库连接失败", err));

startExtractedFilesCleanupJob();

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/ai", aiRoutes);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) {
    return res.status(400).json({
      code: 400,
      status: "error",
      message: err.message,
    });
  }

  res.status(500).json({ code: 500, message: "内部错误" });
});

app.listen(port || 3000, () => {
  console.log("服务启动中");
});

export default app;
