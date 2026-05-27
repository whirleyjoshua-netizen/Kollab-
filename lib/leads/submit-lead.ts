'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const Schema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z.string().trim().email('Please enter a valid email.').max(200),
  interest: z.enum(['restaurant', 'wedding', 'event', 'other']),
  business_or_event: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type LeadResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

async function hashRequesterIp(): Promise<string | null> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null;
    if (!ip) return null;
    const data = new TextEncoder().encode(ip);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export async function submitLead(formData: FormData): Promise<LeadResult> {
  const parsed = Schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    interest: formData.get('interest'),
    business_or_event: formData.get('business_or_event'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the form.',
    };
  }

  const admin = createAdminClient();
  const ip_hash = await hashRequesterIp();

  const { error } = await admin.from('leads').insert({
    name: parsed.data.name,
    email: parsed.data.email,
    interest: parsed.data.interest,
    business_or_event: parsed.data.business_or_event || null,
    message: parsed.data.message || null,
    source_url: 'https://kollabshare.com',
    ip_hash,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'ok' };
}
