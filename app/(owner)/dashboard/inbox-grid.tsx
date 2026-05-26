'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedDate } from '@/components/formatted-date';
import { StatusBadge } from '@/components/owner/status-badge';
import type { InboxPage, InboxVideo } from '@/lib/videos/list';
import { loadMoreInbox } from './inbox-actions';

const TILE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

type InboxGridProps = {
  initial: InboxPage;
};

export function InboxGrid({ initial }: InboxGridProps) {
  const [videos, setVideos] = useState<InboxVideo[]>(initial.videos);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function loadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const next = await loadMoreInbox(page + 1);
        setVideos((prev) => [...prev, ...next.videos]);
        setHasMore(next.hasMore);
        setPage((p) => p + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load more');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {videos.map((video) => (
          <InboxTile key={video.id} video={video} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button onClick={loadMore} disabled={isPending} variant="outline">
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-700 text-center">{error}</p>}
    </div>
  );
}

function InboxTile({ video }: { video: InboxVideo }) {
  const durationLabel =
    video.durationMs && video.durationMs > 0
      ? `${Math.round(video.durationMs / 1000)}s`
      : null;

  return (
    <Link
      href={`/dashboard/video/${video.id}`}
      className="group block overflow-hidden rounded-md border bg-black hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[9/16] bg-zinc-900">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            No preview
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={video.status} />
        </div>
        {durationLabel && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {durationLabel}
          </div>
        )}
      </div>
      <div className="p-2 text-xs bg-white text-foreground">
        <FormattedDate
          isoString={video.createdAt}
          options={TILE_DATE_OPTIONS}
          className="truncate block"
        />
        {video.locationLabel && (
          <div className="truncate text-muted-foreground">{video.locationLabel}</div>
        )}
      </div>
    </Link>
  );
}
