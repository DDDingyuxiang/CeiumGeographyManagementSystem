import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import type { IDataAsset } from "../models/DataAsset.js";

const PYTHON_PATH = process.env.PYTHON_PATH || "python";
const terrainUploadsRoot = path.join(process.cwd(), "uploads");
const pythonEnvRoot = path.dirname(PYTHON_PATH);
const projLibPath = path.join(pythonEnvRoot, "Library", "share", "proj");
const gdalDataPath = path.join(pythonEnvRoot, "Library", "share", "gdal");

const sanitizeSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "terrain";

export interface TerrainGenerationResult {
  generated: boolean;
  terrainDir?: string;
  relativeTerrainPath?: string;
  storeName?: string;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
  message?: string;
}

export const generateTerrainFromDem = async (
  asset: IDataAsset,
  assetId: string,
  inputPath: string,
): Promise<TerrainGenerationResult> => {
  const relativeTerrainPath = path
    .join("terrain", sanitizeSegment(String(asset.userId)), sanitizeSegment(assetId))
    .replace(/\\/g, "/");
  const outputDir = path.join(terrainUploadsRoot, relativeTerrainPath);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "demToTerrain.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python脚本不存在: ${pythonScript}`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  const stdout = await new Promise<string>((resolve, reject) => {
    const sourceName = (asset.name || "").replace(/"/g, '\\"');
    const command = `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${outputDir}" "${sourceName}"`;

    exec(
      command,
      {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
          PROJ_LIB: fs.existsSync(projLibPath) ? projLibPath : process.env.PROJ_LIB,
          GDAL_DATA: fs.existsSync(gdalDataPath) ? gdalDataPath : process.env.GDAL_DATA,
        },
        timeout: 15 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, commandStdout, stderr) => {
        if (commandStdout.includes("PYTHON_NOT_DEM")) {
          resolve(commandStdout);
          return;
        }

        if (error) {
          reject(
            new Error(
              `Python terrain conversion failed: ${error.message}\nstdout: ${commandStdout}\nstderr: ${stderr}`,
            ),
          );
          return;
        }

        if (!commandStdout.includes("PYTHON_SUCCESS")) {
          reject(
            new Error(
              `Python terrain conversion did not report success.\nstdout: ${commandStdout}\nstderr: ${stderr}`,
            ),
          );
          return;
        }

        resolve(commandStdout);
      },
    );
  });

  if (stdout.includes("PYTHON_NOT_DEM")) {
    fs.rmSync(outputDir, { recursive: true, force: true });
    return {
      generated: false,
      message: stdout.trim(),
    };
  }

  const metadataPath = path.join(outputDir, "metadata.json");
  const layerJsonPath = path.join(outputDir, "layer.json");

  if (!fs.existsSync(layerJsonPath)) {
    throw new Error(`Terrain输出缺少 layer.json: ${layerJsonPath}`);
  }

  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Terrain输出缺少 metadata.json: ${metadataPath}`);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  return {
    generated: true,
    terrainDir: outputDir,
    relativeTerrainPath,
    storeName: relativeTerrainPath,
    bounds: metadata.bounds,
    minzoom: metadata.minzoom,
    maxzoom: metadata.maxzoom,
  };
};
