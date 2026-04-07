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

async function prepareWorkspaceShapefile(asset: any, workspace: string) {
  const exists = await Gs_Client.client.workspaces.exists(workspace);
  if (!exists) {
    await Gs_Client.client.workspaces.create(workspace);
  }

  const findFirstShapefile = (dir: string, matcher?: (file: string) => boolean): string | null => {
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

  const extractedPath = typeof asset.extractedPath === "string" ? path.resolve(asset.extractedPath) : "";
  const workspaceDir = path.join(process.cwd(), "geoserver_data", workspace);
  const shapefile =
    (extractedPath && findFirstShapefile(extractedPath)) ||
    findFirstShapefile(workspaceDir, (file) => file.includes(asset._id.toString()));

  if (!shapefile) {
    throw new Error("The source SHP file could not be located for this asset.");
  }

  return shapefile;
}

async function runBufferTool1004(asset: any, params: Record<string, unknown>, workspace: string) {
  const radius = Number(params.radius);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Buffer radius must be greater than 0.");
  }

  const inputPath = path.resolve(await prepareWorkspaceShapefile(asset, workspace));
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
    throw new Error(`Python脚本不存在: ${pythonScript}`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const command = `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${geoJsonPath}" ${radius}`;

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
          new Error(`Python script did not report success.\nstdout: ${stdout}\nstderr: ${stderr}`),
        );
      },
    );
  });

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
