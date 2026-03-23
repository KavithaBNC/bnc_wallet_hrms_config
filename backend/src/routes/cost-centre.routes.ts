import { Router } from 'express';
import multer from 'multer';
import { costCentreController } from '../controllers/cost-centre.controller';
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

router.get('/', costCentreController.getByOrganization.bind(costCentreController));
router.get('/list', costCentreController.getByOrganization.bind(costCentreController));
router.get('/download-excel', checkPermission('cost_centres', 'read'), costCentreController.downloadExcel.bind(costCentreController));
router.post('/upload-excel', checkPermission('cost_centres', 'create'), upload.single('file'), costCentreController.uploadExcel.bind(costCentreController));
router.post('/', checkPermission('cost_centres', 'create'), costCentreController.create.bind(costCentreController));
export default router;
