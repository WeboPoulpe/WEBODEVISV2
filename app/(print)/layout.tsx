/** Minimal layout for print pages — no AppShell, no sidebar, no header. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-white min-h-screen">{children}</div>;
}
