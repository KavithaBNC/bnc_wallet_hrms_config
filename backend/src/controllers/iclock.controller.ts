import { Request, Response, NextFunction } from 'express';
import { parseAdmsBody, processAdmsRecords } from '../services/iclock.service';
import { logger } from '../utils/logger';

/**
 * ADMS / iClock cdata: GET for handshake or punch-in-query (some devices send punch via GET).
 * If query has punch data (Pin/USERID + DateTime/TIMESTAMP + SN), store and respond OK.
 * Otherwise respond OK for handshake.
 */
export async function getCdata(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query || {}) as Record<string, string>;
    const querySn = typeof q.SN === 'string' ? q.SN.trim() : '';
    const hasPunchParams = !!(q.Pin || q.USERID || q.DateTime || q.TIMESTAMP || q.table);
    // Log every GET so we see what device sends (handshake vs punch)
    logger.info(`[iclock] GET cdata: ${req.originalUrl?.slice(0, 280)}`);
    const userId = q.USERID ?? q.userId ?? q.Pin ?? q.pin ?? '';
    const timestamp = q.TIMESTAMP ?? q.timestamp ?? q.DateTime ?? q.datetime ?? q.Time ?? q.time ?? q.punchTime ?? '';
    const status = q.STATUS ?? q.status ?? q.inOut ?? q.direction ?? '0';
    if (userId && timestamp && querySn) {
      const rawBody = `USERID=${userId}\nTIMESTAMP=${timestamp}\nSTATUS=${status}\nSERIALNO=${querySn}`;
      const records = parseAdmsBody(rawBody);
      if (records.length > 0) {
        await processAdmsRecords(records);
        logger.info(`[iclock] GET punch stored: userId=${userId} timestamp=${timestamp}`);
      }
    }
    // Some devices send GET with table=ATTLOG&content=Base64(tab-separated lines)
    const content = q.content ?? q.data ?? q.payload;
    if (querySn && content && (q.table === 'ATTLOG' || q.table === 'OPERLOG')) {
      try {
        const decoded = Buffer.from(content, 'base64').toString('utf8');
        const records = parseAdmsBody(decoded);
        if (records.length > 0) {
          for (const r of records) {
            if (!r.serialNumber || r.serialNumber.trim() === '') r.serialNumber = querySn;
          }
          await processAdmsRecords(records);
          logger.info(`[iclock] GET content decoded and stored ${records.length} record(s)`);
        }
      } catch (_) {
        // ignore decode/parse errors
      }
    }

    // 1. If it's a GET request with NO data (Handshake), send Registry Options
    // This is what tells the device to start sending punches.
    if (req.method === 'GET' && !hasPunchParams && !content) {
      // Send Server Local Time (IST) 
      // Use sweden locale (sv-SE) simply to get YYYY-MM-DD HH:mm:ss format easily
      const dateTimeStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
      const configResponse = [
        `GET OPTION FROM: ${querySn}`,
        'Stamp=0',
        'OpStamp=0',
        'TransInterval=1',
        'RealTransFlag=1',
        'Delay=30',           // Checks for commands every 30 seconds instead of every 1 second
        'MaxLogCount=50',     // Device sends up to 50 punches per POST
        `DateTime=${dateTimeStr}`, // Send Local Time
        'TimeZone=330'        // 330 minutes = 5.5 hours (standard ADMS format)
      ].join('\n');

      logger.info(`[iclock] GET handshake → sending config for SN=${querySn || '(empty)'}`);
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(configResponse);
    }

    // 2. If it's actual data processing (punch or content), send OK (device expects plain OK)
    logger.info(`[iclock] GET data path → sending OK (hasPunchParams=${hasPunchParams}, content=${!!content})`);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send('OK');
  } catch (err) {
    return next(err);
  }
}

/**
 * ADMS / iClock getrequest: device polls for server commands (user list, options, etc.).
 * Return "C:Upload ATTLOG" so device may push attendance (some eSSL/ZKTeco devices only
 * send POST when they receive this command). If device ignores it, still 200 so no 404.
 */
export function getRequest(_req: Request, res: Response, _next: NextFunction) {
  res.status(200).setHeader('Content-Type', 'text/plain').send('C:Upload ATTLOG\n');
}

/**
 * ADMS / iClock cdata: POST for attendance data upload.
 * Parse body (UserID, Timestamp, Status, Serial Number), validate device by serial,
 * insert into attendance_logs, respond OK/SUCCESS so device clears buffer.
 */
export async function postCdata(req: Request, res: Response, next: NextFunction) {
  try {
    // Log POST so we see what device sends when user punches
    const bodyPreview =
      typeof req.body === 'string'
        ? req.body.slice(0, 300)
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8').slice(0, 300)
          : req.body && typeof req.body === 'object'
            ? JSON.stringify(req.body).slice(0, 300)
            : '';
    logger.info(`[iclock] POST cdata.aspx query: ${req.originalUrl?.slice(0, 150)} body: ${bodyPreview}`);

    let rawBody: string;
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (req.body && typeof req.body === 'object') {
      // Application/json or urlencoded (incl. eSSL Pin, DateTime)
      const b = req.body as Record<string, string>;
      const userId = b.USERID ?? b.userId ?? b.user_id ?? b.Pin ?? b.pin ?? '';
      const timestamp = b.TIMESTAMP ?? b.timestamp ?? b.punchTime ?? b.datetime ?? b.DateTime ?? b.Time ?? b.time ?? '';
      const status = b.STATUS ?? b.status ?? b.inOut ?? b.direction ?? '0';
      const serialNumber = b.SERIALNO ?? b.serialNumber ?? b.serial_no ?? b.deviceId ?? b.device_sn ?? '';
      if (userId && timestamp && (serialNumber || (req.query && req.query.SN))) {
        const sn = serialNumber || (typeof req.query.SN === 'string' ? req.query.SN : '');
        rawBody = `USERID=${userId}\nTIMESTAMP=${timestamp}\nSTATUS=${status}\nSERIALNO=${sn}`;
      } else if (userId || timestamp || Object.keys(b).length > 0) {
        rawBody = Object.entries(b)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n');
      } else {
        rawBody = '';
      }
    } else {
      rawBody = '';
      logger.warn(`[iclock] POST body is empty/undefined (Content-Type: ${req.headers['content-type'] ?? 'none'}). Device may be sending with unsupported content type.`);
    }

    // eSSL cdata.aspx sends SN (serial) in query string; merge into body if missing
    const querySn = typeof req.query.SN === 'string' ? req.query.SN.trim() : '';
    if (querySn && !rawBody.includes('SERIALNO') && !rawBody.includes('serialNumber')) {
      rawBody = rawBody ? `${rawBody}\nSERIALNO=${querySn}` : `SERIALNO=${querySn}`;
    }
    if (req.query && typeof req.query === 'object') {
      const q = req.query as Record<string, string>;
      const qUserId = q.USERID ?? q.userId ?? q.user_id ?? '';
      const qTs = q.TIMESTAMP ?? q.timestamp ?? q.punchTime ?? q.datetime ?? '';
      const qStatus = q.STATUS ?? q.status ?? q.inOut ?? q.direction ?? '0';
      const qSn = q.SERIALNO ?? q.SN ?? q.serialNumber ?? q.serial_no ?? '';
      if (qUserId && qTs && (qSn || querySn)) {
        const sn = qSn || querySn;
        rawBody = rawBody
          ? `${rawBody}\nUSERID=${qUserId}\nTIMESTAMP=${qTs}\nSTATUS=${qStatus}\nSERIALNO=${sn}`
          : `USERID=${qUserId}\nTIMESTAMP=${qTs}\nSTATUS=${qStatus}\nSERIALNO=${sn}`;
      }
    }

    const records = parseAdmsBody(rawBody);
    const sample = records[0]
      ? ` userId=${records[0].userId} ts=${records[0].timestamp} status=${records[0].status} sn=${records[0].serialNumber || querySn || '-'}`
      : '';
    logger.info(
      `[iclock] POST parsed ${records.length} record(s) from body (${rawBody.length} chars).${sample}`
    );
    if (records.length === 0) {
      return res.status(200).send('OK');
    }

    // If any record has no serial, use query SN (eSSL cdata.aspx)
    if (querySn) {
      for (const r of records) {
        if (!r.serialNumber || r.serialNumber.trim() === '') r.serialNumber = querySn;
      }
    }

    const result = await processAdmsRecords(records);
    logger.info(
      `[iclock] POST processed=${result.processed} skipped=${result.skipped} errors=${result.errors.length}`
    );
    if (result.errors.length > 0) {
      logger.warn(`[iclock] POST processing errors sample: ${result.errors.slice(0, 3).join(' | ')}`);
    }
    // Respond with OK so device clears its buffer (many eSSL/iClock devices expect "OK" only)
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send('OK');
  } catch (error) {
    return next(error);
  }
}
