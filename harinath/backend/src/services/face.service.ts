/**
 * Calls Python face microservice for encoding and matching.
 * If FACE_SERVICE_URL is not set or the service is unreachable, returns a clear error instead of throwing.
 */
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'https://bnc-ai.com/ragapi';

export interface GenerateEncodingResult {
  encoding: number[] | null;
  error: string | null;
}

export interface MatchFaceResult {
  matched_employee_id: string | null;
  distance: number | null;
  match: boolean;
  error: string | null;
}

const FACE_SERVICE_UNAVAILABLE =
  'Face recognition service is unavailable. Start the Python face service (see FACE_SERVICE_URL in .env) or disable face attendance.';

export interface FaceServiceHealthResult {
  available: boolean;
  message?: string;
}

/** Check if the Python face microservice is reachable (GET /health). */
export async function checkFaceServiceHealth(): Promise<FaceServiceHealthResult> {
  try {
    const res = await fetch(`${FACE_SERVICE_URL}/health`, { method: 'GET' });
    if (!res.ok) {
      return { available: false, message: `Face service returned ${res.status}` };
    }
    const data = (await res.json()) as { status?: string };
    return { available: data.status === 'ok', message: data.status === 'ok' ? undefined : 'Unexpected response' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, message: `Unreachable: ${message}` };
  }
}

export async function generateEncoding(imageBase64: string): Promise<GenerateEncodingResult> {
  try {
    const res = await fetch(`${FACE_SERVICE_URL}/generate-encoding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
    if (!res.ok) {
      return { encoding: null, error: `Face service error: ${res.status}` };
    }
    const data = (await res.json()) as { encoding?: number[]; error?: string };
    return {
      encoding: data.encoding ?? null,
      error: data.error ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      encoding: null,
      error: `Face service unreachable: ${message}. ${FACE_SERVICE_UNAVAILABLE}`,
    };
  }
}

export async function matchFace(
  liveBase64: string,
  storedEncodings: { employee_id: string; encoding: number[] }[]
): Promise<MatchFaceResult> {
  try {
    const res = await fetch(`${FACE_SERVICE_URL}/match-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        live_base64: liveBase64,
        stored_encodings: storedEncodings,
      }),
    });
    if (!res.ok) {
      return {
        matched_employee_id: null,
        distance: null,
        match: false,
        error: `Face service error: ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      matched_employee_id?: string;
      distance?: number;
      match?: boolean;
      error?: string;
    };
    return {
      matched_employee_id: data.matched_employee_id ?? null,
      distance: data.distance ?? null,
      match: data.match === true,
      error: data.error ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      matched_employee_id: null,
      distance: null,
      match: false,
      error: `Face service unreachable: ${message}. ${FACE_SERVICE_UNAVAILABLE}`,
    };
  }
}
