import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WaferGuard · Fab Yield & Quality Monitor",
  description: "Pre-run wafer lot yield prediction, defect analysis, and root-cause prevention",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
