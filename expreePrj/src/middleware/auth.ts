import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const verifyToken = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(403).json({ code: 403, message: "未提供认证token" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({ code: 401, message: "Token 格式非法" });
    }

    const pureToken: string = parts[1]!;

    try {
        // 使用强制类型转换确保匹配到 jwt.verify(token, secretOrPublicKey)
        const secret = (process.env.JWT_SECRET || "secret_key") as string;
        const decoded = jwt.verify(pureToken, secret);
        
        (req as any).user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ code: 401, message: "token失效，请重新登录" });
    }
};