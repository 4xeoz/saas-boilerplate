import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Northstar";

export const metadata: Metadata = {
  title: { default: `${appName} — a calm workspace for growing teams`, template: `%s · ${appName}` },
  description: "A clean, secure SaaS foundation for teams that want their work in one place.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
