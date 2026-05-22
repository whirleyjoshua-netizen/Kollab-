'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveBusinessBasics, type Step1Result } from './actions';

type Step1FormProps = {
  defaults: {
    business_name: string;
    cta_text: string | null;
    accent_color: string;
  };
};

export function Step1Form({ defaults }: Step1FormProps) {
  const [result, setResult] = useState<Step1Result | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await saveBusinessBasics(formData);
          setResult(r);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          required
          maxLength={80}
          defaultValue={defaults.business_name}
          placeholder="Bella's Italian"
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cta_text">Call to action (optional)</Label>
        <Input
          id="cta_text"
          name="cta_text"
          maxLength={120}
          defaultValue={defaults.cta_text ?? ''}
          placeholder="Share up to 30 seconds of your experience at Bella's"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Shown above the recording button on your customer landing page.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="accent_color">Accent color</Label>
        <div className="flex items-center gap-3">
          <Input
            id="accent_color"
            name="accent_color"
            type="color"
            required
            defaultValue={defaults.accent_color}
            disabled={isPending}
            className="h-10 w-16 cursor-pointer p-1"
          />
          <p className="text-xs text-muted-foreground">
            Used for the primary button on your customer page.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Continue'}
      </Button>

      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}
