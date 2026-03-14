import { Schema, Document, model } from "mongoose";

export interface IUser extends Document {
	name: string;
	account: string; // 邮箱
	password: string;
	avatar?: string;
	dataAssets: string[];
	role: string;
	createdAt: Date;
}

const userSchema = new Schema<IUser>({
	name: { type: String, required: true },
	account: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	avatar: { type: String, default: "" },
	dataAssets: [{ type: String }],
	role: { type: String,enum: ['user', 'admin'], default: "用户" },
	createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>("User", userSchema);
