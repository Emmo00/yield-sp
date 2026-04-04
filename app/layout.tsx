import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BizMarket Vault",
  description:
    "Fixed-term stablecoin investment vault with clear maturity and withdrawal states.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
