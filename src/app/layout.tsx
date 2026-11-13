import type { Metadata } from "next";
import { Inter, Montserrat, Nunito, Playfair_Display, Poppins, Roboto_Slab } from "next/font/google";
import "./globals.css";

// Fontes da interface (Inter) e das camadas de texto. As variáveis CSS são
// lidas pelo desenho em Canvas para usar a mesma família.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-poppins", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], variable: "--font-roboto-slab", display: "swap" });

export const metadata: Metadata = {
  title: "Store Shots",
  description: "Crie as imagens da App Store e da Play Store a partir dos prints do seu app.",
};

// Aplica o tema salvo antes da primeira pintura (evita piscar claro → escuro).
const themeScript = `try{var t=localStorage.getItem("store-shots:theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [inter, poppins, montserrat, nunito, playfair, robotoSlab].map((f) => f.variable).join(" ");
  return (
    <html lang="pt-BR" className={fonts} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
