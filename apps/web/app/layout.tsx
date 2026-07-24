import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShowGather",
  description: "Live sports presentation viewer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
