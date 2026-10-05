import type { Metadata } from "next";
import "./globals.css";
import { appName } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: `${appName} — workspaces, team roles and billing.`,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
