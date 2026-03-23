import { Router } from 'express';
import multer from 'multer';
import { entityController } from '../controllers/entity.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';
import { enforceOrganizationAccess } from '../middlewares/rbac';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname) ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) files are allowed'));
    }
  },
});

router.use(authenticate);
router.use(enforceOrganizationAccess);

router.get('/download-excel', checkPermission('entities', 'read'), entityController.downloadExcel.bind(entityController));
router.post('/upload-excel', checkPermission('entities', 'create'), upload.single('file'), entityController.uploadExcel.bind(entityController));
router.get('/', entityController.getByOrganization.bind(entityController));
router.post('/', checkPermission('entities', 'create'), entityController.create.bind(entityController));
router.put('/:id', checkPermission('entities', 'update'), entityController.update.bind(entityController));
router.delete('/:id', checkPermission('entities', 'delete'), entityController.delete.bind(entityController));
export default router;
