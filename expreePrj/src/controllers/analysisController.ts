import { Request, Response } from "express";
import { DataAsset } from "../models/DataAsset.js";
import { dispatchTask } from "../analysis/analysisService.js";

export const handleAnalysisTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { toolId, assetId, params } = req.body;

    const asset = await DataAsset.findOne({ _id: assetId, userId });

    if (!asset) {
      return res.status(403).json({
        code: 403,
        message: "无权访问该数据，或数据不存在",
      });
    }

    const result = await dispatchTask(Number(toolId), asset, params ?? {});

    return res.json({
      code: 200,
      message: "分析任务处理成功",
      data: result,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      code: 500,
      message: `分析任务处理失败: ${err.message}`,
    });
  }
};
