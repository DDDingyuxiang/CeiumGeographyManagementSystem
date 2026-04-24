import fs from "fs";
import path from "path";
import { Gs_Client } from "../config/geoserver.js";

const extractedRoot = path.join(process.cwd(), "uploads", "extracted");
const geoserverDataRoot = path.join(process.cwd(), "geoserver_data");
const userWorkspace = Gs_Client.workspace || "user_data_space";
const userWorkspaceRoot = path.join(geoserverDataRoot, userWorkspace);
const tempAnalysisRoot = path.join(geoserverDataRoot, "temp_analysis");

const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
const jobIntervalMs = 12 * 60 * 60 * 1000;

const removeDirectoryQuietly = (targetPath: string) => {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error: any) {
    if (error?.code !== "EPERM" && error?.code !== "EBUSY") {
      throw error;
    }
    console.warn(`Skip removing busy cache directory: ${targetPath}`);
  }
};

const inferTempAnalysisResourceType = (storeName: string) => {
  if (
    storeName.startsWith("hillshade_") ||
    storeName.startsWith("slope_") ||
    storeName.startsWith("aspect_")
  ) {
    return "coverage";
  }

  return "datastore";
};

const removeExpiredDirectories = (dir: string, now: number) => {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (!stat.isDirectory()) {
      continue;
    }

    if (now - stat.mtimeMs > threeDaysMs) {
      removeDirectoryQuietly(fullPath);
      continue;
    }

    removeExpiredDirectories(fullPath, now);

    if (fs.existsSync(fullPath) && fs.readdirSync(fullPath).length === 0) {
      removeDirectoryQuietly(fullPath);
    }
  }
};

const removeExpiredGeoServerCaches = async (
  rootDir: string,
  now: number,
  onExpired: (dirname: string) => Promise<void>,
) => {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  for (const entry of fs.readdirSync(rootDir)) {
    const fullPath = path.join(rootDir, entry);
    const stat = fs.statSync(fullPath);

    if (!stat.isDirectory()) {
      continue;
    }

    if (now - stat.mtimeMs <= threeDaysMs) {
      continue;
    }

    try {
      await onExpired(entry);
    } catch (error) {
      console.error(`Failed to clean GeoServer resource ${entry}:`, error);
    }

    removeDirectoryQuietly(fullPath);
  }
};

export const cleanupExtractedFiles = async () => {
  const now = Date.now();

  try {
    removeExpiredDirectories(extractedRoot, now);
  } catch (error) {
    console.error("清理解压缓存失败:", error);
  }

  try {
    await removeExpiredGeoServerCaches(userWorkspaceRoot, now, async (storeName) => {
      await Gs_Client.client.datastores.delete(userWorkspace, storeName);
    });
  } catch (error) {
    console.error("清理 user_data_space 缓存失败:", error);
  }

  try {
    await removeExpiredGeoServerCaches(tempAnalysisRoot, now, async (storeName) => {
      if (inferTempAnalysisResourceType(storeName) === "coverage") {
        await Gs_Client.client.coveragestores.delete(userWorkspace, storeName);
        return;
      }

      await Gs_Client.client.datastores.delete(userWorkspace, storeName);
    });
  } catch (error) {
    console.error("清理 temp_analysis 缓存失败:", error);
  }
};

export const startExtractedFilesCleanupJob = () => {
  void cleanupExtractedFiles();
  setInterval(() => {
    void cleanupExtractedFiles();
  }, jobIntervalMs);
};
