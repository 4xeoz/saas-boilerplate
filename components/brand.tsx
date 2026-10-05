import Link from "next/link";
import { appName } from "@/lib/site";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label={`${appName} home`}>
      <span className="brand-mark">{appName.charAt(0).toUpperCase()}</span>
      <span style={{ color: dark ? "white" : "var(--ink)" }}>{appName}</span>
    </Link>
  );
}
