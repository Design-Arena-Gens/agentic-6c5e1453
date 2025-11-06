import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Anon Chat",
  description: "Anonymous global chat for everyone",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <h1>Anon Chat</h1>
            <p className="subtitle">Send anonymous messages to everyone online</p>
          </header>
          <main>{children}</main>
          <footer className="footer">Built for instant, anonymous, global chat</footer>
        </div>
      </body>
    </html>
  );
}
