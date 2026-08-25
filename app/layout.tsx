import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { LoginData } from "@/src/context/LoginData";
import { SocketProvider } from "@/src/context/SocketContext";
import { ThemeRegistry, themeNoFlashScript } from "@/src/theme/ThemeRegistry";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Toaster } from "react-hot-toast";
import { toastConfig } from "@/src/toastConfig";
import { FavoriteProvider } from "@/src/contexts/FavoriteContext";
import { RemoveInGroupProvider } from "@/src/contexts/RemoveInGroupContext";
import { GroupAdminModeProvider } from "@/src/contexts/GroupAdminModeContext";
import { GroupSocketProvider } from "@/src/contexts/GroupSocketContext";
import { NotificationProvider } from "@/src/contexts/NotificationContext";
import { TagsProvider } from "@/src/contexts/TagsContexts";
import { ArchieveProvider } from "@/src/contexts/ArchieveContext";
import PreHydrationLoaderMount from "@/src/components/PreHydrationLoader/PreHydrationLoaderMount";
import { preHydrationLoaderHTML } from "@/src/components/PreHydrationLoader/PreHydrationLoader";

export const metadata: Metadata = {
  title: "TecoChat",
  description: "WhatsApp Chat Module",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TecoChat",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

// Next.js 16 viewport config (separate export).
// viewport-fit=cover enables safe-area-inset on notched devices.
// maximum-scale=1 + user-scalable=no gives an app-like feel (no pinch zoom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161622" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set data-theme before hydration to prevent a flash of the wrong theme */}
        <Script
          id="theme-no-flash"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeNoFlashScript }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: preHydrationLoaderHTML }} />
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <PreHydrationLoaderMount />
            <LoginData>
              <SocketProvider>
                <FavoriteProvider>
                  <RemoveInGroupProvider>
                    <GroupAdminModeProvider>
                      <GroupSocketProvider>
                        <NotificationProvider>
                          <TagsProvider>
                            <ArchieveProvider>
                              {children}
                              <Toaster {...toastConfig} />
                            </ArchieveProvider>
                          </TagsProvider>
                        </NotificationProvider>
                      </GroupSocketProvider>
                    </GroupAdminModeProvider>
                  </RemoveInGroupProvider>
                </FavoriteProvider>
              </SocketProvider>
            </LoginData>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
