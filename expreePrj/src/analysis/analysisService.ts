import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { Gs_Client } from "../config/geoserver.js";
import { DataAsset } from "../models/DataAsset.js";

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
    case 10003:
      return runSimplifyTool10003(asset, params, workspace);
    case 10004:
      return runBufferTool1004(asset, params, workspace);
    case 10005:
      return runOverlayTool10005(asset, params, workspace);
    case 10006:
      return runCentroidTool10006(asset, params, workspace);
    case 20004:
      return runSlopeAspectTool20004(asset, params, workspace);
    case 20005:
      return runContourTool20005(asset, params, workspace);
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

function getAnalysisPythonScript(scriptName: string) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", scriptName);

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python script not found: ${pythonScript}`);
  }

  return pythonScript;
}

function readBounds(metaPath: string): [number, number, number, number] | undefined {
  if (!fs.existsSync(metaPath)) {
    return undefined;
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  if (
    Array.isArray(meta.bounds) &&
    meta.bounds.length === 4 &&
    meta.bounds.every((value: unknown) => Number.isFinite(value))
  ) {
    return meta.bounds as [number, number, number, number];
  }

  return undefined;
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

async function publishCoverageStore(
  workspace: string,
  storeName: string,
  outputPath: string,
) {
  await Gs_Client.client.coveragestores.create(workspace, {
    name: storeName,
    type: "GeoTIFF",
    url: `file:///${outputPath.replace(/\\/g, "/")}`,
  });

  await Gs_Client.client.coverages.publish(workspace, storeName, {
    name: storeName,
  });

  return {
    wmsUrl: `${Gs_Client.baseUrl}/wms`,
    layers: `${workspace}:${storeName}`,
    tempStoreName: storeName,
    storeName,
    resourceType: "coverage",
    cleanupGroup: "analysis",
  };
}

async function publishDatastore(
  workspace: string,
  storeName: string,
  featureName: string,
  shapefilePath: string,
) {
  await Gs_Client.client.datastores.create(workspace, {
    name: storeName,
    charset: "UTF-8",
    url: `file://${shapefilePath.replace(/\\/g, "/")}`,
  });

  await Gs_Client.client.datastores.publish(workspace, storeName, featureName);

  return {
    wmsUrl: `${Gs_Client.baseUrl}/wms`,
    layers: `${workspace}:${featureName}`,
    tempStoreName: storeName,
    storeName,
    resourceType: "datastore",
    cleanupGroup: "analysis",
  };
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

  return {
    layerName: `buffer_${radius}m`,
    geoJsonPath,
    ...(await publishDatastore(workspace, storeName, outputBaseName, shapefilePath)),
  };
}

async function runSimplifyTool10003(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  const tolerance = Number(params.tolerance ?? 10);
  const preserveTopology = params.preserveTopology !== false;

  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error("Simplify tolerance must be greater than 0.");
  }

  const inputPath = path.resolve(await prepareWorkspaceShapefile(asset, workspace));
  const timestamp = Date.now();
  const storeName = `simp_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const featureName = storeName;
  const geoJsonPath = path.join(outDir, `${featureName}.geojson`);
  const shapefilePath = path.join(outDir, `${featureName}.shp`);
  const metaPath = path.join(outDir, `${featureName}.meta.json`);
  const pythonScript = getAnalysisPythonScript("runSimplify.py");

  fs.mkdirSync(outDir, { recursive: true });

  const command =
    `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${geoJsonPath}" ` +
    `${tolerance} ${preserveTopology ? "true" : "false"}`;
  await runPythonCommand(command);

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Output shapefile not found: ${shapefilePath}`);
  }

  return {
    layerName: `${asset.name}_simplified`,
    geoJsonPath,
    geoJsonUrl: `/temp-analysis/${storeName}/${featureName}.geojson`,
    bounds: readBounds(metaPath),
    ...(await publishDatastore(workspace, storeName, featureName, shapefilePath)),
  };
}

async function runOverlayTool10005(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  const overlayAssetId = String(params.overlayAssetId ?? "");
  const userId = asset.userId;
  const operation = String(params.operation ?? "intersection").toLowerCase();
  const operationLabels: Record<string, string> = {
    intersection: "intersection",
    union: "union",
    difference: "erase",
  };

  if (!overlayAssetId) {
    throw new Error("Overlay layer is required.");
  }

  if (!Object.keys(operationLabels).includes(operation)) {
    throw new Error("Overlay operation must be intersection, union, or difference.");
  }

  const overlayAsset = await DataAsset.findOne({ _id: overlayAssetId, userId } as any);
  if (!overlayAsset) {
    throw new Error("Overlay layer does not exist or is not accessible.");
  }

  const inputPath = path.resolve(await prepareWorkspaceShapefile(asset, workspace));
  const overlayPath = path.resolve(await prepareWorkspaceShapefile(overlayAsset, workspace));
  const timestamp = Date.now();
  const storeName = `ovl_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const featureName = storeName;
  const geoJsonPath = path.join(outDir, `${featureName}.geojson`);
  const shapefilePath = path.join(outDir, `${featureName}.shp`);
  const metaPath = path.join(outDir, `${featureName}.meta.json`);
  const pythonScript = getAnalysisPythonScript("runOverlay.py");

  fs.mkdirSync(outDir, { recursive: true });

  const command =
    `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${overlayPath}" ` +
    `"${geoJsonPath}" ${operation}`;
  await runPythonCommand(command);

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Output shapefile not found: ${shapefilePath}`);
  }

  return {
    layerName: `${asset.name}_${operationLabels[operation]}`,
    geoJsonPath,
    geoJsonUrl: `/temp-analysis/${storeName}/${featureName}.geojson`,
    bounds: readBounds(metaPath),
    ...(await publishDatastore(workspace, storeName, featureName, shapefilePath)),
  };
}

async function runCentroidTool10006(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  const mode = String(params.mode ?? "centroid").toLowerCase();

  if (!["centroid", "representative_point"].includes(mode)) {
    throw new Error("Centroid mode must be centroid or representative_point.");
  }

  const inputPath = path.resolve(await prepareWorkspaceShapefile(asset, workspace));
  const timestamp = Date.now();
  const storeName = `cent_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const featureName = storeName;
  const geoJsonPath = path.join(outDir, `${featureName}.geojson`);
  const shapefilePath = path.join(outDir, `${featureName}.shp`);
  const metaPath = path.join(outDir, `${featureName}.meta.json`);
  const pythonScript = getAnalysisPythonScript("runCentroid.py");

  fs.mkdirSync(outDir, { recursive: true });

  const command = `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${geoJsonPath}" ${mode}`;
  await runPythonCommand(command);

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Output shapefile not found: ${shapefilePath}`);
  }

  return {
    layerName: `${asset.name}_centroid`,
    geoJsonPath,
    geoJsonUrl: `/temp-analysis/${storeName}/${featureName}.geojson`,
    bounds: readBounds(metaPath),
    ...(await publishDatastore(workspace, storeName, featureName, shapefilePath)),
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

  return {
    layerName: `${asset.name}_hillshade`,
    ...(await publishCoverageStore(workspace, storeName, outputPath)),
  };
}

async function runSlopeAspectTool20004(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  await ensureWorkspace(workspace);

  const inputPath = prepareRasterInput(asset);
  const analysisType = String(params.analysisType ?? "slope").toLowerCase();
  const zFactor = Number(params.zFactor ?? 1);
  const scale = Number(params.scale ?? 1);

  if (!["slope", "aspect"].includes(analysisType)) {
    throw new Error("analysisType must be either slope or aspect.");
  }

  if (!Number.isFinite(zFactor) || zFactor <= 0) {
    throw new Error("zFactor must be greater than 0.");
  }

  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("scale must be greater than 0.");
  }

  const timestamp = Date.now();
  const suffix = analysisType === "aspect" ? "aspect" : "slope";
  const storeName = `${suffix}_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const outputPath = path.join(outDir, `${storeName}.tif`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "runSlopeAspect.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python script not found: ${pythonScript}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const command =
    `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${outputPath}" ` +
    `${analysisType} ${zFactor} ${scale}`;
  await runPythonCommand(command);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Output raster file not found: ${outputPath}`);
  }

  return {
    layerName: `${asset.name}_${suffix}`,
    ...(await publishCoverageStore(workspace, storeName, outputPath)),
  };
}

async function runContourTool20005(
  asset: any,
  params: Record<string, unknown>,
  workspace: string,
) {
  await ensureWorkspace(workspace);

  const inputPath = prepareRasterInput(asset);
  const interval = Number(params.interval ?? 10);
  const base = Number(params.base ?? 0);

  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error("Contour interval must be greater than 0.");
  }

  if (!Number.isFinite(base)) {
    throw new Error("Contour base must be a valid number.");
  }

  const timestamp = Date.now();
  const storeName = `contour_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(tempAnalysisRoot, storeName);
  const featureName = storeName;
  const shapefilePath = path.join(outDir, `${featureName}.shp`);
  const geoJsonPath = path.join(outDir, `${featureName}.geojson`);
  const metaPath = path.join(outDir, `${featureName}.meta.json`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "runContour.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Python script not found: ${pythonScript}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const command =
    `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${shapefilePath}" ` +
    `"${geoJsonPath}" ${interval} ${base}`;
  await runPythonCommand(command);

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Output shapefile not found: ${shapefilePath}`);
  }

  let bounds: [number, number, number, number] | undefined;
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    if (
      Array.isArray(meta.bounds) &&
      meta.bounds.length === 4 &&
      meta.bounds.every((value: unknown) => Number.isFinite(value))
    ) {
      bounds = meta.bounds as [number, number, number, number];
    }
  }

  return {
    layerName: `${asset.name}_contour`,
    geoJsonPath,
    geoJsonUrl: `/temp-analysis/${storeName}/${featureName}.geojson`,
    bounds,
    ...(await publishDatastore(workspace, storeName, featureName, shapefilePath)),
  };
}
