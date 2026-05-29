import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Albertsons Intelligence — Demand Planning",
  description: "Forecast and replenishment workbench for grocery planners.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/forecasts", label: "Forecasts" },
  { href: "/replenishment", label: "Replenishment" },
  { href: "/accuracy", label: "Accuracy" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--border)] bg-[var(--panel)]">
          <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              <span style={{ color: "var(--accent)" }}>Albertsons</span> Intelligence
            </Link>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
