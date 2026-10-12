import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0D12",
        surface: "#121722",
        elevated: "#191F2C",
        primaryText: "#F3F5F8",
        secondaryText: "#98A3B5",
        turquoise: "#21D4D8",
        blue: "#4A8DFF",
        gold: "#F5B942",
        purple: "#8B72F8",
        success: "#26C281",
        warning: "#F0A33A",
        error: "#F06464",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-arabic)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
