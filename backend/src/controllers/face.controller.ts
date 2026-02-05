import { Request, Response, NextFunction } from 'express';
import { generateEncoding } from '../services/face.service';

export class FaceController {
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
        return res.status(400).json({
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
