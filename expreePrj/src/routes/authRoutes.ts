import { Router } from 'express';
import { uploadAvatar } from '../middleware/upload.js';
import { register,login } from '../controllers/authController.js';

const router:Router = Router();
router.post('/register',uploadAvatar.single('avatar'),register)
router.post('/login',login)


export default router;