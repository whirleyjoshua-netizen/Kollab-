'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendMagicLink, type LoginResult } from './actions';

export function LoginForm() {
  const [result, setResult] = useState<LoginResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await sendMagicLink(formData);
          setResult(r);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          disabled={isPending || result?.status === 'ok'}
        />
      </div>

      <Button type="submit" disabled={isPending || result?.status === 'ok'}>
        {isPending ? 'Sending…' : 'Send sign-in link'}
      </Button>

      {result?.status === 'ok' && (
        <p className="text-sm text-green-700">
          Check {result.email} — your sign-in link is on the way.
        </p>
      )}
      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}
