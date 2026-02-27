/**
 * ADMS / iClock: device handshake and data upload.
 * Endpoint: GET and POST /iclock/cdata
 * No JWT; devices call with no auth (or add API key later if needed).
 */

import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import * as iclockController from '../controllers/iclock.controller';

const router = Router();

// #region agent log
function logIclockRequest(req: Request, _res: Response, next: NextFunction) {
  const bodyLen = typeof req.body === 'string' ? req.body.length : Buffer.isBuffer(req.body) ? req.body.length : req.body && typeof req.body === 'object' ? JSON.stringify(req.body).length : 0;
  fetch('http://127.0.0.1:7242/ingest/40a87c8f-5aae-4e89-ab91-22bf9e52eb76',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'iclock.routes.ts:logIclockRequest',message:'iclock request',data:{method:req.method,path:req.path,query:req.url?.split('?')[1]||'',bodyLen},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-noPOST',runId:'iclock-trace'})}).catch(()=>{});
  next();
}
// #endregion
router.use(logIclockRequest);

router.get('/cdata', iclockController.getCdata);
// Accept text/plain so device-sent key=value body is available as string
router.post('/cdata', express.text({ type: 'text/plain', limit: '1mb' }), iclockController.postCdata);

// eSSL device sends to /iclock/cdata.aspx (same handler; SN, table, OpStamp in query)
router.get('/cdata.aspx', iclockController.getCdata);
router.post('/cdata.aspx', express.text({ type: 'text/plain', limit: '1mb' }), iclockController.postCdata);

// eSSL device polls GET /iclock/getrequest.aspx for server commands; respond 200 empty so no 404
router.get('/getrequest.aspx', iclockController.getRequest);

export default router;
