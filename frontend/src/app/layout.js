import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { WebSocketProvider } from "@/context/WebSocketContext";

export const metadata = {
  title: "Social Network",
  description: "A framework-free Go and Next.js Social Network",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <main className="container">
          <WebSocketProvider>
            <AppShell>{children}</AppShell>
          </WebSocketProvider>
        </main>
      </body>
    </html>
  );
}
