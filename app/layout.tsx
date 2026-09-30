import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My AI",
  description: "My personal AI chatbot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
