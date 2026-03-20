import { Request, Response } from "express";
import { DataAsset } from "../models/DataAsset.js";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
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
        } // --- GeoJSON 矢量分支 ---
        else if (fileExt === ".json" || fileExt === ".geojson") {
            let rawData = fs.readFileSync(filePath, "utf-8");

			rawData = rawData.replace(/^\uFEFF/, '').trim();

    		// 调试打印：如果依然报错，查看前10个字符的十六进制编码
    		console.log("清洗后内容预览:", rawData.substring(0, 10));
    		console.log("第一个字符编码:", rawData.charCodeAt(0));

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
        } // --- ZIP 压缩分支 ---
        else if (fileExt === ".zip") {
            const extractDir = path.join(process.cwd(), "uploads", "temp", userid, Date.now().toString());
            fs.mkdirSync(extractDir, { recursive: true });

            // 解压 ZIP
            const zip = new AdmZip(filePath);
            zip.extractAllTo(extractDir, true);

            // 查找所有 SHP 文件
            const findShpFiles = (dir: string): string[] => {
                const results: string[] = [];
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        results.push(...findShpFiles(fullPath));
                    } else if (item.toLowerCase().endsWith('.shp')) {
                        results.push(fullPath);
                    }
                }
                return results;
            };

            const shpFiles = findShpFiles(extractDir);

            if (shpFiles.length === 0) {
                fs.rmSync(extractDir, { recursive: true, force: true });
                return res.status(400).json({ code: 400, message: "ZIP 中未找到 SHP 文件" });
            }

            const results = [];

            // 处理每个 SHP 文件
            for (const shpPath of shpFiles) {
                const shpDir = path.dirname(shpPath);
                const shpName = path.basename(shpPath, '.shp');
                const uniqueId = Date.now() + Math.floor(Math.random() * 1000);
                const storeName = `shp_${shpName}_${uniqueId}`;

                // 检查必需文件
                const hasShx = fs.existsSync(path.join(shpDir, shpName + '.shx'));
                const hasDbf = fs.existsSync(path.join(shpDir, shpName + '.dbf'));

                if (!hasShx || !hasDbf) {
                    console.warn(`跳过不完整的 SHP: ${shpName}`);
                    continue;
                }

                // 复制到 GeoServer 数据目录
                const gsDataDir = path.join(process.cwd(), "geoserver_data", workspace, storeName);
                fs.mkdirSync(gsDataDir, { recursive: true });

                // 复制所有相关文件
                const relatedExts = ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx'];
                for (const ext of relatedExts) {
                    const srcFile = path.join(shpDir, shpName + ext);
                    if (fs.existsSync(srcFile)) {
                        fs.copyFileSync(srcFile, path.join(gsDataDir, shpName + ext));
                    }
                }

                // 创建 Shapefile DataStore
                const shpPathInGs = path.join(gsDataDir, `${shpName}.shp`).replace(/\\/g, '/');
                await gsClient.datastores.create(workspace, {
                    name: storeName,
                    url: `file://${shpPathInGs}`,
                    charset: 'UTF-8'
                });

                // 发布图层
                await gsClient.datastores.publish(workspace, storeName, shpName);

                results.push({
                    storeName,
                    layerName: shpName,
                    fullLayerName: `${workspace}:${shpName}`
                });
            }

            // 清理临时目录
            fs.rmSync(extractDir, { recursive: true, force: true });

            if (results.length === 0) {
                return res.status(400).json({ code: 400, message: "ZIP 中的 SHP 文件均不完整" });
            }

            // 返回主图层信息（如果有多个，返回第一个，其余在前端可选）
            const mainResult = results[0]!;
            
            return res.json({
                code: 200,
                message: `SHP 发布成功`,
                storeName: mainResult.storeName,
                layerName: mainResult.layerName,
                wmsUrl: `${geoserverUrl}/wms`,
                layers: mainResult.fullLayerName,
                layerType: 'vector',
                format: 'shp',
                allLayers: results.map(r => ({
                    name: r.layerName,
                    layers: r.fullLayerName
                }))
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
  if (e.response) {
    console.error("状态码:", e.response.status);
    console.error("错误响应体:", e.response.data); // 这里是关键，看它说了什么
  } else {
    console.error("错误消息:", e.message);
  }
  console.error("--------------------------");
    }
  }
  res.json({ code: 200, message: "清理指令执行完毕" });
};