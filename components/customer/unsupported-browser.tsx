'use client';

import type { BrowserSupport } from '@/lib/recorder/browser-support';

type UnsupportedBrowserProps = {
  reason: Exclude<BrowserSupport, { kind: 'ok' }>;
};

export function UnsupportedBrowser({ reason }: UnsupportedBrowserProps) {
  const message =
    reason.kind === 'no-mediadevices'
      ? "Your browser can't access the camera."
      : reason.kind === 'no-mediarecorder'
        ? "Your browser doesn't support video recording."
        : "Your browser can't record video in a supported format.";

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
      <h2 className="text-xl font-semibold">Update your browser</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        Try opening this page in Safari (iPhone) or Chrome (Android). On older
        phones, update your iOS or Chrome to the latest version.
      </p>
    </div>
  );
}
