import type { Metadata } from "next";
import { Instrument_Serif, Space_Grotesk, Space_Mono } from "next/font/google";
import "./styles/colors_and_type.css";
import "./styles/base.css";
import "./styles/public.css";
import "./styles/public-home.css";
import "./styles/public-projects.css";
import "./styles/public-writing.css";
import "./styles/public-other.css";

// T46: Instrument Serif (display) + Space Grotesk (body/UI) + Space Mono
// (kickers, dates, tile labels). next/font self-hosts these, so there is no
// runtime request to Google and no render-blocking @import.
//
// Instrument Serif and Space Mono are not variable fonts, so next/font
// requires an explicit weight. Space Grotesk is variable and does not.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument-serif",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Swarnim Bagre",
  description: "Personal site: projects, writing, and assorted hobby stats.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The font variables go on <html>, not <body>. colors_and_type.css composes
  // them into --font-sans / --font-serif / --font-mono at :root, and a custom
  // property is substituted where it is DECLARED, not where it is used. With
  // the classes on <body>, every composed family resolved to the
  // guaranteed-invalid value at :root, which silently invalidated every `font:`
  // shorthand on the site and fell back to Times New Roman.
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
