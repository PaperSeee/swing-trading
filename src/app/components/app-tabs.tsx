"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Backtest" },
  { href: "/live", label: "Live Journal" },
];

export function AppTabs() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 border-b border-foreground/15 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl gap-2 px-3 py-3 sm:px-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                active ? "border-foreground bg-foreground text-background" : "border-foreground/25 bg-background"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
