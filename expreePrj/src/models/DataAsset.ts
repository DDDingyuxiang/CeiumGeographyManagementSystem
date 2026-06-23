import { Document, model, Schema, Types } from "mongoose";

export interface IDataAsset extends Document {
  _id: Types.ObjectId;
  id?: string;
  userId: Types.ObjectId;
  name: string;      // 原始文件名
  filename: string;  // 存储在磁盘上的文件名（可能包含时间戳防止重名）
  type: string;      // 文件后缀或类型 (geojson, tif, zip等)
  size: number;      // 字节大小
  path: string;      // 相对路径
  extractedPath?: string;
  createdAt: Date;
}

const dataAssetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  filename: { type: String, required: true },
  type: { type: String },
  size: { type: Number },
  path: { type: String, required: true },
  extractedPath: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export  const DataAsset = model<IDataAsset>('DataAsset', dataAssetSchema);
