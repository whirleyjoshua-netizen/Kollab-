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

  // Consent text shown above the Send button.
  const consentText = useMemo(
    () => renderConsentText(branding.businessName),
    [branding.businessName]
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
        onStart={() => {
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
            const thumb = await captureThumbnail(recorder.result.blob, 0.1);
            await upload.upload({
              qrCodeId,
              blob: recorder.result.blob,
              mimeType: recorder.result.mimeType,
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
                const thumb = await captureThumbnail(recorder.result.blob, 0.1);
                await upload.upload({
                  qrCodeId,
                  blob: recorder.result.blob,
                  mimeType: recorder.result.mimeType,
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
  onStart,
  showStartButton,
}: {
  recorder: ReturnType<typeof useRecorder>;
  branding: Branding;
  onStart: () => void;
  showStartButton: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    recorder.attachPreview(videoRef.current);
    return () => recorder.attachPreview(null);
  }, [recorder]);

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
        <button
          type="button"
          onClick={onStart}
          aria-label="Start recording"
          className="h-20 w-20 rounded-full bg-white border-4 flex items-center justify-center active:scale-95 transition-transform"
          style={{ borderColor: branding.accentColor }}
        >
          <span
            className="h-12 w-12 rounded-full"
            style={{ backgroundColor: branding.accentColor }}
          />
        </button>
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
  result: { blob: Blob; mimeType: string };
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
        {url && (
          <video
            src={url}
            autoPlay
            loop
            playsInline
            muted={false}
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
  const ext = blob.type.startsWith('video/mp4') ? 'mp4' : 'webm';
  a.href = url;
  a.download = `kollab-${businessName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
