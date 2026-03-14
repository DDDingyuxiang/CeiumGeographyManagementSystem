import express, { Request, Response, NextFunction } from "express";
import authRoutes from './routes/authRoutes.js';
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

// 初始化和端口设置
const app:express.Express = express();
const port = process.env.PORT || 3000;

app.use('uploads',express.static(path.join(process.cwd(),'uploads')))

// 中间件
app.use(cors()); //允许跨域
app.use(express.json()); //解析json请求体
app.use(express.urlencoded({ extended: true })); //解析url编码的请求体

// 资源托管
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// 链接数据库
const mongoUrl = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cesium_db";
mongoose
	.connect(mongoUrl)
	.then(() => console.log("数据库连接成功"))
	.catch((err) => console.error("数据库连接失败:", err));

// 路由使用
// app.use('/api/auth',authController);

// 错误处理中间件
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
	if (err instanceof Error) {
		return res.status(400).json({
			status: "error",
			message: err.message,
		});
	}
    res.status(500).json({message:'内部错误'})
});

app.use('/api/auth', authRoutes);
app.use('/api/users',userRoutes);

// 端口监听
app.listen(port || 3000,()=>{
    console.log("服务启动中");
});

export default app;
