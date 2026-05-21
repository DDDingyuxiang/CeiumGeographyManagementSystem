import { Request, Response } from "express";
import { DataAsset } from "../models/DataAsset.js";
import { User } from "../models/User.js";
import { createAiAnalysisPlan, type AiPlanningLayerInput } from "../ai/aiPlanningService.js";

export const handleCreateAnalysisPlan = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const requestedLayers = Array.isArray(req.body?.layers) ? req.body.layers : [];

    if (!prompt) {
      return res.status(400).json({
        code: 400,
        message: "请输入 AI 分析需求。",
      });
    }

    const [user, assets] = await Promise.all([
      User.findById(userId).select("aiSettings"),
      DataAsset.find({ userId }).sort({ createdAt: -1 }),
    ]);

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "用户不存在。",
      });
    }

    const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));
    const safeRequestedLayers: AiPlanningLayerInput[] = requestedLayers
      .filter((layer: unknown): layer is AiPlanningLayerInput => {
        if (!layer || typeof layer !== "object") {
          return false;
        }

        const value = layer as Record<string, unknown>;
        return (
          typeof value.assetId === "string" &&
          typeof value.name === "string" &&
          typeof value.type === "string" &&
          assetById.has(value.assetId)
        );
      })
      .map((layer: AiPlanningLayerInput) => ({
        assetId: layer.assetId,
        name: layer.name,
        type: layer.type,
      }));

    const layers: AiPlanningLayerInput[] = safeRequestedLayers.length
      ? safeRequestedLayers
      : assets.map((asset) => ({
          assetId: String(asset._id),
          name: asset.name,
          type: asset.type,
        }));

    if (layers.length === 0) {
      return res.json({
        code: 200,
        message: "AI 分析计划已生成。",
        data: {
          summary: "",
          needsClarification: true,
          clarificationQuestion: "请先上传并发布至少一个可用于分析的数据图层。",
          steps: [],
          warnings: ["当前账号没有可用数据图层。"],
          layers,
        },
      });
    }

    const plan = await createAiAnalysisPlan(prompt, layers, user.aiSettings ?? {});

    return res.json({
      code: 200,
      message: "AI 分析计划已生成。",
      data: {
        ...plan,
        layers,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI 分析计划生成失败。";
    console.error(message);
    return res.status(500).json({
      code: 500,
      message,
    });
  }
};
