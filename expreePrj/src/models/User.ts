import { Schema, Document, model } from "mongoose";

export interface IUser extends Document {
  name: string;
  account: string;
  password: string;
  avatar?: string;
  dataAssets: string[];
  role: string;
  aiSettings?: {
    provider?: string;
    baseUrl?: string;
    modelName?: string;
    apiKey?: string;
  };
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  account: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  dataAssets: [{ type: String }],
  role: { type: String, enum: ["user", "admin"], default: "user" },
  aiSettings: {
    provider: { type: String, default: "openai-compatible" },
    baseUrl: { type: String, default: "" },
    modelName: { type: String, default: "" },
    apiKey: { type: String, default: "" },
  },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>("User", userSchema);
