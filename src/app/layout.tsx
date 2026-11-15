import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "ToyStorey — The Collector's Toy Store", template: "%s · ToyStorey" },
  description:
    "Rare Hot Wheels, Super Treasure Hunts, hobby-grade RC cars and premium collectibles for grown-up collectors.",
};

export const viewport: Viewport = { themeColor: "#141312" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">
        <CartProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
