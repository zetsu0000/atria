import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const atriaFont = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atria",
});

export const metadata: Metadata = {
  title: "Atria — Modernização digital para clínicas",
  description:
    "Seu novo site, aprovado antes de ir ao ar. Atria moderniza o site da sua clínica e cuida da parte técnica.",
  applicationName: "Atria",
  category: "business",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "oklch(1 0 0)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={atriaFont.variable}>
      <body>{children}</body>
    </html>
  );
}
