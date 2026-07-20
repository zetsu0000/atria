import type { Metadata } from "next";
import "./operacao.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operação",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function OperacaoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="op">{children}</div>;
}
