declare module 'react-webcam' {
  import { RefObject } from 'react';
  export interface WebcamRef {
    getScreenshot(): string | null;
  }
  export interface WebcamProps {
    audio?: boolean;
    videoConstraints?: MediaTrackConstraints;
    onUserMedia?: (stream: MediaStream) => void;
    onUserMediaError?: (error: string | DOMException) => void;
    className?: string;
    style?: React.CSSProperties;
    ref?: RefObject<WebcamRef>;
    screenshotFormat?: string;
    width?: number;
    height?: number;
  }
  const Webcam: React.FC<WebcamProps>;
  export default Webcam;
}
