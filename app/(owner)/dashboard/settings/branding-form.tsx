'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateBranding, type SettingsResult } from './actions';

type BrandingFormProps = {
  defaults: {
    business_name: string;
    cta_text: string | null;
    accent_color: string;
  };
};

export function BrandingForm({ defaults }: BrandingFormProps) {
  const [businessName, setBusinessName] = useState(defaults.business_name);
  const [ctaText, setCtaText] = useState(defaults.cta_text ?? '');
  const [accentColor, setAccentColor] = useState(defaults.accent_color);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await updateBranding(formData);
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
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cta_text">Call to action</Label>
        <Input
          id="cta_text"
          name="cta_text"
          maxLength={120}
          value={ctaText}
          onChange={(e) => setCtaText(e.target.value)}
          placeholder="Share up to 30 seconds of your experience"
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
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            disabled={isPending}
            className="h-10 w-16 cursor-pointer p-1"
          />
          <code className="text-xs text-muted-foreground font-mono">
            {accentColor}
          </code>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save branding'}
        </Button>
        {result?.status === 'ok' && (
          <p className="text-sm text-green-700">{result.message}</p>
        )}
        {result?.status === 'error' && (
          <p className="text-sm text-red-700">{result.message}</p>
        )}
      </div>
    </form>
  );
}
