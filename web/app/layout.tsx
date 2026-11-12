import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChangeProof: check a flood claim against NISAR radar",
  description: "Type a claim about the January 2026 floods in southern Mozambique. ChangeProof checks it against NISAR radar data and says what the data can and cannot support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
