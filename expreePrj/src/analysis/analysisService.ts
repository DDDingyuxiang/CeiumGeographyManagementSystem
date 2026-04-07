import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { Gs_Client } from "../config/geoserver.js";

const PYTHON_PATH = process.env.PYTHON_PATH || "python";

export const dispatchTask = async (
  toolId: number,
  asset: any,
  params: Record<string, unknown>,
) => {
  const workspace = Gs_Client.workspace || "user_data_space";

  switch (toolId) {
    case 10004:
      return runBufferTool1004(asset, params, workspace);
    default:
      throw new Error(`Unsupported toolId: ${toolId}`);
  }
};

function findShapefilesRecursively(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const matches: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      matches.push(...findShapefilesRecursively(fullPath));
      continue;
    }

    if (name.toLowerCase().endsWith(".shp")) {
      matches.push(fullPath);
    }
  }

  return matches;
}

function findAssetShapefile(asset: any) {
  const extractedPath = typeof asset.extractedPath === "string" ? asset.extractedPath : "";
  const extractedShpFiles = extractedPath
    ? findShapefilesRecursively(path.resolve(extractedPath))
    : [];

  if (extractedShpFiles.length > 0) {
    return extractedShpFiles[0]!;
  }

  const workspaceDir = path.join(
    process.cwd(),
    "geoserver_data",
    Gs_Client.workspace || "user_data_space",
  );

  const workspaceShpFiles = findShapefilesRecursively(workspaceDir).filter((file) =>
    file.includes(asset._id.toString()),
  );

  if (workspaceShpFiles.length > 0) {
    return workspaceShpFiles[0]!;
  }

  throw new Error("The source SHP file could not be located for this asset.");
}

function runPythonBuffer(
  pythonScript: string,
  inputPath: string,
  outputGeoJsonPath: string,
  radius: number,
) {
  return new Promise<void>((resolve, reject) => {
    const command = `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${outputGeoJsonPath}" ${radius}`;

    exec(
      command,
      {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
        timeout: 300000,
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

async function ensureWorkspace(workspace: string) {
  const exists = await Gs_Client.client.workspaces.exists(workspace);
  if (!exists) {
    await Gs_Client.client.workspaces.create(workspace);
  }
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

  const inputPath = path.resolve(findAssetShapefile(asset));
  const timestamp = Date.now();
  const storeName = `buf_${asset._id.toString().slice(-5)}_${timestamp}`;
  const outDir = path.join(process.cwd(), "geoserver_data", "temp_analysis", storeName);
  const outputBaseName = storeName;
  const geoJsonPath = path.join(outDir, `${outputBaseName}.geojson`);
  const shapefilePath = path.join(outDir, `${outputBaseName}.shp`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "runBuffer.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`Buffer script not found: ${pythonScript}`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input SHP file not found: ${inputPath}`);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await ensureWorkspace(workspace);
  await runPythonBuffer(pythonScript, inputPath, geoJsonPath, radius);

  if (!fs.existsSync(geoJsonPath)) {
    throw new Error(`Buffer GeoJSON was not generated: ${geoJsonPath}`);
  }

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Buffer SHP was not generated: ${shapefilePath}`);
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
