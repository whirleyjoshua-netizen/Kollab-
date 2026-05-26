import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_MS = 30_000;
const VIDEO_BITS_PER_SECOND = 2_500_000;
const AUDIO_BITS_PER_SECOND = 96_000;

export type RecorderState =
  | 'idle'
  | 'requesting-permission'
  | 'ready'
  | 'recording'
  | 'stopped'
  | 'error';

export type RecorderError =
  | { kind: 'permission-denied' }
  | { kind: 'no-camera' }
  | { kind: 'orientation' }
  | { kind: 'other'; message: string };

export type RecorderResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
};

export type FacingMode = 'user' | 'environment';

export function useRecorder(mimeType: string) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<RecorderResult | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const attachPreview = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const requestPermission = useCallback(async (mode: FacingMode = 'environment') => {
    setError(null);
    setState('requesting-permission');

    // If there's an existing stream (e.g., camera switch), stop its tracks first.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoElRef.current) {
        videoElRef.current.srcObject = stream;
      }
      setFacingMode(mode);
      setState('ready');
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setError({ kind: 'permission-denied' });
      } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
        setError({ kind: 'no-camera' });
      } else {
        setError({ kind: 'other', message: e.message || 'Camera error' });
      }
      setState('error');
    }
  }, []);

  const switchCamera = useCallback(async () => {
    // Only allow switching while the camera is ready and not actively recording.
    if (state !== 'ready') return;
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    await requestPermission(next);
  }, [facingMode, requestPermission, state]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    // Get track settings for the result blob's dimensions.
    // Note: we used to error if sensor reported landscape, but back cameras
    // on phones have landscape-native sensors even when held portrait — the
    // OS rotates the image downstream. The video element renders correctly
    // regardless, so we skip the sensor-orientation check.
    const videoTrack = streamRef.current.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const width = settings?.width ?? 1080;
      const height = settings?.height ?? 1920;
      const durationMs = Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current);
      setResult({ blob, mimeType, durationMs, width, height });
      setState('stopped');
    };

    recorder.onerror = () => {
      setError({ kind: 'other', message: 'Recorder error' });
      setState('error');
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setState('recording');

    // Start with a 1-second timeslice so iOS Safari flushes chunks regularly.
    recorder.start(1000);

    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    }, MAX_DURATION_MS);

    tickTimerRef.current = setInterval(() => {
      setElapsedMs(Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current));
    }, 100);
  }, [mimeType]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
  }, []);

  /**
   * Reset internal state so the next recording can begin. NOTE: this does
   * NOT re-acquire the camera stream. If cleanup() ran (e.g., on a stream
   * error or after permission was revoked), call requestPermission() again
   * before startRecording(). The customer recorder's Retake path does this
   * sequence; new flows should follow the same pattern.
   */
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setElapsedMs(0);
    setState('ready');
  }, []);

  return {
    state,
    error,
    elapsedMs,
    result,
    facingMode,
    attachPreview,
    requestPermission,
    switchCamera,
    startRecording,
    stopRecording,
    reset,
  };
}
