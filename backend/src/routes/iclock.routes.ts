/**
 * ADMS / iClock: device handshake and data upload.
 * Endpoint: GET and POST /iclock/cdata
 * No JWT; devices call with no auth (or add API key later if needed).
 */

import { Router } from 'express';
import * as iclockController from '../controllers/iclock.controller';

const router = Router();

// Health check for iclock — use to verify the route is reachable from device network
// GET /iclock/ping → "iclock OK"
router.get('/ping', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('iclock OK');
});

router.get('/cdata', iclockController.getCdata);
// Body is already parsed as text by app-level middleware (accepts any Content-Type)
router.post('/cdata', iclockController.postCdata);

// eSSL device sends to /iclock/cdata.aspx (same handler; SN, table, OpStamp in query)
router.get('/cdata.aspx', iclockController.getCdata);

router.post('/cdata.aspx', iclockController.postCdata);

// eSSL device polls for server commands; some devices use .aspx, others don't
router.get('/getrequest', iclockController.getRequest);
router.get('/getrequest.aspx', iclockController.getRequest);

export default router;


