import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

export const metadata: Metadata = {
  title: "404 · AI Institute Academy",
};

// Rendered for URLs outside every route, where no locale is known, so it speaks every language.
export default function GlobalNotFound() {
  return (
    <html lang="kk" className={`${sourceSans.variable} h-full antialiased`}>
      <body className="flex min-h-full items-center justify-center px-4">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="font-mono text-sm text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">Бет табылмады</h1>
          <p className="text-muted-foreground">Страница не найдена · Page not found · 페이지를 찾을 수 없습니다</p>
          <Link href="/" className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
            AI Institute Academy
          </Link>
        </div>
      </body>
    </html>
  );
}
