import express, { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";
import { startExtractedFilesCleanupJob } from "./jobs/cleanupExtractedFiles.js";

dotenv.config();

const app: express.Express = express();
const port = process.env.PORT || 3000;

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("/api/datasets/cleanup", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoUrl = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cesium_db";
mongoose
  .connect(mongoUrl)
  .then(() => console.log("数据库连接成功"))
  .catch((err) => console.error("数据库连接失败", err));

startExtractedFilesCleanupJob();

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error) {
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }

  res.status(500).json({ message: "内部错误" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.listen(port || 3000, () => {
  console.log("服务启动中");
});

export default app;
