import { Router } from 'express';
import { getUserProfile } from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadAssets,getMyAssets ,deleteAsset} from '../controllers/dataController.js';
import { uploadData } from '../middleware/dataUpload.js';

const router:Router = Router();

router.get('/profile',verifyToken,getUserProfile)

router.post('/upload-data',verifyToken,uploadData.single('file'),uploadAssets);
router.get('/datasets',verifyToken,getMyAssets);
router.delete('/datasets/:id',verifyToken,deleteAsset);

export default router;