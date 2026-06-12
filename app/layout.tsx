import type { Metadata } from "next";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "Faraday Construction — Colorado Roofing, Solar & Hail Damage Experts",
    template: "%s | Faraday Construction",
  },
  description:
    "Colorado's trusted roofing, hail damage repair, solar installation, and replacement window experts. Free inspections. We handle your insurance claim. Serving the Front Range since 2012.",
  keywords:
    "roofing Colorado, hail damage repair, solar installation Colorado, replacement windows, Front Range roofing, insurance claim roofing, Boulder roofing, Denver roofing",
  authors: [{ name: "Faraday Construction" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site,
    siteName: "Faraday Construction",
    title: "Faraday Construction — Colorado Roofing, Solar & Hail Damage Experts",
    description:
      "Colorado's trusted roofing, hail damage repair, solar installation, and replacement window experts. Free inspections. We handle your insurance claim.",
  },
  twitter: {
    card: "summary",
    title: "Faraday Construction — Colorado Roofing & Hail Experts",
    description: "Free hail damage inspections. We handle your insurance claim. Serving the Front Range since 2012.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: site,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
