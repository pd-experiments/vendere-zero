import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context"
import { AuthLayout } from "@/components/auth-layout"
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
    <html lang="en" className="dark">
      <body className={`${GeistSans.className} dark:bg-gray-900 dark:text-white`}>
        <AuthProvider>
          <AuthLayout>
            <SidebarProvider>
              <div className="flex h-screen w-[100%]">
                <AppSidebar />
                <div className="flex flex-col flex-1 overflow-hidden w-[100%]">
                  <Header />
                  <main className="flex-1 overflow-auto w-[100%]">
                    {children}
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </AuthLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
