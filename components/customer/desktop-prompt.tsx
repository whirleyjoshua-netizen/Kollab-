'use client';

import { Button } from '@/components/ui/button';

type DesktopPromptProps = {
  onContinueAnyway: () => void;
};

export function DesktopPrompt({ onContinueAnyway }: DesktopPromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
      <h2 className="text-xl font-semibold">Open this on your phone</h2>
      <p className="text-sm text-muted-foreground">
        This works best on a phone with a camera. Open this URL on your phone,
        or scan the QR code from your table again.
      </p>
      <Button onClick={onContinueAnyway} variant="outline" size="sm">
        I have a webcam — continue anyway
      </Button>
    </div>
  );
}
