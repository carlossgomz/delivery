import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Delivery",
  description: "Pide en línea, con verificación de disponibilidad en tienda"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-cream text-ink font-sans min-h-screen">{children}</body>
    </html>
  );
}
