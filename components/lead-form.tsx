'use client';

import { useState, useTransition } from 'react';
import { submitLead, type LeadResult } from '@/lib/leads/submit-lead';

const ACCENT = '#FF5C39';

export function LeadForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState<'restaurant' | 'wedding' | 'event' | 'other'>('restaurant');
  const [businessOrEvent, setBusinessOrEvent] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<LeadResult | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result?.status === 'ok') {
    return (
      <div className="rounded-2xl border-2 p-8 text-center flex flex-col items-center gap-3" style={{ borderColor: ACCENT, backgroundColor: '#FFF5F2' }}>
        <div className="text-3xl">🎉</div>
        <h3 className="text-xl font-bold tracking-tight">Got it — talk soon.</h3>
        <p className="text-[#475569] max-w-sm">
          Thanks {name.split(' ')[0] || 'for reaching out'}. We&apos;ll be in touch within a day to set up your Kollab.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await submitLead(formData);
          setResult(r);
        });
      }}
      className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 flex flex-col gap-4"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Your name" htmlFor="name">
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            placeholder="Sarah Chen"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition"
            style={{ ['--tw-ring-color' as string]: ACCENT }}
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            placeholder="you@business.com"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition"
            style={{ ['--tw-ring-color' as string]: ACCENT }}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="I'm interested in Kollab for…" htmlFor="interest">
          <select
            id="interest"
            name="interest"
            required
            value={interest}
            onChange={(e) => setInterest(e.target.value as typeof interest)}
            disabled={isPending}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition cursor-pointer"
            style={{ ['--tw-ring-color' as string]: ACCENT }}
          >
            <option value="restaurant">A restaurant / cafe / bar</option>
            <option value="wedding">A wedding</option>
            <option value="event">Another event or venue</option>
            <option value="other">Something else</option>
          </select>
        </Field>

        <Field label="Business or event name (optional)" htmlFor="business_or_event">
          <input
            id="business_or_event"
            name="business_or_event"
            type="text"
            value={businessOrEvent}
            onChange={(e) => setBusinessOrEvent(e.target.value)}
            disabled={isPending}
            placeholder="Bella's Italian / Sarah & Jake's Wedding"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition"
            style={{ ['--tw-ring-color' as string]: ACCENT }}
          />
        </Field>
      </div>

      <Field label="What do you want to do with this? (optional)" htmlFor="message">
        <textarea
          id="message"
          name="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPending}
          placeholder="Tell us about the event, the volume of guests, or what you're trying to capture."
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-offset-1 transition"
          style={{ ['--tw-ring-color' as string]: ACCENT }}
        />
      </Field>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          style={{ backgroundColor: ACCENT }}
        >
          {isPending ? 'Sending…' : 'Request a demo'}
        </button>
        <p className="text-xs text-[#475569]">
          We&apos;ll reach out within a day. No spam, no auto-pings — just us.
        </p>
      </div>

      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#0F172A]">{label}</span>
      {children}
    </label>
  );
}
