import type { Metadata } from "next";
import { Alegreya, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const serif = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daggerheart Dashboard",
  description: "Dashboard responsivo para fichas de personagem e painel do mestre em Daggerheart.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>{children}</body>
    </html>
  );
}
