/**
 * Calls Python face microservice for encoding and matching.
 */
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:8000';

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

export async function generateEncoding(imageBase64: string): Promise<GenerateEncodingResult> {
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
}

export async function matchFace(
  liveBase64: string,
  storedEncodings: { employee_id: string; encoding: number[] }[]
): Promise<MatchFaceResult> {
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
}
