import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Roof Inspection — Faraday Construction",
  description: "Faraday Construction does FREE hail damage inspections in Colorado. Insurance usually covers 100%. Call (720) 766-1518 or request online.",
  robots: { index: false, follow: false },
};

export default function LSALayout({ children }: { children: React.ReactNode }) {
  return children;
}
