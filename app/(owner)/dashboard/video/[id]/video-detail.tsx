'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { StatusBadge } from '@/components/owner/status-badge';
import type { Database } from '@/lib/db/types';
import { getDownloadUrl, softDeleteVideo, updateStatus } from './actions';

const DETAIL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

type Status = Database['public']['Enums']['video_status'];

type VideoDetailProps = {
  video: {
    id: string;
    videoUrl: string;
    mimeType: string;
    durationMs: number | null;
    status: Status;
    createdAt: string;
    locationLabel: string | null;
    consentText: string;
    sizeBytes: number | null;
  };
  businessName: string;
};

export function VideoDetail({ video, businessName }: VideoDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(video.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sizeLabel =
    video.sizeBytes && video.sizeBytes > 0
      ? `${(video.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : null;
  const durationLabel =
    video.durationMs && video.durationMs > 0
      ? `${Math.round(video.durationMs / 1000)}s`
      : null;

  function handleStatusChange(next: Status) {
    setError(null);
    setStatus(next); // optimistic
    startTransition(async () => {
      const result = await updateStatus(video.id, next);
      if (result.status === 'error') {
        setError(result.message);
        setStatus(video.status); // revert
      }
    });
  }

  function handleDelete() {
    if (!confirm('Move this video to trash? You can recover it within 30 days.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await softDeleteVideo(video.id);
      if (result.status === 'error') {
        setError(result.message);
      } else {
        router.push('/dashboard');
      }
    });
  }

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await getDownloadUrl(video.id, businessName);
      if (result.status === 'error') {
        setError(result.message);
      } else {
        // Trigger the download by navigating to the signed URL — it has
        // Content-Disposition: attachment so the browser downloads instead.
        window.location.href = result.data;
      }
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm underline text-muted-foreground">
            ← Inbox
          </Link>
          <StatusBadge status={status} />
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6 md:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={video.videoUrl}
            controls
            playsInline
            className="w-full aspect-[9/16] object-contain"
          />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Submitted</h3>
            <FormattedDate
              isoString={video.createdAt}
              options={DETAIL_DATE_OPTIONS}
              className="text-sm block"
            />
            {video.locationLabel && (
              <p className="text-sm text-muted-foreground">{video.locationLabel}</p>
            )}
            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
              {durationLabel && <span>{durationLabel}</span>}
              {sizeLabel && <span>· {sizeLabel}</span>}
              <span>· {video.mimeType.split(';')[0]}</span>
            </div>
          </div>

          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
            <div className="flex gap-1">
              {(['new', 'saved', 'hidden'] as Status[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={status === s ? 'default' : 'outline'}
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleStatusChange(s)}
                  className="flex-1 capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Actions</h3>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={handleDownload}>
                Download
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={handleDelete} className="text-red-700">
                Delete
              </Button>
            </div>
          </div>

          <details className="rounded-md border bg-white p-4 text-xs">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Consent text shown to customer
            </summary>
            <p className="mt-2 text-muted-foreground">{video.consentText}</p>
          </details>

          {error && <p className="text-sm text-red-700">{error}</p>}
        </aside>
      </div>
    </main>
  );
}
