import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

const videoConstraints = { width: 640, height: 480, facingMode: 'user' };
const AUTO_PUNCH_INTERVAL_MS = 2000;

function getCameraError(err: unknown): { message: string; isInUse: boolean } {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
      return { message: 'Camera access denied. Please allow camera for this site and refresh.', isInUse: false };
    if (name === 'NotFoundError')
      return { message: 'No camera found. Connect a camera and refresh.', isInUse: false };
    if (name === 'NotReadableError')
      return { message: 'Camera is in use or could not be read.', isInUse: true };
  }
  return { message: 'Could not start camera. Allow camera access and refresh.', isInUse: false };
}

const FaceAttendancePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const webcamRef = useRef<Webcam>(null);
  const [punching, setPunching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [punchSuccess, setPunchSuccess] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorInUse, setCameraErrorInUse] = useState(false);
  const [webcamKey, setWebcamKey] = useState(0);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const punchingRef = useRef(false);

  const punch = useCallback(async () => {
    if (!webcamRef.current) {
      setMessage({ type: 'error', text: 'Webcam not ready' });
      return;
    }
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setMessage({ type: 'error', text: 'Could not capture image' });
      return;
    }
    const base64 = imageSrc.replace(/^data:image\/\w+;base64,/, '');
    punchingRef.current = true;
    setPunching(true);
    setMessage(null);
    try {
      const payload: { image_base64: string; organizationId?: string } = { image_base64: base64 };
      if (user?.employee?.organizationId) {
        payload.organizationId = user.employee.organizationId;
      }
      const { data } = await api.post<{ status: string; message?: string; data?: { employeeId: string } }>(
        '/attendance/face-punch',
        payload
      );
      if (data.status === 'success') {
        setPunchSuccess(true);
        setMessage({ type: 'success', text: 'Punched successfully' });
        if (autoIntervalRef.current) {
          clearInterval(autoIntervalRef.current);
          autoIntervalRef.current = null;
        }
        setTimeout(() => {
          navigate('/attendance', { state: { refreshFromFacePunch: true } });
        }, 1500);
      } else {
        setMessage({ type: 'error', text: (data as { message?: string }).message || 'Punch failed' });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Face punch failed';
      const displayMsg = msg.toLowerCase().includes('not registered') || msg.toLowerCase().includes('no matching face')
        ? 'Employee not registered'
        : msg;
      setMessage({ type: 'error', text: displayMsg });
    } finally {
      punchingRef.current = false;
      setPunching(false);
    }
  }, [navigate, user?.employee?.organizationId]);

  // Auto mode: periodically capture and punch; stop on success
  useEffect(() => {
    if (!autoMode || punchSuccess) return;
    autoIntervalRef.current = setInterval(() => {
      if (punchSuccess || punchingRef.current) return;
      punch();
    }, AUTO_PUNCH_INTERVAL_MS);
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [autoMode, punchSuccess, punch]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Face Attendance" onLogout={handleLogout} />
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Face Attendance</h1>
        <p className="text-gray-600 mb-6">
          {autoMode
            ? 'Position your face in the frame. Attendance will be recorded automatically when your face is detected.'
            : 'Position your face in the frame and click Punch to record attendance.'}
        </p>
        <div className="space-y-4">
          <div className={`relative inline-block rounded-xl overflow-hidden border-2 shadow-md bg-gray-100 min-w-[640px] min-h-[480px] ${
            punchSuccess ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-300'
          }`}>
            {cameraError ? (
              <div className="w-[640px] h-[480px] flex flex-col items-center justify-center gap-4 p-6 bg-amber-50 text-amber-800 text-center">
                <span className="font-semibold">Camera not available</span>
                <p>{cameraError}</p>
                {cameraErrorInUse && (
                  <p className="text-sm max-w-md">
                    Close Zoom, Teams, other browser tabs using the camera, or any app using the webcam. Then click Try again or refresh the page.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraError(null);
                      setCameraErrorInUse(false);
                      setCameraReady(false);
                      setWebcamKey((k) => k + 1);
                    }}
                    className="px-4 py-2 bg-amber-200 rounded-lg hover:bg-amber-300 font-medium"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white border border-amber-400 rounded-lg hover:bg-amber-100 font-medium"
                  >
                    Refresh page
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-600 z-10">
                    Loading camera… Allow access if the browser prompts.
                  </div>
                )}
                <Webcam
                  key={webcamKey}
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  width={640}
                  height={480}
                  videoConstraints={videoConstraints}
                  className="block"
                  onUserMedia={() => {
                    setCameraReady(true);
                    setCameraError(null);
                  }}
                  onUserMediaError={(err) => {
                    setCameraReady(false);
                    const { message, isInUse } = getCameraError(err);
                    setCameraError(message);
                    setCameraErrorInUse(isInUse);
                  }}
                />
              </>
            )}
            {punchSuccess && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20 rounded-xl">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="mt-3 text-lg font-semibold text-green-800">Punched successfully</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                disabled={punchSuccess}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-medium text-gray-700">Auto-detect face</span>
            </label>
            {!autoMode && (
              <button
                type="button"
                onClick={punch}
                disabled={punching}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {punching ? 'Verifying...' : 'Punch'}
              </button>
            )}
            {autoMode && punching && (
              <span className="text-sm text-gray-600">Verifying...</span>
            )}
            <button
              type="button"
              onClick={() => navigate('/attendance')}
              className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition"
            >
              Back to Attendance
            </button>
          </div>
          {message && !punchSuccess && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
          {message && punchSuccess && (
            <div className="p-4 rounded-lg bg-green-50 text-green-800 border border-green-200 flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-medium">{message.text}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FaceAttendancePage;
