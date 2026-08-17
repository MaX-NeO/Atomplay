import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atom Play",
  description: "Create interactive MCQ activities and present them live. Mentimeter-style real-time quizzes.",
  keywords: ["quiz", "live", "real-time", "MCQ", "presentation", "audience"],
  authors: [{ name: "Atom Play" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script that runs BEFORE React hydration: unconditionally adds the
  // `dark` class to <html>. The app is dark-only by design — every screen,
  // sheet, and component renders in dark mode. Persisting anything else is a
  // no-op (the ThemeProvider forces `theme: 'dark'` on mount regardless of the
  // stored value), so there's no need to read localStorage here at all. The
  // unconditional `dark` class prevents a flash of the (now-unused) light
  // theme on first paint, and avoids a hydration mismatch because <html> has
  // `suppressHydrationWarning` set below.
  const themeScript = `(() => {
    try {
      document.documentElement.classList.add('dark');
    } catch (_) {}
  })();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
