'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

type InboxEmptyProps = {
  qrCodeId: string;
  customerUrl: string;
};

export function InboxEmpty({ qrCodeId, customerUrl }: InboxEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-dashed bg-white p-8 text-center">
      <div className="text-4xl">📹</div>
      <h2 className="text-xl font-semibold">No videos yet</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Print your QR code and place it where customers can see it — on tables,
        receipts, or windows. When a customer scans and shares a video, it shows
        up here.
      </p>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground break-all">
          Customer page: <code className="font-mono">{customerUrl}</code>
        </p>
        <div className="flex gap-2">
          <a
            href={`/api/qr/${qrCodeId}/pdf?size=letter`}
            download
            className={buttonVariants({ variant: 'outline' })}
          >
            Download QR (Letter)
          </a>
          <a
            href={`/api/qr/${qrCodeId}/pdf?size=a4`}
            download
            className={buttonVariants({ variant: 'outline' })}
          >
            Download QR (A4)
          </a>
        </div>
        <Link
          href={customerUrl}
          target="_blank"
          className="text-sm underline text-muted-foreground"
        >
          Preview the customer experience →
        </Link>
      </div>
    </div>
  );
}
