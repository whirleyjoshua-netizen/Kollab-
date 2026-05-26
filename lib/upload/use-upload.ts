import { useCallback, useState } from 'react';

export type UploadState = 'idle' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'error';

export type UploadInput = {
  qrCodeId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
};

export type UploadHook = {
  state: UploadState;
  progress: number; // 0..1
  errorMessage: string | null;
  upload: (input: UploadInput) => Promise<void>;
  reset: () => void;
};

export function useUpload(): UploadHook {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const upload = useCallback(async (input: UploadInput) => {
    setErrorMessage(null);
    setProgress(0);

    try {
      // 1. Sign
      setState('signing');
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCodeId: input.qrCodeId,
          mimeType: input.mimeType,
          sizeBytes: input.blob.size,
          durationMs: input.durationMs,
          width: input.width,
          height: input.height,
        }),
      });
      if (!signRes.ok) {
        const j = await safeJson(signRes);
        throw new Error(j?.error ?? `Sign failed (${signRes.status})`);
      }
      const { videoId, uploadUrl, finalizeToken } = (await signRes.json()) as {
        videoId: string;
        uploadUrl: string;
        finalizeToken: string;
      };

      // 2. Upload via XHR (so we get progress events)
      setState('uploading');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', input.mimeType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(ev.loaded / ev.total);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(1);
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 5 * 60 * 1000; // 5 minutes
        xhr.send(input.blob);
      });

      // 3. Finalize
      setState('finalizing');
      const finRes = await fetch(`/api/videos/${videoId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailDataUrl: input.thumbnailDataUrl,
          finalizeToken,
        }),
      });
      if (!finRes.ok) {
        const j = await safeJson(finRes);
        throw new Error(j?.error ?? `Finalize failed (${finRes.status})`);
      }

      setState('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(message);
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setErrorMessage(null);
  }, []);

  return { state, progress, errorMessage, upload, reset };
}

async function safeJson(res: Response): Promise<{ error?: string } | null> {
  try {
    return await res.json() as { error?: string };
  } catch {
    return null;
  }
}
