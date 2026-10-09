import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aangan Phone Agent",
  description: "What the phone agent answered, qualified and handed to designers, and what it cost.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
