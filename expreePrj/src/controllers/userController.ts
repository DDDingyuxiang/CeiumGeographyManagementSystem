import { User } from "../models/User.js";
import { Request, Response } from "express";
import bcrypt from "bcryptjs/index.js";

const maskApiKey = (apiKey?: string) => {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    res.status(200).json({
      code: 200,
      message: "User fetched successfully",
      data: user,
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ code: 500, message: "Failed to fetch user", err: err.message });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    res.status(200).json({
      code: 200,
      message: "Profile fetched successfully",
      data: {
        name: user.name,
        account: user.account,
        avatar: user.avatar,
        role: user.role === "admin" ? "admin" : "user",
        createdAt: user.createdAt,
        dataAssets: [],
      },
    });
  } catch (err: any) {
    res.status(500).json({
      code: 500,
      message: "Failed to fetch profile",
      err: err.message,
    });
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, currentPassword, newPassword, confirmPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ code: 400, message: "Name is required" });
    }

    user.name = trimmedName;

    if (req.file) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const wantsPasswordUpdate = Boolean(
      currentPassword || newPassword || confirmPassword,
    );

    if (wantsPasswordUpdate) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          code: 400,
          message: "Password fields are incomplete",
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          code: 400,
          message: "Current password is incorrect",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          code: 400,
          message: "New password must be at least 6 characters",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          code: 400,
          message: "New passwords do not match",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return res.status(200).json({
      code: 200,
      message: "Profile updated successfully",
      data: {
        name: user.name,
        account: user.account,
        avatar: user.avatar,
        role: user.role === "admin" ? "admin" : "user",
        createdAt: user.createdAt,
        dataAssets: [],
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      message: "Failed to update profile",
      err: err.message,
    });
  }
};

export const getAiSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).select("aiSettings");

    if (!user) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    const settings = user.aiSettings ?? {};

    return res.status(200).json({
      code: 200,
      message: "AI settings fetched successfully",
      data: {
        provider: settings.provider ?? "openai-compatible",
        baseUrl: settings.baseUrl ?? "",
        modelName: settings.modelName ?? "",
        hasApiKey: Boolean(settings.apiKey),
        maskedApiKey: maskApiKey(settings.apiKey),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      message: "Failed to fetch AI settings",
      err: err.message,
    });
  }
};

export const updateAiSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { provider, baseUrl, modelName, apiKey, clearApiKey } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    const trimmedProvider =
      typeof provider === "string" && provider.trim()
        ? provider.trim()
        : "openai-compatible";
    const trimmedBaseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";
    const trimmedModelName = typeof modelName === "string" ? modelName.trim() : "";
    const trimmedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";

    if (!trimmedModelName) {
      return res.status(400).json({
        code: 400,
        message: "Model name is required",
      });
    }

    if (trimmedBaseUrl && !/^https?:\/\//.test(trimmedBaseUrl)) {
      return res.status(400).json({
        code: 400,
        message: "Base URL must start with http:// or https://",
      });
    }

    const currentSettings = user.aiSettings ?? {};
    const nextApiKey = clearApiKey
      ? ""
      : trimmedApiKey || currentSettings.apiKey || "";

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "aiSettings.provider": trimmedProvider,
          "aiSettings.baseUrl": trimmedBaseUrl,
          "aiSettings.modelName": trimmedModelName,
          "aiSettings.apiKey": nextApiKey,
        },
      },
      { new: true },
    ).select("aiSettings");

    if (!updatedUser) {
      return res.status(404).json({ code: 404, message: "User not found" });
    }

    const updatedSettings = updatedUser.aiSettings ?? {};

    return res.status(200).json({
      code: 200,
      message: "AI settings updated successfully",
      data: {
        provider: updatedSettings.provider ?? "openai-compatible",
        baseUrl: updatedSettings.baseUrl ?? "",
        modelName: updatedSettings.modelName ?? "",
        hasApiKey: Boolean(updatedSettings.apiKey),
        maskedApiKey: maskApiKey(updatedSettings.apiKey),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      message: "Failed to update AI settings",
      err: err.message,
    });
  }
};
