import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Internship Copilot — Your next chapter starts here", description: "A thoughtful companion for your internship search." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
