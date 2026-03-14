import { User } from '../models/User.js';
import { Request, Response } from "express";

export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ code: 404, message: "用户不存在" });
        }
        res.status(200).json({ code: 200, message: "获取用户信息成功", data: user });
    } catch (err: any) {
        res.status(500).json({ message: "获取用户信息失败", err: err.message });
    }
};

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ code: 404, message: "用户不存在" });
        }
        res.status(200).json({ code: 200, message: "获取用户信息成功", data: {
            name: user.name,
            account: user.account,
            avatar: user.avatar ,
            role:user.role==='admin' ? '管理员' : '普通用户',
            createdAt: user.createdAt,
            dataAssets:  []
        } });
    } catch (err: any) {
        res.status(500).json({ code:500,message: "获取用户信息失败", err: err.message });
    }
}