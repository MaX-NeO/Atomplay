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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen overflow-x-hidden`}
      >
        {/* Decorative animated background orbs — fixed, sit behind all content */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div
            className="absolute -top-40 -left-32 h-[520px] w-[520px] animate-float-slow opacity-70 blur-[90px]"
            style={{ background: "radial-gradient(circle, oklch(0.69 0.27 350 / 0.5), transparent 70%)" }}
          />
          <div
            className="absolute top-1/3 -right-40 h-[560px] w-[560px] animate-float opacity-55 blur-[100px]"
            style={{ background: "radial-gradient(circle, oklch(0.55 0.26 345 / 0.45), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-48 left-1/3 h-[480px] w-[480px] animate-float-slow opacity-45 blur-[90px]"
            style={{ background: "radial-gradient(circle, oklch(0.65 0.24 355 / 0.4), transparent 70%)" }}
          />
          <div
            className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 animate-float opacity-30 blur-[100px]"
            style={{ background: "radial-gradient(circle, oklch(0.72 0.25 355 / 0.35), transparent 70%)" }}
          />
        </div>
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
