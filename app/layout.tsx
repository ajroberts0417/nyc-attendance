import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NYC School Attendance",
  description: "Daily attendance at every NYC public school.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8">
          <header>
            <Link href="/" className="inline-flex flex-col leading-none">
              <span className="font-display text-[22px] font-medium tracking-tight">Attendance</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">NYC Public Schools</span>
            </Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
