import Link from 'next/link';

const KOLLAB_ACCENT = '#FF5C39';

export default function HomePage() {
  return (
    <main className="bg-[#FAFAFA] text-[#0F172A]">
      <Nav />
      <Hero />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}

// ---------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-[#FAFAFA]/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-6 lg:px-10 py-1">
        <Link href="/" className="flex items-center" aria-label="Kollabshare home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Kollabshare"
            className="h-16 sm:h-20 w-auto"
            style={{ mixBlendMode: 'multiply' }}
          />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-[#475569]">
          <a href="#how-it-works" className="hover:text-[#0F172A] transition-colors">How it works</a>
          <a href="#who-its-for" className="hover:text-[#0F172A] transition-colors">Who it&apos;s for</a>
          <a href="#pricing" className="hover:text-[#0F172A] transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-2 rounded-md hover:bg-zinc-100 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-2 rounded-md text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: KOLLAB_ACCENT }}
          >
            Get Kollab
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16 lg:pt-14 lg:pb-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,1fr] lg:items-center">
          {/* Copy */}
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-[#475569]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: KOLLAB_ACCENT }}
              />
              Now live for restaurants & weddings
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Real video from the people <span style={{ color: KOLLAB_ACCENT }}>actually there.</span>
            </h1>

            <p className="text-lg text-[#475569] max-w-xl leading-relaxed">
              Print a QR code on your table or welcome sign. Your guests scan,
              record up to 30 seconds, and you get authentic short-form video
              straight to your inbox. No app to install. No effort.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
                style={{ backgroundColor: KOLLAB_ACCENT }}
              >
                Get started — it&apos;s $0 to set up
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-6 py-3 text-base font-medium text-[#0F172A] transition-colors hover:bg-zinc-100"
              >
                See how it works
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-[#475569]">
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5" style={{ color: KOLLAB_ACCENT }} />
                No app install
              </span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5" style={{ color: KOLLAB_ACCENT }} />
                Vertical video, 30s
              </span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5" style={{ color: KOLLAB_ACCENT }} />
                Works on any phone
              </span>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative aspect-[3/4] sm:aspect-[4/5] lg:aspect-[3/4] w-full max-w-lg lg:max-w-none mx-auto rounded-2xl overflow-hidden bg-zinc-200 ring-1 ring-zinc-200 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero.jpg"
              alt="Guests recording vertical videos at a restaurant event"
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-xs rounded-xl bg-white/95 backdrop-blur p-4 shadow-lg ring-1 ring-zinc-200">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: KOLLAB_ACCENT }}
                >
                  QR
                </div>
                <div className="text-sm">
                  <div className="font-semibold">Scan → record → send</div>
                  <div className="text-xs text-[#475569]">~12 seconds from scan to sent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// How It Works
// ---------------------------------------------------------------------

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Set up in 2 minutes',
      body: 'Upload your logo, pick an accent color, write a one-line call-to-action. We generate a print-ready QR code (Letter or A4) you can put anywhere.',
    },
    {
      n: '02',
      title: 'Your guests scan & record',
      body: 'They tap the QR with their phone camera, get your branded page, and record up to 30 seconds. Front or back camera. No app to install.',
    },
    {
      n: '03',
      title: 'Videos land in your inbox',
      body: 'Every clip arrives with a thumbnail, ready to play, download, or post. Mark favorites, archive what you skip, share to socials.',
    },
  ];

  return (
    <section id="how-it-works" className="border-t border-zinc-200 bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl leading-tight">
            From a printed QR to a video in your inbox in under a minute.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-6 flex flex-col gap-3"
            >
              <span
                className="text-xs font-mono font-bold"
                style={{ color: KOLLAB_ACCENT }}
              >
                {s.n}
              </span>
              <h3 className="text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="text-[#475569] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Use Cases
// ---------------------------------------------------------------------

function UseCases() {
  return (
    <section id="who-its-for" className="border-t border-zinc-200 bg-[#FAFAFA] py-14 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
            Who it&apos;s for
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-3xl leading-tight">
            Built for the moments people want to share.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <UseCaseCard
            label="For restaurants"
            title="Turn your diners into your social team."
            bullets={[
              'Get a steady stream of POV food shots, vibes, and "you had to be there" clips',
              'Way more authentic than influencer content, way cheaper than a videographer',
              "Post to TikTok, Reels, Yelp — all the angles you didn't have time to capture",
            ]}
          />
          <UseCaseCard
            label="For weddings"
            title="Every angle, from every guest, all in one place."
            bullets={[
              'Place QRs at the welcome sign, every table, the bar — your guests do the rest',
              'Capture moments your videographer missed: dance floor, vows-from-the-back-row, kid POV',
              'One downloadable folder of all the footage, ready to make into a highlight reel',
            ]}
          />
        </div>

        <p className="mt-8 text-center text-sm text-[#475569]">
          Also great for concerts · sports games · conferences · launches · festivals · venues
        </p>
      </div>
    </section>
  );
}

function UseCaseCard({
  label,
  title,
  bullets,
}: {
  label: string;
  title: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 flex flex-col gap-4">
      <span
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: KOLLAB_ACCENT }}
      >
        {label}
      </span>
      <h3 className="text-2xl font-extrabold tracking-tight leading-snug">{title}</h3>
      <ul className="flex flex-col gap-3 mt-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-3 text-[#0F172A]">
            <CheckIcon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: KOLLAB_ACCENT }} />
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------

function Pricing() {
  return (
    <section id="pricing" className="border-t border-zinc-200 bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl leading-tight">
            Simple. Pay how you use it.
          </h2>
          <p className="text-[#475569] mt-4 max-w-xl">
            Monthly for places that collect every day. One-time for events that happen once.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-8">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-xl font-bold tracking-tight">Restaurants</h3>
              <span className="text-xs text-[#475569]">monthly</span>
            </div>
            <p className="text-sm text-[#475569] mb-6">
              For places that collect content month after month.
            </p>
            <PriceRow name="Starter" price="$39" sub="/mo" desc="One location, unlimited submissions" />
            <PriceRow name="Pro" price="$79" sub="/mo" desc="Auto-stitched compilations, watermark-free" highlight />
            <PriceRow name="Business" price="$149" sub="/mo" desc="Multi-location, per-location QRs, analytics" />
          </div>

          <div
            className="rounded-2xl border-2 p-8"
            style={{ borderColor: KOLLAB_ACCENT, backgroundColor: '#FFF5F2' }}
          >
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-xl font-bold tracking-tight">Weddings &amp; Events</h3>
              <span className="text-xs font-semibold" style={{ color: KOLLAB_ACCENT }}>
                one-time
              </span>
            </div>
            <p className="text-sm text-[#475569] mb-6">
              Pay once per event. Footage is yours forever.
            </p>
            <PriceRow name="Starter" price="$99" sub="/event" desc="Up to 150 submissions, 30-day inbox" />
            <PriceRow name="Plus" price="$199" sub="/event" desc="Custom QR design, 90-day inbox, highlight reel" highlight />
            <PriceRow name="Premium" price="$299" sub="/event" desc="Priority support, 1-year storage, no watermark" />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-[#475569]">
          Have a different event in mind?{' '}
          <a href="mailto:hello@kollabshare.com" className="underline hover:text-[#0F172A]">
            Tell us about it
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function PriceRow({
  name,
  price,
  sub,
  desc,
  highlight,
}: {
  name: string;
  price: string;
  sub: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-4 border-t border-zinc-200 first:border-t-0"
      style={highlight ? { backgroundColor: 'rgba(255, 92, 57, 0.06)', borderRadius: 8 } : undefined}
    >
      <div className="flex flex-col">
        <span className="font-semibold flex items-center gap-2">
          {name}
          {highlight && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: KOLLAB_ACCENT }}
            >
              Most chosen
            </span>
          )}
        </span>
        <span className="text-xs text-[#475569] mt-0.5">{desc}</span>
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-2xl font-extrabold tracking-tight">{price}</span>
        <span className="text-sm text-[#475569]">{sub}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------

function FinalCta() {
  return (
    <section className="border-t border-zinc-200 bg-[#0F172A] text-white py-14 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center flex flex-col items-center gap-5">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl leading-tight">
          The next moment your guests share, you should own it.
        </h2>
        <p className="text-base text-zinc-300 max-w-xl">
          Set up a QR in two minutes. Pay nothing until you have a customer.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md px-7 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 shadow-lg"
          style={{ backgroundColor: KOLLAB_ACCENT }}
        >
          Get Kollab
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------

function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-[#FAFAFA] py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#475569]">
        <span className="font-bold text-[#0F172A]">Kollab</span>
        <div className="flex items-center gap-6">
          <a href="mailto:hello@kollabshare.com" className="hover:text-[#0F172A] transition-colors">
            hello@kollabshare.com
          </a>
          <Link href="/login" className="hover:text-[#0F172A] transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------

function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
