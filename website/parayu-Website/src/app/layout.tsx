import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Parayu — Speak Naturally. Paste System-Wide. 100% Offline.",
    template: "%s | Parayu",
  },
  description: "Powered by a custom-made on-device AI engine, Parayu translates spoken Malayalam or English slang to clean, polished English text—with 100% offline security. Download natively for macOS and Windows. iOS and Android apps are in active development.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    url: "https://parayu.online",
    title: "Parayu — Speak Naturally. Paste System-Wide. 100% Offline.",
    description: "Powered by a custom-made on-device AI engine, Parayu translates spoken Malayalam or English slang to clean, polished English text—with 100% offline security. Download natively for macOS and Windows. iOS and Android apps are in active development.",
    images: [
      {
        url: "/logo-thumbnail.png",
        width: 150,
        height: 150,
        alt: "Parayu logo",
      }
    ],
  },
  twitter: {
    card: "summary",
    title: "Parayu — Speak Naturally. Paste System-Wide. 100% Offline.",
    description: "Powered by a custom-made on-device AI engine, Parayu translates spoken Malayalam or English slang to clean, polished English text—with 100% offline security. Download natively for macOS and Windows. iOS and Android apps are in active development.",
    images: ["/logo-thumbnail.png"],
  },
};

import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        inter.variable,
        outfit.variable,
        "h-full antialiased"
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" theme="dark" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
