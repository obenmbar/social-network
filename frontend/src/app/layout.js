import "./globals.css";

export const metadata = {
  title: "Social Network",
  description: "A framework-free Go and Next.js Social Network",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
