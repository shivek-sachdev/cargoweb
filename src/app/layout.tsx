import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "OMGEXP Cargo Portal | Specialized Air Freight & Global Logistics",
    template: "%s | OMGEXP Cargo Portal",
  },
  description:
    "OMGEXP Cargo Portal — end-to-end air freight, customs clearance, GDP warehousing, and cold-chain logistics. AI-powered document intelligence for regulated cargo from Thailand.",
  keywords: [
    "air freight Thailand",
    "cargo logistics",
    "customs clearance",
    "pharmaceutical logistics",
    "cold chain transport",
    "OMGEXP",
    "export management",
    "freight forwarder Bangkok",
  ],
  openGraph: {
    title: "OMGEXP Cargo Portal | Specialized Air Freight & Global Logistics",
    description:
      "End-to-end logistics solutions for time-sensitive and temperature-controlled cargo. Air freight, customs, GDP warehousing, and AI document intelligence.",
    siteName: "OMGEXP Cargo Portal",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OMGEXP Cargo Portal",
    description:
      "Specialized air freight and global logistics with AI-powered document intelligence.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
