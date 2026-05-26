'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { replaceLogo, type SettingsResult } from './actions';

type LogoFormProps = {
  existingLogoUrl: string | null;
};

export function LogoForm({ existingLogoUrl }: LogoFormProps) {
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingLogoUrl);
  const [hasNewFile, setHasNewFile] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setHasNewFile(false);
      setPreviewUrl(existingLogoUrl);
      return;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setHasNewFile(true);
    setResult(null);
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await replaceLogo(formData);
          setResult(r);
          if (r.status === 'ok') {
            setHasNewFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        {previewUrl ? (
          <div className="h-24 w-24 overflow-hidden rounded-md border bg-muted shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Logo"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-24 w-24 rounded-md border bg-muted shrink-0 flex items-center justify-center text-xs text-muted-foreground">
            No logo
          </div>
        )}

        <div className="flex flex-col gap-2 flex-1">
          <Label htmlFor="logo">Replace logo</Label>
          <Input
            ref={fileInputRef}
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isPending}
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, or WebP. Up to 2 MB.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || !hasNewFile}>
          {isPending ? 'Uploading…' : 'Save logo'}
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
