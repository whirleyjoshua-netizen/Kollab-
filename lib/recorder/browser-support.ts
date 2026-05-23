const CANDIDATE_MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // iOS Safari 14.5+
  'video/webm;codecs=vp9,opus',              // Chrome/Edge/Firefox
  'video/webm;codecs=vp8,opus',              // Older Chrome
  'video/webm',                              // Last resort
];

export type BrowserSupport =
  | { kind: 'ok'; mimeType: string }
  | { kind: 'no-mediadevices' }
  | { kind: 'no-mediarecorder' }
  | { kind: 'no-supported-mime' };

export function detectBrowserSupport(): BrowserSupport {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { kind: 'no-mediadevices' };
  }
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return { kind: 'no-mediarecorder' };
  }
  const mimeType = CANDIDATE_MIMES.find((mime) =>
    window.MediaRecorder.isTypeSupported(mime)
  );
  if (!mimeType) {
    return { kind: 'no-supported-mime' };
  }
  return { kind: 'ok', mimeType };
}

export function looksLikeDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return !hasTouch && !hasCoarsePointer;
}
