import { Request, Response, NextFunction } from 'express';
import { generateEncoding, checkFaceServiceHealth } from '../services/face.service';

export class FaceController {
  /**
   * GET /api/v1/face/health
   * Check if the Python face microservice is reachable.
   */
  async health(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await checkFaceServiceHealth();
      return res.status(200).json({
        status: result.available ? 'success' : 'fail',
        data: { available: result.available, message: result.message },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/face/encode
   * Accept base64 image, return 128-float face encoding (calls Python service).
   */
  async encode(req: Request, res: Response, next: NextFunction) {
    try {
      const { image_base64: imageBase64 } = req.body as { image_base64?: string };
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          status: 'fail',
          message: 'image_base64 is required (base64 string)',
        });
      }
      const result = await generateEncoding(imageBase64);
      if (result.error) {
        const isUnavailable = result.error.includes('unreachable');
        return res.status(isUnavailable ? 503 : 400).json({
          status: 'fail',
          message: result.error,
          data: { encoding: null },
        });
      }
      return res.status(200).json({
        status: 'success',
        data: { encoding: result.encoding },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const faceController = new FaceController();
