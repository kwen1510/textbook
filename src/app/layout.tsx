import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { NavigationFeedback } from "@/components/NavigationFeedback";

const fraunces = Fraunces({ variable: "--font-display", subsets: ["latin"] });
const plexSans = IBM_Plex_Sans({ variable: "--font-sans-custom", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-mono-custom", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Textbook",
  applicationName: "Textbook",
  description: "A private reading and study app for notes, voice transcription, and recall practice.",
};

export const viewport: Viewport = {
  themeColor: "#78350f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <NavigationFeedback />
        {children}
      </body>
    </html>
  );
}
