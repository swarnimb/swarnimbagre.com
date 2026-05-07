// Admin route group layout.
// Tailwind / shadcn import is deferred to T15 (Phase 2).
// Per design-decisions.md, admin uses Inter / system font — Fraunces and
// JetBrains Mono are public-only signature fonts. No font imports here.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-root">{children}</div>;
}
