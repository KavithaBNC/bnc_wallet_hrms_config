import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam, { WebcamRef } from 'react-webcam';
import api from '../../services/api';

interface FaceCaptureProps {
  onEncodingCaptured: (encoding: number[]) => void;
  onError: (message: string) => void;
  existingEncoding?: number[] | null;
  disabled?: boolean;
}

const videoConstraints = { width: 320, height: 240, facingMode: 'user' };

const FACE_SERVICE_UNAVAILABLE_MSG =
  'Face service is not available. You can save the employee without face and add face later (see face-service/README.md for Docker or Conda setup).';

function getCameraError(err: unknown): { message: string; isInUse: boolean } {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
      return { message: 'Camera access denied. Please allow camera for this site in your browser settings and refresh.', isInUse: false };
    if (name === 'NotFoundError')
      return { message: 'No camera found. Please connect a camera and refresh.', isInUse: false };
    if (name === 'NotReadableError')
      return { message: 'Camera is in use or could not be read.', isInUse: true };
  }
  return { message: 'Could not start camera. Please allow camera access and refresh the page.', isInUse: false };
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onEncodingCaptured,
  onError,
  existingEncoding = null,
  disabled = false,
}) => {
  const webcamRef = useRef<WebcamRef>(null);
  const [capturing, setCapturing] = useState(false);
  const [faceServiceAvailable, setFaceServiceAvailable] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorInUse, setCameraErrorInUse] = useState(false);
  const [webcamKey, setWebcamKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ status: string; data?: { available?: boolean } }>('/face/health')
      .then(({ data }) => {
        if (!cancelled) setFaceServiceAvailable(data.data?.available === true);
      })
      .catch(() => {
        if (!cancelled) setFaceServiceAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const isServiceUnavailable =
        msg.includes('not installed') ||
        msg.includes('dlib') ||
        msg.includes('unreachable') ||
        msg.includes('Face service');
      onError(isServiceUnavailable ? FACE_SERVICE_UNAVAILABLE_MSG : msg);
    } finally {
      setCapturing(false);
    }
  }, [onEncodingCaptured, onError]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Face (optional, for face attendance punch)</p>
      <p className="text-xs text-gray-500">You can save the employee without face; face can be added later when the face service is running.</p>
      {faceServiceAvailable === true && (
        <p className="text-xs text-green-700">Face service: ready. You can capture a face.</p>
      )}
      {faceServiceAvailable === false && (
        <p className="text-xs text-amber-700">
          Face service not running. Run <code className="bg-gray-100 px-1 rounded">.\run-face-service.ps1</code> or see face-service/README.md. You can still save without face.
        </p>
      )}
      {/* Camera feed: show placeholder until stream is ready or show error */}
      <div className="relative inline-block rounded-lg overflow-hidden border border-gray-300 bg-gray-100 min-w-[320px] min-h-[240px]">
        {cameraError ? (
          <div className="w-[320px] h-[240px] flex flex-col items-center justify-center gap-3 p-4 bg-amber-50 text-amber-800 text-sm text-center">
            <span className="font-medium">Camera not available</span>
            <p>{cameraError}</p>
            {cameraErrorInUse && (
              <p className="text-xs text-amber-700 max-w-[280px]">
                Close Zoom, Teams, other browser tabs using the camera, or any app that might be using the webcam. Then click Try again or refresh the page.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCameraError(null);
                  setCameraErrorInUse(false);
                  setCameraReady(false);
                  setWebcamKey((k) => k + 1);
                }}
                className="px-3 py-1.5 bg-amber-200 rounded hover:bg-amber-300 text-sm font-medium"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-white border border-amber-400 rounded hover:bg-amber-100 text-sm font-medium"
              >
                Refresh page
              </button>
            </div>
          </div>
        ) : (
          <>
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-600 text-sm z-10">
                Loading camera… Allow access if the browser prompts.
              </div>
            )}
            <Webcam
              key={webcamKey}
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              videoConstraints={videoConstraints}
              onUserMedia={() => {
                setCameraReady(true);
                setCameraError(null);
              }}
              onUserMediaError={(err: unknown) => {
                setCameraReady(false);
                const { message, isInUse } = getCameraError(err);
                setCameraError(message);
                setCameraErrorInUse(isInUse);
              }}
            />
          </>
        )}
      </div>
      {existingEncoding && existingEncoding.length === 128 ? (
        <div className="space-y-2">
          <p className="text-sm text-green-700">Face already registered. Use Re-capture to replace.</p>
          <button
            type="button"
            onClick={capture}
            disabled={disabled || capturing}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm"
          >
            {capturing ? 'Capturing...' : 'Re-capture'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={capture}
          disabled={disabled || capturing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {capturing ? 'Capturing...' : 'Capture'}
        </button>
      )}
    </div>
  );
};

export default FaceCapture;
