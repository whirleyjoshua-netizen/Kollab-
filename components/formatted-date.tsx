'use client';

import { useEffect, useState } from 'react';

type FormattedDateProps = {
  isoString: string;
  options: Intl.DateTimeFormatOptions;
  fallback?: string;
  className?: string;
};

/**
 * Renders a Date string in the user's local timezone and locale.
 *
 * Why this exists: `toLocaleDateString` / `toLocaleString` produce different
 * output on the server (UTC / en-US) vs the client (user's timezone / locale),
 * which crashes React hydration with error #418. By deferring formatting to
 * a useEffect, the server renders the fallback, the client hydrates with the
 * same fallback, and the real formatted date appears on the next paint.
 */
export function FormattedDate({ isoString, options, fallback = '', className }: FormattedDateProps) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    setLabel(new Date(isoString).toLocaleString(undefined, options));
  }, [isoString, options]);

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
