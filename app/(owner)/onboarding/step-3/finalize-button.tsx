'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { finalizeOnboarding, type FinalizeResult } from './actions';

export function FinalizeButton() {
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button
        onClick={() =>
          startTransition(async () => {
            const r = await finalizeOnboarding();
            setResult(r);
          })
        }
        disabled={isPending}
      >
        {isPending ? 'Finishing…' : 'Go to dashboard'}
      </Button>
      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </>
  );
}
