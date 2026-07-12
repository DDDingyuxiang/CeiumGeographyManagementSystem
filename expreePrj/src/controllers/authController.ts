import { Request, Response } from "express";
import { User } from "../models/User.js";
import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs/index.js";

export const register = async (req: Request, res: Response) => {
	try {
		// 两次密码校验
		const { name, account, password, confirmPassword } = req.body;
		if (password !== confirmPassword) {
			return res.status(400).json({ message: "两次密码不一致" });
		}

		// 邮箱存在检验
		const existingUser = await User.findOne({ account });
		if (existingUser) {
			return res.status(400).json({ message: "邮箱已被注册" });
		}

		// 密码加密
		const hashedPassword = await bcrypt.hash(password, 10);

		// 头像存储路径
		const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : "";

		// 保存用户
		const newUser = new User({
			name,
			account,
			password: hashedPassword,
			avatar: avatarPath,
			role: "user", // 强制设为 user，确保安全
		});

		await newUser.save();

		res.status(201).json({
			code: 200,
			message: "注册成功",
			data: { name: newUser.name, account: newUser.account },
		});
	} catch (err: any) {
		res.status(500).json({ message: "注册失败", err: err.message });
	}
};

export const login = async (req: Request, res: Response) => {
	try {
		const { account, password } = req.body;

		// 邮箱存在检验
		const user = await User.findOne({ account });
		if (!user) {
			return res.status(401).json({ code: 401, message: "用户不存在" });
		}

		// 密码校验
		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(401).json({ code: 401, message: "密码错误" });
		}

		// 签发jwt
		const token = jwt.sign(
			{ id: user._id, account: user.account },
			process.env.JWT_SECRET || "secret_key",
			{
				expiresIn: "24h",
			},
		);

		res.json({
			code: 200,
			message: "登录成功",
			data: {
				token: `Bearer ${token}`,
				user: {
					name: user.name,
					avatar: user.avatar,
					role: user.role === 'admin' ? '管理员' : '普通用户',
					account: user.account,
				},
			},
		});
	} catch (err: any) {
		res
			.status(500)
			.json({ code: 500, message: "服务器内部错误", err: err.message });
	}
};
