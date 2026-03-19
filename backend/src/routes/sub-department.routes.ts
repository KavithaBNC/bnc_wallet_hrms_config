import { Router } from 'express';
import multer from 'multer';
import { subDepartmentController } from '../controllers/sub-department.controller';
import { authenticate, authorize } from '../middlewares/auth';
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

router.get('/', subDepartmentController.getByOrganization.bind(subDepartmentController));
router.get('/list', subDepartmentController.getByOrganization.bind(subDepartmentController));
router.get('/download-excel', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'), subDepartmentController.downloadExcel.bind(subDepartmentController));
router.post('/upload-excel', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'), upload.single('file'), subDepartmentController.uploadExcel.bind(subDepartmentController));
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'), subDepartmentController.create.bind(subDepartmentController));

export default router;
