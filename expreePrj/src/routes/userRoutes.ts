import { Router } from 'express';
import { getUserProfile } from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadAssets,getMyAssets ,deleteAsset,publishData,cleanupResources} from '../controllers/dataController.js';
import { uploadData } from '../middleware/dataUpload.js';

const router:Router = Router();

router.get('/profile',verifyToken,getUserProfile)

router.post('/upload-data',verifyToken,uploadData.single('file'),uploadAssets);
router.get('/datasets',verifyToken,getMyAssets);
router.delete('/datasets/:id',verifyToken,deleteAsset);
router.post('/datasets/publish',verifyToken,publishData);
router.post('/datasets/cleanup',cleanupResources);



export default router;