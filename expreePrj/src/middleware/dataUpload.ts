import multer from 'multer';
import fs from 'fs';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 增加安全检查
        const user = (req as any).user;
        if (!user || !user.id) {
            return cb(new Error('用户身份验证失败，无法创建目录'), '');
        }

        const userID = user.id;
        const uploadPath = `uploads/data/${userID}`;

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename:(req,file,cb)=>{
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

export const uploadData = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB 限制
});