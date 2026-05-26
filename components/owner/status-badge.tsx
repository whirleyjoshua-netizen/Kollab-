import type { Database } from '@/lib/db/types';

type Status = Database['public']['Enums']['video_status'];

const STYLES: Record<Status, { bg: string; fg: string; label: string }> = {
  new: { bg: 'bg-blue-100', fg: 'text-blue-900', label: 'New' },
  saved: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Saved' },
  hidden: { bg: 'bg-zinc-200', fg: 'text-zinc-700', label: 'Hidden' },
};

export function StatusBadge({ status }: { status: Status }) {
  const { bg, fg, label } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${fg}`}
    >
      {label}
    </span>
  );
}
