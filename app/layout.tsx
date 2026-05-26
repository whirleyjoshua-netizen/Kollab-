import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kollab — Real video from the people actually there",
  description:
    "Print a QR code, your guests scan and record up to 30 seconds, you get authentic short-form video in your inbox. For restaurants, weddings, and events.",
  metadataBase: new URL("https://kollabshare.com"),
  openGraph: {
    title: "Kollab — Real video from the people actually there",
    description:
      "Print a QR code, your guests record, you get authentic video in your inbox. No app needed.",
    url: "https://kollabshare.com",
    siteName: "Kollab",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
