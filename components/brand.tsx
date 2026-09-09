import Link from "next/link";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Northstar home">
      <span className="brand-mark">N</span>
      <span style={{ color: dark ? "white" : "var(--ink)" }}>{process.env.NEXT_PUBLIC_APP_NAME || "Northstar"}</span>
    </Link>
  );
}
