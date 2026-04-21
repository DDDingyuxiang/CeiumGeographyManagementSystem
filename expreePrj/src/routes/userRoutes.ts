import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadAssets,getMyAssets ,deleteAsset,publishData,cleanupResources} from '../controllers/dataController.js';
import { uploadData } from '../middleware/dataUpload.js';
import { uploadAvatar } from '../middleware/upload.js';

const router:Router = Router();

router.get('/profile',verifyToken,getUserProfile)
router.put('/profile',verifyToken,uploadAvatar.single('avatar'),updateUserProfile)

router.post('/upload-data',verifyToken,uploadData.single('file'),uploadAssets);
router.get('/datasets',verifyToken,getMyAssets);
router.delete('/datasets/:id',verifyToken,deleteAsset);
router.post('/datasets/publish',verifyToken,publishData);
router.post('/datasets/cleanup',cleanupResources);



export default router;
