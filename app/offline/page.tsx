import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="portal-card w-full max-w-xl rounded-[2rem] border border-border/70 bg-card/90 p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
          FM
        </div>
        <p className="portal-chip mt-6 border-primary/20 bg-primary/10 text-primary">Offline mode</p>
        <h1 className="portal-title mt-5 text-4xl font-semibold text-foreground">You are offline right now.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The installed app is still available, but live complaint data and sign-in actions need an internet
          connection. Reconnect and refresh to continue working with the latest civic cases.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Retry portal
          </Link>
        </div>
      </section>
    </main>
  );
}
