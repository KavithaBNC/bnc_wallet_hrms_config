import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AppHeader from '../components/layout/AppHeader';

const videoConstraints = { width: 640, height: 480, facingMode: 'user' };

const FaceAttendancePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const webcamRef = useRef<Webcam>(null);
  const [punching, setPunching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setMessage({ type: 'success', text: 'Face punch recorded successfully!' });
        setTimeout(() => {
          navigate('/attendance', { state: { refreshFromFacePunch: true } });
        }, 1500);
      } else {
        setMessage({ type: 'error', text: (data as { message?: string }).message || 'Punch failed' });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Face punch failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setPunching(false);
    }
  }, [navigate, user?.employee?.organizationId]);

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
          Position your face in the frame and click Punch to record attendance.
        </p>
        <div className="space-y-4">
          <div className="relative inline-block rounded-xl overflow-hidden border-2 border-gray-300 bg-gray-100 shadow-md">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              width={640}
              height={480}
              videoConstraints={videoConstraints}
              className="block"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={punch}
              disabled={punching}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {punching ? 'Verifying...' : 'Punch'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/attendance')}
              className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition"
            >
              Back to Attendance
            </button>
          </div>
          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FaceAttendancePage;
