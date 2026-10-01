import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        archivo: ['"Archivo Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Suplist landing palette: logo navy and blue on cool steel neutrals.
        sl: {
          ink: "#14202E",
          paper: "#F3F5F7",
          line: "#D6DCE3",
          steel: "#5A6775",
          mist: "#E9EDF1",
          brand: "#1F6FEB",
          "brand-dark": "#1857C4",
          found: "#3D5A78",
          provided: "#9A5B0E",
          verified: "#1C7547",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        atlantic: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fb",
          400: "#36a9f7",
          500: "#0c8de9",
          600: "#006ec7",
          700: "#0158a3",
          800: "#064b86",
          900: "#0b3f6f",
          950: "#07284a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
