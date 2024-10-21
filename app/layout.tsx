import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { GeistSans } from 'geist/font/sans';
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Vendere Labs",
  description: "Connecting brand and performance in advertising",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <SidebarProvider>
          <div className="flex h-screen">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
