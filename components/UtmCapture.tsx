"use client";

import { useEffect } from "react";
import { captureUtm } from "@/lib/utm";

export default function UtmCapture() {
  useEffect(() => { captureUtm(); }, []);
  return null;
}
