import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dataFont = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rarity.marscatsvoyage.com"),
  title: "MCV Rarity Hub — trait-weighted rarity for the Mars Cats ecosystem",
  description:
    "Live trait-weighted rarity rankings for 28,000+ tokens across seven Mars Cats Ventures collections on four chains — scores, listings, and trait explorers.",
  openGraph: {
    title: "MCV Rarity Hub",
    description: "Trait-weighted rarity rankings across the Mars Cats Ventures ecosystem — seven collections, three chains, one orbital selector.",
    images: [{ url: "/backdrops/mars-horizon.webp" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} ${dataFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
