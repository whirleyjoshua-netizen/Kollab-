'use client';

import dynamic from 'next/dynamic';

// SSR is disabled because CustomerRecorder needs navigator/window to do
// browser feature detection; rendering it server-side ends up showing the
// SSR'd "loading" or "unsupported" branch and (in this Next 16 + tunneled
// dev setup) hydration was failing to re-run the client effect that fixes
// it. Skipping SSR entirely is the canonical workaround.
export const DynamicCustomerRecorder = dynamic(
  () => import('./customer-recorder').then((m) => m.CustomerRecorder),
  {
    ssr: false,
    loading: () => null,
  }
);
