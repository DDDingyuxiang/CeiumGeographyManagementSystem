import fs from "fs";
import path from "path";

const extractedRoot = path.join(process.cwd(), "uploads", "extracted");
const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
const jobIntervalMs = 12 * 60 * 60 * 1000;

const removeExpiredDirectories = (dir: string, now: number) => {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (now - stat.mtimeMs > threeDaysMs) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        continue;
      }

      removeExpiredDirectories(fullPath, now);

      if (fs.existsSync(fullPath) && fs.readdirSync(fullPath).length === 0) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }
};

export const cleanupExtractedFiles = () => {
  try {
    removeExpiredDirectories(extractedRoot, Date.now());
  } catch (error) {
    console.error("清理解压缓存失败:", error);
  }
};

export const startExtractedFilesCleanupJob = () => {
  cleanupExtractedFiles();
  setInterval(cleanupExtractedFiles, jobIntervalMs);
};
