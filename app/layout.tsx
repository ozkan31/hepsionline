import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  ),
  title: {
    default: "hepsionline",
    template: "%s | hepsionline",
  },
  description: "Hepsionline e-ticaret deneyimi",
  openGraph: {
    title: "hepsionline",
    description: "Hepsionline e-ticaret deneyimi",
    siteName: "hepsionline",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${poppins.variable} antialiased`}>{children}</body>
    </html>
  );
}

