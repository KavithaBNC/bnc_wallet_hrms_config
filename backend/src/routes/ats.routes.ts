import { Router } from 'express';
import { jobOpeningController } from '../controllers/job-opening.controller';
import { candidateController } from '../controllers/candidate.controller';
import { applicationController } from '../controllers/application.controller';
import { interviewController } from '../controllers/interview.controller';
import { offerController } from '../controllers/offer.controller';
import { authenticate } from '../middlewares/auth';
import { checkPermission } from '../middlewares/permission';

const router = Router();

// ============================================================================
// JOB OPENING ROUTES
// ============================================================================

router.post(
  '/job-openings',
  authenticate,
  checkPermission('employees', 'create'),
  jobOpeningController.create.bind(jobOpeningController)
);

router.get(
  '/job-openings',
  authenticate,
  jobOpeningController.getAll.bind(jobOpeningController)
);

router.get(
  '/job-openings/:id',
  authenticate,
  jobOpeningController.getById.bind(jobOpeningController)
);

router.put(
  '/job-openings/:id',
  authenticate,
  checkPermission('employees', 'update'),
  jobOpeningController.update.bind(jobOpeningController)
);

router.delete(
  '/job-openings/:id',
  authenticate,
  checkPermission('employees', 'update'),
  jobOpeningController.delete.bind(jobOpeningController)
);

// ============================================================================
// CANDIDATE ROUTES
// ============================================================================

router.post(
  '/candidates',
  authenticate,
  checkPermission('employees', 'create'),
  candidateController.create.bind(candidateController)
);

router.get(
  '/candidates',
  authenticate,
  candidateController.getAll.bind(candidateController)
);

router.get(
  '/candidates/:id',
  authenticate,
  candidateController.getById.bind(candidateController)
);

router.get(
  '/candidates/email/:email',
  authenticate,
  candidateController.getByEmail.bind(candidateController)
);

router.put(
  '/candidates/:id',
  authenticate,
  checkPermission('employees', 'update'),
  candidateController.update.bind(candidateController)
);

router.delete(
  '/candidates/:id',
  authenticate,
  checkPermission('employees', 'update'),
  candidateController.delete.bind(candidateController)
);

// ============================================================================
// APPLICATION ROUTES
// ============================================================================

router.post(
  '/applications',
  authenticate,
  applicationController.create.bind(applicationController)
);

router.get(
  '/applications',
  authenticate,
  applicationController.getAll.bind(applicationController)
);

router.get(
  '/applications/:id',
  authenticate,
  applicationController.getById.bind(applicationController)
);

router.put(
  '/applications/:id',
  authenticate,
  checkPermission('employees', 'update'),
  applicationController.update.bind(applicationController)
);

router.delete(
  '/applications/:id',
  authenticate,
  checkPermission('employees', 'update'),
  applicationController.delete.bind(applicationController)
);

// ============================================================================
// INTERVIEW ROUTES
// ============================================================================

router.post(
  '/interviews',
  authenticate,
  checkPermission('employees', 'create'),
  interviewController.create.bind(interviewController)
);

router.get(
  '/interviews',
  authenticate,
  interviewController.getAll.bind(interviewController)
);

router.get(
  '/interviews/:id',
  authenticate,
  interviewController.getById.bind(interviewController)
);

router.put(
  '/interviews/:id',
  authenticate,
  checkPermission('employees', 'update'),
  interviewController.update.bind(interviewController)
);

router.post(
  '/interviews/:id/feedback',
  authenticate,
  checkPermission('employees', 'update'),
  interviewController.submitFeedback.bind(interviewController)
);

router.delete(
  '/interviews/:id',
  authenticate,
  checkPermission('employees', 'update'),
  interviewController.delete.bind(interviewController)
);

// ============================================================================
// OFFER ROUTES
// ============================================================================

router.post(
  '/offers',
  authenticate,
  checkPermission('employees', 'create'),
  offerController.create.bind(offerController)
);

router.get(
  '/offers',
  authenticate,
  offerController.getAll.bind(offerController)
);

router.get(
  '/offers/:id',
  authenticate,
  offerController.getById.bind(offerController)
);

router.put(
  '/offers/:id',
  authenticate,
  checkPermission('employees', 'update'),
  offerController.update.bind(offerController)
);

router.post(
  '/offers/:id/send',
  authenticate,
  checkPermission('employees', 'update'),
  offerController.send.bind(offerController)
);

router.post(
  '/offers/:id/accept',
  authenticate,
  offerController.accept.bind(offerController)
);

router.post(
  '/offers/:id/reject',
  authenticate,
  offerController.reject.bind(offerController)
);

router.delete(
  '/offers/:id',
  authenticate,
  checkPermission('employees', 'update'),
  offerController.delete.bind(offerController)
);

export default router;
