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
  const workspace = "user_data_space";
  const tempDir = path.join(
    process.cwd(),
    "geoserver_data",
    "temp_analysis",
    asset._id.toString(),
  );

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  switch (toolId) {
    case 10004:
      return runBufferTool1004(asset, params, tempDir, workspace);
    default:
      throw new Error(`不支持的 toolId: ${toolId}`);
  }
};

function findAssetShapefile(assetId: string) {
  const assetDir = path.join(
    process.cwd(),
    "geoserver_data",
    "user_data_space",
    assetId,
  );

  if (!fs.existsSync(assetDir)) {
    throw new Error("未找到已发布的矢量数据目录，请先将数据拖入地图完成发布");
  }

  const shpFiles = fs
    .readdirSync(assetDir)
    .filter((file) => file.toLowerCase().endsWith(".shp"));

  if (shpFiles.length === 0) {
    throw new Error("当前缓冲区分析仅支持已发布的 SHP 矢量图层");
  }

  return path.join(assetDir, shpFiles[0]!);
}

function runPythonBuffer(
  pythonScript: string,
  inputPath: string,
  outputPath: string,
  radius: number,
) {
  return new Promise<void>((resolve, reject) => {
    const command = `"${PYTHON_PATH}" -u "${pythonScript}" "${inputPath}" "${outputPath}" ${radius}`;
    console.log("执行缓冲区命令:", command);

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
        console.log("Python stdout:", stdout);
        if (stderr) {
          console.warn("Python stderr:", stderr);
        }

        if (stdout.includes("PYTHON_SUCCESS")) {
          resolve();
          return;
        }

        if (error) {
          reject(
            new Error(
              `Python 执行失败: ${error.message}\nstdout: ${stdout}\nstderr: ${stderr}`,
            ),
          );
          return;
        }

        reject(
          new Error(`Python 脚本未报告成功标记\nstdout: ${stdout}\nstderr: ${stderr}`),
        );
      },
    );
  });
}

async function runBufferTool1004(
  asset: any,
  params: Record<string, unknown>,
  outDir: string,
  workspace: string,
) {
  const radius = Number(params.radius);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("缓冲区距离必须是大于 0 的数字");
  }

  const inputPath = path.resolve(findAssetShapefile(asset._id.toString()));
  const timestamp = Date.now();
  const outputBaseName = `buffer_${asset._id.toString().slice(-6)}_${timestamp}`;
  const outputPath = path.join(outDir, `${outputBaseName}.shp`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pythonScript = path.join(__dirname, "python", "runBuffer.py");

  if (!fs.existsSync(pythonScript)) {
    throw new Error(`未找到缓冲区脚本: ${pythonScript}`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`未找到输入 SHP 文件: ${inputPath}`);
  }

  await runPythonBuffer(pythonScript, inputPath, outputPath, radius);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`缓冲区结果未生成: ${outputPath}`);
  }

  const storeName = `buf_${asset._id.toString().slice(-5)}_${timestamp}`;

  await Gs_Client.client.datastores.create(workspace, {
    name: storeName,
    charset: "UTF-8",
    url: `file://${outputPath.replace(/\\/g, "/")}`,
  });

  await Gs_Client.client.datastores.publish(
    workspace,
    storeName,
    outputBaseName,
  );

  return {
    layerName: `缓冲区 ${radius}m`,
    wmsUrl: `${Gs_Client.baseUrl}/wms`,
    layers: `${workspace}:${outputBaseName}`,
    tempStoreName: storeName,
  };
}
