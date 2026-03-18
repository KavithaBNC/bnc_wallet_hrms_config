import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { faceController } from '../controllers/face.controller';

const router = Router();
router.use(authenticate);

/**
 * @route   GET /api/v1/face/health
 * @desc    Check if Python face service is reachable
 * @access  Private
 */
router.get('/health', (req, res, next) => faceController.health(req, res, next));

/**
 * @route   POST /api/v1/face/encode
 * @desc    Encode face from base64 image (calls Python service)
 * @access  Private
 */
router.post('/encode', (req, res, next) => {
  const body = req.body as { image_base64?: string };
  if (!body || typeof body.image_base64 !== 'string') {
    return res.status(400).json({
      status: 'fail',
      message: 'image_base64 is required (base64 string)',
    });
  }
  return faceController.encode(req, res, next);
});

export default router;
