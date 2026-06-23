import multer from "multer";
import fs from "fs";
import path from "path";

const allowedExtensions = new Set([
  ".geojson",
  ".json",
  ".zip",
  ".shp",
  ".shx",
  ".dbf",
  ".prj",
  ".cpg",
  ".sbn",
  ".sbx",
  ".tif",
  ".tiff",
  ".glb",
  ".czml",
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const user = (req as any).user;
    if (!user || !user.id) {
      return cb(new Error("用户身份验证失败，无法创建目录"), "");
    }

    const uploadPath = `uploads/data/${user.id}`;

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

export const uploadData = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      cb(new Error("不支持的文件格式"));
      return;
    }

    cb(null, true);
  },
});
