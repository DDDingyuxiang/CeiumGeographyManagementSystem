import { Request, Response } from "express";
import { DataAsset, IDataAsset } from "../models/DataAsset.js";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { Gs_Client } from "../config/geoserver.js";
import db from "../config/db.js";

const gsClient = Gs_Client.client;
const geoserverUrl = Gs_Client.baseUrl;
const userWorkspace = "user_data_space";
const extractedRoot = path.join(process.cwd(), "uploads", "extracted");
const geoserverDataRoot = path.join(process.cwd(), "geoserver_data");
const tempAnalysisRoot = path.join(geoserverDataRoot, "temp_analysis");

const ensureDirectory = (targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const sanitizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "layer";

const buildStoreName = (assetId: string, shpName: string) =>
  `shp_${sanitizeName(assetId)}_${sanitizeName(shpName)}`;

const isFiniteBounds = (bounds: unknown): bounds is [number, number, number, number] =>
  Array.isArray(bounds) &&
  bounds.length === 4 &&
  bounds.every((value) => Number.isFinite(value));

const extractGeoJsonBounds = (geoJson: any): [number, number, number, number] | undefined => {
  if (isFiniteBounds(geoJson?.bbox)) {
    return geoJson.bbox;
  }

  const bounds = [Infinity, Infinity, -Infinity, -Infinity];

  const scanCoordinates = (coordinates: any) => {
    if (!Array.isArray(coordinates)) {
      return;
    }

    if (
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      const x = coordinates[0] as number;
      const y = coordinates[1] as number;
      bounds[0] = Math.min(bounds[0]!, x);
      bounds[1] = Math.min(bounds[1]!, y);
      bounds[2] = Math.max(bounds[2]!, x);
      bounds[3] = Math.max(bounds[3]!, y);
      return;
    }

    coordinates.forEach(scanCoordinates);
  };

  for (const feature of geoJson?.features ?? []) {
    scanCoordinates(feature?.geometry?.coordinates);
  }

  return bounds.every(Number.isFinite)
    ? (bounds as [number, number, number, number])
    : undefined;
};

const fetchGeoServerBounds = async (
  getter: () => Promise<[number, number, number, number] | undefined>,
) => {
  try {
    const bounds = await getter();
    return isFiniteBounds(bounds) ? bounds : undefined;
  } catch {
    return undefined;
  }
};

const getAssetIdentifier = (asset: IDataAsset) => {
  const assetIdentifier = asset.id || asset._id?.toString();
  if (!assetIdentifier) {
    throw new Error("数据资产缺少标识");
  }

  return assetIdentifier;
};


const findShpFiles = (dir: string): string[] => {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findShpFiles(fullPath));
      continue;
    }

    if (item.toLowerCase().endsWith(".shp")) {
      results.push(fullPath);
    }
  }

  return results;
};

const extractZipIfNeeded = (asset: IDataAsset, userId: string) => {
  const extractDir =
    asset.extractedPath ||
    path.join(extractedRoot, userId, getAssetIdentifier(asset));

  const existingShpFiles = findShpFiles(extractDir);
  if (existingShpFiles.length > 0) {
    return {
      extractDir,
      shpFiles: existingShpFiles,
      extractedNow: false,
    };
  }

  ensureDirectory(extractDir);

  const zip = new AdmZip(path.resolve(asset.path));
  zip.extractAllTo(extractDir, true);

  const shpFiles = findShpFiles(extractDir);
  if (shpFiles.length === 0) {
    fs.rmSync(extractDir, { recursive: true, force: true });
    throw new Error("ZIP 中未找到 SHP 文件");
  }

  return {
    extractDir,
    shpFiles,
    extractedNow: true,
  };
};

const ensureShapefileStore = async (
  workspace: string,
  assetId: string,
  shpPath: string,
) => {
  const shpDir = path.dirname(shpPath);
  const shpName = path.basename(shpPath, ".shp");
  const storeName = buildStoreName(assetId, shpName);
  const hasShx = fs.existsSync(path.join(shpDir, `${shpName}.shx`));
  const hasDbf = fs.existsSync(path.join(shpDir, `${shpName}.dbf`));

  if (!hasShx || !hasDbf) {
    return null;
  }

  const datastoreExists = await gsClient.datastores.exists(workspace, storeName);
  if (!datastoreExists) {
    const gsDataDir = path.join(geoserverDataRoot, workspace, storeName);
    ensureDirectory(gsDataDir);

    const relatedExts = [".shp", ".shx", ".dbf", ".prj", ".cpg", ".sbn", ".sbx"];
    for (const ext of relatedExts) {
      const srcFile = path.join(shpDir, `${shpName}${ext}`);
      if (!fs.existsSync(srcFile)) {
        continue;
      }

      fs.copyFileSync(srcFile, path.join(gsDataDir, `${shpName}${ext}`));
    }

    const shpPathInGs = path.join(gsDataDir, `${shpName}.shp`).replace(/\\/g, "/");
    await gsClient.datastores.create(workspace, {
      name: storeName,
      url: `file://${shpPathInGs}`,
      charset: "UTF-8",
    });

    await gsClient.datastores.publish(workspace, storeName, shpName);
  }

  return {
    storeName,
    layerName: shpName,
    fullLayerName: `${workspace}:${shpName}`,
    resourceType: "datastore",
    bounds: await fetchGeoServerBounds(() =>
      gsClient.datastores.getBounds(workspace, storeName, shpName),
    ),
  };
};

export const uploadAssets = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "未上传文件" });
    }

    const userId = (req as any).user.id;
    const type = req.body.type;
    const newAsset = new DataAsset({
      userId,
      name: req.file.originalname,
      filename: req.file.filename,
      type,
      size: req.file.size,
      path: req.file.path,
    });

    await newAsset.save();
    res.status(200).json({ code: 200, message: "数据上传成功", data: newAsset });
  } catch (error) {
    res.status(500).json({ code: 500, message: "服务器存储数据失败" });
  }
};

export const getMyAssets = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const assets = await DataAsset.find({ userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ code: 200, message: "获取数据成功", data: assets });
  } catch (error) {
    res.status(500).json({ code: 500, message: "服务器获取数据失败" });
  }
};

export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userId = (req as any).user.id;

    if (!id) {
      return res.status(400).json({ code: 400, message: "缺少数据 ID" });
    }

    const targetAsset = await DataAsset.findById(id);
    if (!targetAsset || String(targetAsset.userId) !== String(userId)) {
      return res.status(404).json({ code: 404, message: "数据不存在" });
    }

    const filePath = path.resolve(targetAsset.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (targetAsset.extractedPath && fs.existsSync(targetAsset.extractedPath)) {
      fs.rmSync(targetAsset.extractedPath, { recursive: true, force: true });
    }

    await DataAsset.findByIdAndDelete(id);
    await db("user_features").where({ asset_id: id, user_id: userId }).del();

    res.json({ code: 200, message: "删除成功" });
  } catch (error) {
    res.status(500).json({ message: "服务器删除数据失败" });
  }
};

export const publishData = async (req: Request, res: Response) => {
  try {
    const userid = String((req as any).user.id);
    const filename = typeof req.body.filename === "string" ? req.body.filename : "";
    const assetId = typeof req.body.assetId === "string" ? req.body.assetId : "";

    if (!filename || !assetId) {
      return res.status(400).json({ code: 400, message: "缺少发布参数" });
    }

    const asset = await DataAsset.findById(assetId);
    if (!asset || String(asset.userId) !== userid) {
      return res.status(404).json({ code: 404, message: "数据不存在" });
    }

    const filePath = path.join(process.cwd(), "uploads", "data", userid, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ code: 404, message: "磁盘文件不存在" });
    }

    const fileExt = path.extname(filename).toLowerCase();
    const wsExists = await gsClient.workspaces.exists(userWorkspace);
    if (!wsExists) {
      await gsClient.workspaces.create(userWorkspace);
    }

    if (fileExt === ".tif" || fileExt === ".tiff") {
      const commonName = `tiff_${sanitizeName(assetId)}`;
      const absolutePath = path.resolve(filePath).replace(/\\/g, "/");

      try {
        await gsClient.coveragestores.create(userWorkspace, {
          name: commonName,
          type: "GeoTIFF",
          url: `file:///${absolutePath}`,
        });
      } catch (error: any) {
        if (error.response?.status !== 401 && error.response?.status !== 409) {
          throw error;
        }
      }

      try {
        await gsClient.coverages.publish(userWorkspace, commonName, {
          name: commonName,
        });
      } catch (error: any) {
        if (error.response?.status !== 401 && error.response?.status !== 409) {
          throw error;
        }
      }

      const bounds = await fetchGeoServerBounds(() =>
        gsClient.coverages.getBounds(userWorkspace, commonName, commonName),
      );

      return res.json({
        code: 200,
        message: "TIFF发布成功",
        storeName: commonName,
        layerName: commonName,
        resourceType: "coverage",
        cleanupGroup: "workspace",
        wmsUrl: `${geoserverUrl}/wms`,
        layers: `${userWorkspace}:${commonName}`,
        bounds,
      });
    }

    if (fileExt === ".json" || fileExt === ".geojson") {
      let rawData = fs.readFileSync(filePath, "utf-8");
      rawData = rawData.replace(/^\uFEFF/, "").trim();

      const geoJson = JSON.parse(rawData);
      const bounds = extractGeoJsonBounds(geoJson);
      const features = geoJson.features.map((f: any) => ({
        user_id: userid,
        asset_id: assetId,
        properties: JSON.stringify(f.properties),
        geom: db.raw(`ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)`, [
          JSON.stringify(f.geometry),
        ]),
      }));

      await db("user_features").where({ asset_id: assetId, user_id: userid }).del();

      if (features.length > 0) {
        await db("user_features").insert(features);
      }

      return res.json({
        code: 200,
        message: "矢量数据入库成功",
        resourceType: "sql_view",
        wmsUrl: `${geoserverUrl}/wms`,
        layers: `${userWorkspace}:user_features_sql_view`,
        viewparams: `aid:${assetId}`,
        bounds,
      });
    }

    if (fileExt === ".zip") {
      const { extractDir, shpFiles, extractedNow } = extractZipIfNeeded(asset, userid);

      if (extractedNow || asset.extractedPath !== extractDir) {
        asset.extractedPath = extractDir;
        await asset.save();
      }

      const results = [];

      for (const shpPath of shpFiles) {
        const result = await ensureShapefileStore(userWorkspace, assetId, shpPath);
        if (!result) {
          console.warn(`跳过不完整的 SHP: ${shpPath}`);
          continue;
        }

        results.push(result);
      }

      if (results.length === 0) {
        return res
          .status(400)
          .json({ code: 400, message: "ZIP 中的 SHP 文件均不完整" });
      }

      const mainResult = results[0]!;

      return res.json({
        code: 200,
        message: extractedNow ? "SHP 解压并发布成功" : "SHP 复用已解压数据成功",
        storeName: mainResult.storeName,
        layerName: mainResult.layerName,
        resourceType: mainResult.resourceType,
        cleanupGroup: "workspace",
        wmsUrl: `${geoserverUrl}/wms`,
        layers: mainResult.fullLayerName,
        layerType: "vector",
        format: "shp",
        allLayers: results.map((item) => ({
          name: item.layerName,
          layers: item.fullLayerName,
          storeName: item.storeName,
          resourceType: item.resourceType,
          bounds: item.bounds,
        })),
        bounds: mainResult.bounds,
      });
    }

    return res.status(400).json({ code: 400, message: "不支持的文件格式" });
  } catch (error: any) {
    console.error("Publish Error:", error);
    res.status(500).json({ code: 500, message: `发布失败: ${error.message}` });
  }
};

export const cleanupResources = async (req: Request, res: Response) => {
  const { workspace, resources } = req.body;

  const removeLocalStoreDir = (storeName: string, cleanupGroup?: string) => {
    const localStoreDir =
      cleanupGroup === "analysis"
        ? path.join(tempAnalysisRoot, storeName)
        : path.join(geoserverDataRoot, workspace, storeName);

    if (!fs.existsSync(localStoreDir)) {
      return;
    }

    try {
      fs.rmSync(localStoreDir, { recursive: true, force: true });
    } catch (error: any) {
      if (error?.code !== "EPERM" && error?.code !== "EBUSY") {
        throw error;
      }
      console.warn(`Skip removing busy temp directory: ${localStoreDir}`);
    }
  };

  for (const item of resources) {
    try {
      if (item.resourceType === "datastore") {
        await gsClient.datastores.delete(workspace, item.storeName);
        removeLocalStoreDir(item.storeName, item.cleanupGroup);
        continue;
      }

      if (item.resourceType === "coverage") {
        await gsClient.coveragestores.delete(workspace, item.storeName);
        removeLocalStoreDir(item.storeName, item.cleanupGroup);
        continue;
      }
    } catch (e: any) {
      console.error("--- GeoServer 清理详情 ---");
      if (e.response) {
        console.error("状态码:", e.response.status);
        console.error("错误响应体:", e.response.data);
      } else {
        console.error("错误消息:", e.message);
      }
      console.error("--------------------------");
    }
  }

  res.json({ code: 200, message: "清理指令执行完毕" });
};
