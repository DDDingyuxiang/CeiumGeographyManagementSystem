import { Request, Response } from "express";
import { DataAsset } from "../models/DataAsset.js";
import path from "path";
import fs from "fs";
import { Gs_Client } from "../config/geoserver.js";
import db from "../config/db.js";



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
		const { id } = req.params;
		const userId = (req as any).user.id;

		const targetAsset = await DataAsset.findOne({ _id: id, userId: userId });
		if (!targetAsset) {
			return res.status(404).json({ code: 404, message: "数据不存在" });
		}

		const filePath = path.resolve(targetAsset.path);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}

		await DataAsset.deleteOne({ _id: id });
		await db("user_features").where({ asset_id: id, user_id: userId }).del();

		res.json({ code: 200, message: "删除成功" });
	} catch (error) {
		res.status(500).json({ message: "服务器删除数据失败" });
	}
};


const gsClient = Gs_Client.client;
const geoserverUrl = Gs_Client.baseUrl;
// 发布我的数据
export const publishData = async (req: Request, res: Response) => {
    try {
        const userid = (req as any).user.id;
        // 确保 assetId 是从 body 获取的，这是关联数据库的关键
        const { filename, assetId } = req.body; 

        const filePath = path.join(process.cwd(), "uploads", "data", userid, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ code: 404, message: "磁盘文件不存在" });
        }

        const fileExt = path.extname(filename).toLowerCase();
        const workspace = "user_data_space";

        // 确保 GeoServer 工作空间存在
        const wsExists = await gsClient.workspaces.exists(workspace);
        if (!wsExists) await gsClient.workspaces.create(workspace);

        // --- TIFF 栅格分支 ---
        if (fileExt === ".tif" || fileExt === ".tiff") {
            const uniqueId = Date.now();
            const commonName = `tiff_${uniqueId}`; // Store 和 Layer 用同一个名字
            const absolutePath = path.resolve(filePath).replace(/\\/g, '/');

            await gsClient.coveragestores.create(workspace, {
                name: commonName,
                type: "GeoTIFF",
                url: `file:///${absolutePath}`,
            });
            await gsClient.coverages.publish(workspace, commonName, {
                name: commonName,
            });

            return res.json({
                code: 200,
                message: "TIFF发布成功",
                storeName: commonName,
                layerName: commonName,
                wmsUrl: `${geoserverUrl}/wms`,
                layers: `${workspace}:${commonName}`,
            });
        } 
        
        // --- GeoJSON 矢量分支 ---
        else if (fileExt === ".json" || fileExt === ".geojson") {
            let rawData = fs.readFileSync(filePath, "utf-8");

			rawData = rawData.replace(/^\uFEFF/, '').trim();

            const geoJson = JSON.parse(rawData);

            // 1. 准备数据
            const features = geoJson.features.map((f: any) => ({
                user_id: userid,
                asset_id: assetId, 
                properties: JSON.stringify(f.properties),
                // ST_SetSRID 强制设为 4326
                geom: db.raw(`ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)`, [JSON.stringify(f.geometry)]),
            }));

            // 2. 写入 PostGIS (统一使用 db)
            await db("user_features").insert(features);

            // 3. 返回 WMS 信息
            return res.json({
                code: 200,
                message: "矢量数据入库成功",
                wmsUrl: `${geoserverUrl}/wms`,
                // 这个 layer 名称必须和你稍后在 GeoServer 里手动创建的 SQL View 名称一致
                layers: `${workspace}:user_features_sql_view`,
                viewparams: `aid:${assetId}`, 
            });
        }

        return res.status(400).json({ code: 400, message: "不支持的文件格式" });
    } catch (error: any) {
        console.error("Publish Error:", error); // 调试利器
        res.status(500).json({ code: 500, message: `发布失败: ${error.message}` });
    }
};

// 清除我的数据
export const cleanupResources = async (req: Request, res: Response) => {
  const { workspace, resources } = req.body;
  
    

  for (const item of resources) {
    try {
      await gsClient.coveragestores.delete(workspace, item.storeName);
    } catch (e: any) {
      console.error("--- GeoServer 拒收详情 ---");
    }
  }
  res.json({ code: 200, message: "清理指令执行完毕" });
};