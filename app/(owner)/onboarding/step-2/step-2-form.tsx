'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadLogo, type Step2Result } from './actions';

type Step2FormProps = {
  existingLogoUrl: string | null;
};

export function Step2Form({ existingLogoUrl }: Step2FormProps) {
  const [result, setResult] = useState<Step2Result | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingLogoUrl);
  const [hasNewFile, setHasNewFile] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up any object URL we created.
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
          const r = await uploadLogo(formData);
          setResult(r);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="logo">Logo image</Label>
        <Input
          ref={fileInputRef}
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required={!existingLogoUrl}
          disabled={isPending}
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, or WebP. Up to 2 MB. Square images work best.
        </p>
      </div>

      {previewUrl && (
        <div className="flex flex-col items-center gap-2">
          <div className="h-32 w-32 overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Logo preview"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {hasNewFile ? 'New logo preview' : 'Current logo'}
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending || (!hasNewFile && !existingLogoUrl)}>
        {isPending ? 'Uploading…' : 'Continue'}
      </Button>

      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}
