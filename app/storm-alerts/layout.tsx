import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Hail Alert Signup — Faraday Construction",
  description:
    "Sign up for free instant SMS alerts the moment hail hits your Colorado address. Be first in line for a free roof inspection before claim windows close.",
};

export default function StormAlertsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
