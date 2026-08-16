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
  // Inline script that runs BEFORE React hydration: reads the persisted theme
  // from localStorage and applies the `dark` class to <html>. This prevents:
  //   1. A flash of the wrong theme (FOUC) for users with dark mode saved.
  //   2. A React hydration mismatch — the store still initializes with
  //      `theme: 'light'` on both server and client, so the rendered icon
  //      markup matches. Only the <html> className differs, which is fine
  //      because <html> already has `suppressHydrationWarning`.
  const themeScript = `(() => {
    try {
      const raw = localStorage.getItem('quiz-app-state');
      const t = raw && JSON.parse(raw).theme === 'dark' ? 'dark' : 'light';
      if (t === 'dark') document.documentElement.classList.add('dark');
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
