import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Kollab</h1>
      <p className="text-lg text-muted-foreground">
        Authentic video from the people actually at your tables.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-foreground px-6 py-3 text-background font-medium hover:opacity-90"
      >
        Sign in
      </Link>
    </main>
  );
}
