import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { Gs_Client } from "../config/geoserver.js";

const PYTHON_PATH = process.env.PYTHON_PATH || "python";
const geoserverDataRoot = path.join(process.cwd(), "geoserver_data");
const tempAnalysisRoot = path.join(geoserverDataRoot, "temp_analysis");
const pythonEnvRoot = path.dirname(PYTHON_PATH);
const projLibPath = path.join(pythonEnvRoot, "Library", "share", "proj");
const gdalDataPath = path.join(pythonEnvRoot, "Library", "share", "gdal");

export const dispatchTask = async (
  toolId: number,
  asset: any,
  params: Record<string, unknown>,
) => {
  const workspace = Gs_Client.workspace || "user_data_space";

  switch (toolId) {
    case 10004:
      return runBufferTool1004(asset, params, workspace);
    case 20006:
      return runHillshadeTool20006(asset, params, workspace);
    default:
      throw new Error(`Unsupported toolId: ${toolId}`);
  }
};

async function ensureWorkspace(workspace: string) {
  const exists = await Gs_Client.client.workspaces.exists(workspace);
  if (!exists) {
    await Gs_Client.client.workspaces.create(workspace);
  }
}

function getPythonEnv() {
  return {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    PROJ_LIB: fs.existsSync(projLibPath) ? projLibPath : process.env.PROJ_LIB,
    GDAL_DATA: fs.existsSync(gdalDataPath) ? gdalDataPath : process.env.GDAL_DATA,
  };
}

async function runPythonCommand(command: string) {
  await new Promise<void>((resolve, reject) => {
    exec(
      command,
      {
        env: getPythonEnv(),
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (stdout.includes("PYTHON_SUCCESS")) {
          resolve();
          return;
        }

        if (error) {
          reject(
            new Error(
              `Python execution failed: ${error.message}\nstdout: ${stdout}\nstderr: ${stderr}`,
            ),
          );
          return;
        }

        reject(
          new Error(
            `Python script did not report success.\nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
      },
    );
  });
}

async function prepareWorkspaceShapefile(asset: any, workspace: string) {
  await ensureWorkspace(workspace);

  const findFirstShapefile = (
    dir: string,
    matcher?: (file: string) => boolean,
  ): string | null => {
    if (!fs.existsSync(dir)) {
      return null;
    }

    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const nested = findFirstShapefile(fullPath, matcher);
        if (nested) {
          return nested;
        }
        continue;
      }

      if (name.toLowerCase().endsWith(".shp") && (!matcher || matcher(fullPath))) {
        return fullPath;
      }
    }

    return null;
  };

  const extractedPath =
    typeof asset.extractedPath === "string" ? path.resolve(asset.extractedPath) : "";
  const workspaceDir = path.join(process.cwd(), "geoserver_data", workspace);
  const shapefile =
    (extractedPath && findFirstShapefile(extractedPath)) ||
    findFirstShapefile(workspaceDir, (file) => file.includes(asset._id.toString()));

  if (!shapefile) {
    throw new Error("The source SHP file could not be located for this asset.");
  }

  return shapefile;
}

function prepareRasterInput(asset: any) {
  const inputPath = path.resolve(asset.path);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input raster not found: ${inputPath}`);
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== ".tif" && ext !== ".tiff") {
    throw new Error("当前山体阴影工具仅支持 TIFF 栅格数据。");
  }

  return inputPath;
}

async function runBufferTool1004(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  const radius = Number(params.radius);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Buffer radius must be greater than 0.");
  }

  const inputPath = path.resolve(await prepareWorkspaceShapefile(asset, workspace));
  const timestamp = Date.now();
  const storeName = `buf_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const outputBaseName = storeName;
  const geoJsonPath = path.join(outDir, `${outputBaseName}.geojson`);
  const shapefilePath = path.join(outDir, `${outputBaseName}.shp`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "runBuffer.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python脚本不存在: ${pythonScript}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const command = `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${geoJsonPath}" ${radius}`;
  await runPythonCommand(command);

  if (!fs.existsSync(geoJsonPath)) {
    throw new Error(`输出geojson文件不存在: ${geoJsonPath}`);
  }

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`输出shp文件不存在: ${shapefilePath}`);
  }

  await Gs_Client.client.datastores.create(workspace, {
    name: storeName,
    charset: "UTF-8",
    url: `file://${shapefilePath.replace(/\\/g, "/")}`,
  });

  await Gs_Client.client.datastores.publish(workspace, storeName, outputBaseName);

  return {
    layerName: `buffer_${radius}m`,
    wmsUrl: `${Gs_Client.baseUrl}/wms`,
    layers: `${workspace}:${outputBaseName}`,
    geoJsonPath,
    tempStoreName: storeName,
    storeName,
    resourceType: "datastore",
    cleanupGroup: "analysis",
  };
}

async function runHillshadeTool20006(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  await ensureWorkspace(workspace);

  const inputPath = prepareRasterInput(asset);
  const azimuth = Number(params.azimuth ?? 315);
  const altitude = Number(params.altitude ?? 45);
  const zFactor = Number(params.zFactor ?? 1);

  if (!Number.isFinite(azimuth) || azimuth < 0 || azimuth > 360) {
    throw new Error("太阳方位角必须在 0 到 360 之间。");
  }

  if (!Number.isFinite(altitude) || altitude <= 0 || altitude > 90) {
    throw new Error("太阳高度角必须在 0 到 90 之间。");
  }

  if (!Number.isFinite(zFactor) || zFactor <= 0) {
    throw new Error("高程倍率必须大于 0。");
  }

  const timestamp = Date.now();
  const storeName = `hillshade_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const outputPath = path.join(outDir, `${storeName}.tif`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "runHillshade.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python脚本不存在: ${pythonScript}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const command =
    `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${outputPath}" ` +
    `${azimuth} ${altitude} ${zFactor}`;
  await runPythonCommand(command);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`输出栅格文件不存在: ${outputPath}`);
  }

  await Gs_Client.client.coveragestores.create(workspace, {
    name: storeName,
    type: "GeoTIFF",
    url: `file:///${outputPath.replace(/\\/g, "/")}`,
  });

  await Gs_Client.client.coverages.publish(workspace, storeName, {
    name: storeName,
  });

  return {
    layerName: `${asset.name}_hillshade`,
    wmsUrl: `${Gs_Client.baseUrl}/wms`,
    layers: `${workspace}:${storeName}`,
    tempStoreName: storeName,
    storeName,
    resourceType: "coverage",
    cleanupGroup: "analysis",
  };
}
