import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const atriaFont = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atria",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Atria — Modernização digital para clínicas",
    template: "%s · Atria",
  },
  description:
    "Seu novo site, aprovado antes de ir ao ar. Atria moderniza o site da sua clínica e cuida da parte técnica.",
  applicationName: "Atria",
  category: "business",
  keywords: [
    "modernização de site",
    "site para clínicas",
    "prévia de site",
    "Atria",
  ],
  authors: [{ name: "Atria" }],
  creator: "Atria",
  publisher: "Atria",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Atria",
    title: "Atria — Modernização digital para clínicas",
    description:
      "Modernizamos o site da sua clínica, mostramos o resultado antes da publicação e cuidamos de toda a parte técnica.",
  },
  twitter: {
    card: "summary",
    title: "Atria — Modernização digital para clínicas",
    description:
      "Seu novo site, aprovado antes de ir ao ar. Modernização digital para clínicas.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f2fa",
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
