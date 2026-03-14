import { Request, Response } from "express";
import { DataAsset } from "../models/DataAsset.js";
import path from "path";
import fs from "fs";

// 上传
export const uploadAssets = async (req: Request, res: Response) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: "未上传文件" });
		}

		const userId = (req as any).user.id;
		const type = req.body.type;
		const newAsset = new DataAsset({
			userId: userId,
			name: req.file.originalname,
			filename: req.file.filename, // 修复此处：fileName -> filename
			type: type,
			size: req.file.size,
			path: req.file.path,
		});

		await newAsset.save();
		res
			.status(200)
			.json({ code: 200, message: "数据上传成功", data: newAsset });
	} catch (error) {
		res.status(500).json({ code: 500, message: "服务器存储数据失败" });
	}
};

// 获取我的数据
export const getMyAssets = async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user.id;
		const assets = await DataAsset.find({ userId: userId }).sort({
			createdAt: -1,
		});
		res.status(200).json({ code: 200, message: "获取数据成功", data: assets });
	} catch (error) {
		res.status(500).json({ code: 500, message: "服务器获取数据失败" });
	}
};

// 删除我的数据
export const deleteAsset = async (req: Request, res: Response) => {
	try {
		const {id}  = req.params;
		const userId = (req as any).user.id;

		const targetAsset = await DataAsset.findOne({ _id: id, userId: userId });
		if(!targetAsset){
			return res.status(404).json({ code: 404,message: "数据不存在" });
		}

		const filePath = path.resolve(targetAsset.path);
		if(fs.existsSync(filePath)){
			fs.unlinkSync(filePath);
		}

		await DataAsset.deleteOne({_id:id});

		res.json({code:200,message:'删除成功'})
	} catch (error) {
		res.status(500).json({ message: "服务器删除数据失败" });
	}
};