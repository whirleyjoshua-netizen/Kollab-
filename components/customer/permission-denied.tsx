'use client';

import { Button } from '@/components/ui/button';

type PermissionDeniedProps = {
  onRetry: () => void;
};

export function PermissionDenied({ onRetry }: PermissionDeniedProps) {
  return (
    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
      <h2 className="text-xl font-semibold">Camera access needed</h2>
      <p className="text-sm text-muted-foreground">
        We need your camera and mic to record a quick clip. Tap the camera icon in
        your browser's address bar to enable it, or open your phone's browser
        settings.
      </p>
      <p className="text-xs text-muted-foreground">
        On iPhone: Settings → Safari → Camera → Allow.
        On Android: tap the lock icon next to the URL → Site settings → Camera → Allow.
      </p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}
