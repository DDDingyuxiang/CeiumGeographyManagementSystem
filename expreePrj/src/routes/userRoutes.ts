import { Router } from 'express';
import {
  getAiSettings,
  getUserProfile,
  updateAiSettings,
  updateUserProfile,
} from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';
import {
  cleanupResources,
  deleteAsset,
  getAssetFile,
  getMyAssets,
  publishData,
  saveCzmlAsset,
  uploadAssets,
} from '../controllers/dataController.js';
import { uploadData } from '../middleware/dataUpload.js';
import { uploadAvatar } from '../middleware/upload.js';

const router:Router = Router();

router.get('/profile',verifyToken,getUserProfile)
router.put('/profile',verifyToken,uploadAvatar.single('avatar'),updateUserProfile)
router.get('/ai-settings',verifyToken,getAiSettings)
router.put('/ai-settings',verifyToken,updateAiSettings)

router.post('/upload-data',verifyToken,uploadData.single('file'),uploadAssets);
router.get('/datasets',verifyToken,getMyAssets);
router.get('/assets/:id/file',verifyToken,getAssetFile);
router.post('/datasets/czml',verifyToken,saveCzmlAsset);
router.delete('/datasets/:id',verifyToken,deleteAsset);
router.post('/datasets/publish',verifyToken,publishData);
router.post('/datasets/cleanup',cleanupResources);



export default router;
