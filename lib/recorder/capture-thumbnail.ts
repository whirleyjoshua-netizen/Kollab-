const THUMB_WIDTH = 360;
const THUMB_HEIGHT = 640; // 9:16 vertical
const THUMB_QUALITY = 0.82;

/**
 * Capture a JPEG thumbnail from a video blob at a given timestamp.
 * Returns a data URL like 'data:image/jpeg;base64,...'.
 */
export async function captureThumbnail(blob: Blob, atSeconds = 0.1): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video for thumbnail'));
    });

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Failed to seek video for thumbnail'));
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.1));
    });

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // Cover-fit: preserve aspect, fill the thumb rect.
    const videoAspect = video.videoWidth / video.videoHeight;
    const thumbAspect = THUMB_WIDTH / THUMB_HEIGHT;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (videoAspect > thumbAspect) {
      // video is wider than thumb — crop sides
      sw = video.videoHeight * thumbAspect;
      sx = (video.videoWidth - sw) / 2;
    } else if (videoAspect < thumbAspect) {
      // video is taller than thumb — crop top/bottom
      sh = video.videoWidth / thumbAspect;
      sy = (video.videoHeight - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

    return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}
