import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], axes: ["opsz"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Aangan Studio · Phone agent",
  description: "What the phone agent answered, qualified and handed to designers, and what it cost.",
  icons: { icon: "/aangan-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
