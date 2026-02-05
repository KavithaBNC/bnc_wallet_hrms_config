import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import api from '../../services/api';

interface FaceCaptureProps {
  onEncodingCaptured: (encoding: number[]) => void;
  onError: (message: string) => void;
  existingEncoding?: number[] | null;
  disabled?: boolean;
}

const videoConstraints = { width: 320, height: 240, facingMode: 'user' };

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onEncodingCaptured,
  onError,
  existingEncoding = null,
  disabled = false,
}) => {
  const webcamRef = useRef<Webcam>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!webcamRef.current) {
      onError('Webcam not ready');
      return;
    }
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      onError('Could not capture image');
      return;
    }
    const base64 = imageSrc.replace(/^data:image\/\w+;base64,/, '');
    setCapturing(true);
    onError('');
    try {
      const { data } = await api.post<{ status: string; data?: { encoding?: number[] }; message?: string }>(
        '/face/encode',
        { image_base64: base64 }
      );
      if (data.status === 'success' && data.data?.encoding?.length === 128) {
        onEncodingCaptured(data.data.encoding);
      } else {
        onError((data as { message?: string }).message || 'No face detected or invalid response');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Face encode failed';
      onError(msg);
    } finally {
      setCapturing(false);
    }
  }, [onEncodingCaptured, onError]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Face (for attendance punch)</p>
      {!existingEncoding || existingEncoding.length !== 128 ? (
        <>
          <div className="relative inline-block rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              videoConstraints={videoConstraints}
            />
          </div>
          <button
            type="button"
            onClick={capture}
            disabled={disabled || capturing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {capturing ? 'Capturing...' : 'Capture'}
          </button>
        </>
      ) : (
        <p className="text-sm text-green-700">Face encoding captured (128 values). Re-capture above to replace.</p>
      )}
    </div>
  );
};

export default FaceCapture;
