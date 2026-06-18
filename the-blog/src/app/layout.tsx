import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog · 4629169.xyz",
  description: "Notes from Jared Wideman.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
