'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DesktopPrompt } from '@/components/customer/desktop-prompt';
import { PermissionDenied } from '@/components/customer/permission-denied';
import { UnsupportedBrowser } from '@/components/customer/unsupported-browser';
import { renderConsentText } from '@/lib/consent';
import { detectBrowserSupport, looksLikeDesktop, type BrowserSupport } from '@/lib/recorder/browser-support';
import { captureThumbnail } from '@/lib/recorder/capture-thumbnail';
import { useRecorder } from '@/lib/recorder/use-recorder';
import { useUpload } from '@/lib/upload/use-upload';

type Stage = 'landing' | 'desktop' | 'permission' | 'recording' | 'preview' | 'sending' | 'thanks';

type Branding = {
  businessName: string;
  accentColor: string;
  ctaText: string | null;
  logoUrl: string | null;
};

type CustomerRecorderProps = {
  qrCodeId: string;
  locationLabel: string | null;
  branding: Branding;
};

export function CustomerRecorder({ qrCodeId, locationLabel, branding }: CustomerRecorderProps) {
  // Browser feature detection MUST run on the client only — it inspects navigator
  // and window which don't exist during SSR. Using useState+useEffect (not useMemo)
  // so the SSR'd HTML shows a neutral loading state, and the real detection runs
  // after hydration.
  const [support, setSupport] = useState<BrowserSupport | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    setSupport(detectBrowserSupport());
    setIsDesktop(looksLikeDesktop());
  }, []);

  const [stage, setStage] = useState<Stage>('landing');
  const [captureMode, setCaptureMode] = useState<'video' | 'photo'>('video');
  const recorder = useRecorder(support?.kind === 'ok' ? support.mimeType : 'video/webm');
  const upload = useUpload();

  // When detection finishes and we discover the user is on desktop, hop to that stage.
  useEffect(() => {
    if (isDesktop === true && stage === 'landing') {
      setStage('desktop');
    }
  }, [isDesktop, stage]);

  // When recorder produces a result, move to preview.
  useEffect(() => {
    if (stage === 'recording' && recorder.state === 'stopped' && recorder.result) {
      setStage('preview');
    }
  }, [stage, recorder.state, recorder.result]);

  // When upload finishes, move to thanks.
  useEffect(() => {
    if (stage === 'sending' && upload.state === 'done') {
      setStage('thanks');
    }
  }, [stage, upload.state]);

  // Consent text shown above the Send button. Depends on what was captured
  // (video vs photo) — falls back to the captureMode for the preview/permission
  // stages where result isn't set yet.
  const consentMediaType = recorder.result?.mediaType ?? captureMode;
  const consentText = useMemo(
    () => renderConsentText(branding.businessName, consentMediaType),
    [branding.businessName, consentMediaType]
  );

  // ---------- Branches that short-circuit the normal flow ----------

  // While detection is running on the client (just after hydration), show the
  // branding so the page doesn't flash an "unsupported" message before we know.
  if (support === null) {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} locationLabel={locationLabel} />
      </CenterPage>
    );
  }

  if (support.kind !== 'ok') {
    return (
      <CenterPage>
        <UnsupportedBrowser reason={support} />
      </CenterPage>
    );
  }

  if (stage === 'desktop') {
    return (
      <CenterPage>
        <DesktopPrompt onContinueAnyway={() => setStage('landing')} />
      </CenterPage>
    );
  }

  if (recorder.error?.kind === 'permission-denied') {
    return (
      <CenterPage>
        <PermissionDenied
          onRetry={() => {
            recorder.reset();
            void recorder.requestPermission();
            setStage('permission');
          }}
        />
      </CenterPage>
    );
  }

  // ---------- Main happy-path UI ----------

  if (stage === 'landing') {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} locationLabel={locationLabel} />
        <Button
          onClick={() => {
            setStage('permission');
            void recorder.requestPermission();
          }}
          className="rounded-md px-8 py-3 text-base font-medium text-white"
          style={{ backgroundColor: branding.accentColor }}
        >
          Start recording
        </Button>
      </CenterPage>
    );
  }

  if (stage === 'permission') {
    return (
      <RecordingStage
        recorder={recorder}
        branding={branding}
        captureMode={captureMode}
        onChangeMode={setCaptureMode}
        onStart={() => {
          if (captureMode === 'photo') {
            void recorder.capturePhoto().then(() => setStage('preview'));
            return;
          }
          recorder.startRecording();
          setStage('recording');
        }}
        showStartButton
      />
    );
  }

  if (stage === 'recording') {
    return (
      <RecordingStage
        recorder={recorder}
        branding={branding}
        captureMode="video"
        onChangeMode={() => {}}
        onStart={() => {}}
        showStartButton={false}
      />
    );
  }

  if (stage === 'preview' && recorder.result) {
    return (
      <PreviewStage
        result={recorder.result}
        branding={branding}
        consentText={consentText}
        onRetake={() => {
          recorder.reset();
          setStage('permission');
        }}
        onSaveToDevice={() => downloadBlob(recorder.result!.blob, branding.businessName)}
        onSend={async () => {
          if (!recorder.result) return;
          setStage('sending');
          try {
            // For photos the file IS the thumbnail — the finalize endpoint
            // skips the thumbnail upload when mediaType === 'photo'.
            const thumb =
              recorder.result.mediaType === 'video'
                ? await captureThumbnail(recorder.result.blob, 0.1)
                : '';
            await upload.upload({
              qrCodeId,
              blob: recorder.result.blob,
              mimeType: recorder.result.mimeType,
              mediaType: recorder.result.mediaType,
              durationMs: recorder.result.durationMs,
              width: recorder.result.width,
              height: recorder.result.height,
              thumbnailDataUrl: thumb,
            });
          } catch {
            // useUpload populates errorMessage on its own; nothing else to do.
          }
        }}
      />
    );
  }

  if (stage === 'sending') {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} compact />
        <p className="text-base text-muted-foreground">
          {upload.state === 'signing' && 'Getting things ready…'}
          {upload.state === 'uploading' && `Sending… ${Math.round(upload.progress * 100)}%`}
          {upload.state === 'finalizing' && 'Almost done…'}
        </p>
        {upload.state === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-red-700 text-center max-w-sm">
              {upload.errorMessage ?? 'Something went wrong sending your video.'}
            </p>
            <Button
              onClick={async () => {
                if (!recorder.result) return;
                upload.reset();
                const thumb =
                  recorder.result.mediaType === 'video'
                    ? await captureThumbnail(recorder.result.blob, 0.1)
                    : '';
                await upload.upload({
                  qrCodeId,
                  blob: recorder.result.blob,
                  mimeType: recorder.result.mimeType,
                  mediaType: recorder.result.mediaType,
                  durationMs: recorder.result.durationMs,
                  width: recorder.result.width,
                  height: recorder.result.height,
                  thumbnailDataUrl: thumb,
                });
              }}
            >
              Try again
            </Button>
            <Button variant="ghost" onClick={() => setStage('preview')}>
              Back to preview
            </Button>
          </div>
        )}
      </CenterPage>
    );
  }

  if (stage === 'thanks') {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} compact />
        <h2 className="text-3xl font-bold">Thanks for sharing! 🎉</h2>
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          {branding.businessName} just got your clip. Enjoy your time at the table.
        </p>
      </CenterPage>
    );
  }

  // Fallback (shouldn't happen).
  return <CenterPage><p>Loading…</p></CenterPage>;
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function CenterPage({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center"
      style={{ backgroundColor: '#fafafa' }}
    >
      {children}
    </main>
  );
}

function BrandingHeader({
  branding,
  locationLabel,
  compact,
}: {
  branding: Branding;
  locationLabel?: string | null;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {branding.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt={`${branding.businessName} logo`}
          className={compact ? 'h-12 w-12 rounded-md object-cover' : 'h-24 w-24 rounded-md object-cover'}
        />
      )}
      <h1 className={compact ? 'text-xl font-semibold' : 'text-3xl font-bold'}>
        {branding.businessName}
      </h1>
      {!compact && locationLabel && (
        <p className="text-sm text-muted-foreground">{locationLabel}</p>
      )}
      {!compact && branding.ctaText && (
        <p className="max-w-sm text-base text-muted-foreground">
          {branding.ctaText}
        </p>
      )}
    </div>
  );
}

function RecordingStage({
  recorder,
  branding,
  captureMode,
  onChangeMode,
  onStart,
  showStartButton,
}: {
  recorder: ReturnType<typeof useRecorder>;
  branding: Branding;
  captureMode: 'video' | 'photo';
  onChangeMode: (mode: 'video' | 'photo') => void;
  onStart: () => void;
  showStartButton: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Wire the live preview once. attachPreview is a stable useCallback inside
  // useRecorder; depending on the whole `recorder` object would re-run this
  // effect on every render (which detaches and re-attaches the stream — the
  // root cause of black flickering during recording). The recorder hook
  // detaches the stream itself on unmount via its own cleanup, so no return
  // cleanup is needed here.
  const attachPreview = recorder.attachPreview;
  useEffect(() => {
    attachPreview(videoRef.current);
  }, [attachPreview]);

  const ringPercent = Math.min(100, (recorder.elapsedMs / 30_000) * 100);

  return (
    <CenterPage>
      <BrandingHeader branding={branding} compact />
      <div
        className="relative w-full max-w-xs overflow-hidden rounded-lg bg-black"
        style={{ maxHeight: '70vh', aspectRatio: '9 / 16' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {recorder.state === 'ready' && (
          <button
            type="button"
            onClick={() => void recorder.switchCamera()}
            aria-label="Switch camera"
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2-2h6l2 2h2a2 2 0 0 1 2 2v6" />
              <path d="m18 22 4-4-4-4" />
              <path d="M22 18h-7a2 2 0 0 1-2-2v-2" />
            </svg>
          </button>
        )}
        {recorder.state === 'recording' && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {Math.floor(recorder.elapsedMs / 1000)}s / 30s
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full transition-[width] duration-100"
                style={{ width: `${ringPercent}%`, backgroundColor: branding.accentColor }}
              />
            </div>
            <button
              type="button"
              onClick={() => recorder.stopRecording()}
              aria-label="Stop recording"
              className="absolute bottom-6 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="h-6 w-6 rounded-sm bg-red-600" />
            </button>
          </>
        )}
      </div>
      {showStartButton && recorder.state === 'ready' && (
        <>
          {/* Photo / Video mode toggle */}
          <div className="inline-flex items-center rounded-full bg-zinc-200 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => onChangeMode('video')}
              className={`px-4 py-1.5 rounded-full transition-colors ${captureMode === 'video' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#475569]'}`}
            >
              Video
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('photo')}
              className={`px-4 py-1.5 rounded-full transition-colors ${captureMode === 'photo' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#475569]'}`}
            >
              Photo
            </button>
          </div>

          <button
            type="button"
            onClick={onStart}
            aria-label={captureMode === 'photo' ? 'Take photo' : 'Start recording'}
            className="h-20 w-20 rounded-full bg-white border-4 flex items-center justify-center active:scale-95 transition-transform"
            style={{ borderColor: branding.accentColor }}
          >
            <span
              className={captureMode === 'photo' ? 'h-14 w-14 rounded-full bg-white border-2' : 'h-12 w-12 rounded-full'}
              style={{
                backgroundColor: captureMode === 'photo' ? 'white' : branding.accentColor,
                borderColor: captureMode === 'photo' ? branding.accentColor : 'transparent',
              }}
            />
          </button>
        </>
      )}
      {recorder.error?.kind === 'orientation' && (
        <p className="text-sm text-red-700">Please hold your phone upright (portrait).</p>
      )}
    </CenterPage>
  );
}

function PreviewStage({
  result,
  branding,
  consentText,
  onRetake,
  onSaveToDevice,
  onSend,
}: {
  result: { blob: Blob; mimeType: string; mediaType: 'video' | 'photo' };
  branding: Branding;
  consentText: string;
  onRetake: () => void;
  onSaveToDevice: () => void;
  onSend: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(result.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result.blob]);

  return (
    <CenterPage>
      <BrandingHeader branding={branding} compact />
      <div className="w-full max-w-xs aspect-[9/16] overflow-hidden rounded-lg bg-black">
        {url && result.mediaType === 'video' && (
          <video
            src={url}
            autoPlay
            loop
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
        )}
        {url && result.mediaType === 'photo' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Captured photo preview"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button variant="outline" onClick={onRetake}>
          Retake
        </Button>
        <Button variant="outline" onClick={onSaveToDevice}>
          Save to device
        </Button>
        <p className="px-2 text-center text-xs text-muted-foreground">
          {consentText}
        </p>
        <Button
          onClick={onSend}
          className="rounded-md px-8 py-3 text-base font-medium text-white"
          style={{ backgroundColor: branding.accentColor }}
        >
          Send to {branding.businessName}
        </Button>
      </div>
    </CenterPage>
  );
}

function downloadBlob(blob: Blob, businessName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ext = blob.type.startsWith('video/mp4')
    ? 'mp4'
    : blob.type.startsWith('video/webm')
      ? 'webm'
      : blob.type.startsWith('image/png')
        ? 'png'
        : 'jpg';
  a.href = url;
  a.download = `kollab-${businessName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
