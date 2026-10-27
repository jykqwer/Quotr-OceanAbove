import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        abyss: {
          950: "#050d16",
          900: "#07131f",
          850: "#0a1a28",
          800: "#0d2131",
          700: "#123043",
        },
        ocean: {
          300: "#7ce8dd",
          400: "#3fd6c6",
          500: "#16b8a8",
          600: "#0f9488",
        },
        sand: "#f2c078",
      },
      boxShadow: {
        card: "0 20px 60px -30px rgba(0, 0, 0, 0.9)",
        glow: "0 0 0 1px rgba(63, 214, 198, 0.25), 0 18px 45px -25px rgba(22, 184, 168, 0.55)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        rise: "rise 0.28s ease-out both",
        pulseSoft: "pulseSoft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
