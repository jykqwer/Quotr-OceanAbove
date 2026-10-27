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
        // warm night: red channel highest, so nothing reads as cold grey
        abyss: {
          950: "#120e0c",
          900: "#1a1512",
          850: "#221b17",
          800: "#2b221d",
          700: "#3a2f27",
        },
        // slate is remapped to a warm stone ramp so existing text classes go warm
        slate: {
          50: "#fbf6f0",
          100: "#f3e9dc",
          200: "#e6d6c4",
          300: "#d2bda9",
          400: "#b49d88",
          500: "#937c69",
          600: "#735f50",
          700: "#54453a",
          800: "#3d322a",
          900: "#2a221c",
        },
        // copper: routes, links, secondary information
        ocean: {
          200: "#f0d2b6",
          300: "#e4b189",
          400: "#d08f60",
          500: "#b3724a",
          600: "#8e5838",
        },
        // ember: the one thing to click
        sunset: {
          300: "#ffb08a",
          400: "#ff9469",
          500: "#ff7a45",
          600: "#e05b28",
        },
        sand: "#ffc46b",
        lamp: {
          300: "#ffeacf",
          400: "#ffdcb8",
          500: "#f2c096",
        },
        cream: {
          50: "#fdf8f0",
          100: "#f8efe1",
          200: "#eee0cb",
        },
        ink: {
          600: "#6b5748",
          700: "#4a3c31",
          900: "#241c17",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
        display: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      boxShadow: {
        pass: "inset 0 1px 0 0 rgba(255,220,184,0.06)",
        ember: "0 12px 28px -14px rgba(255, 122, 69, 0.9)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // A popover appears in place: opacity only, so the anchored position
        // never shifts by the animation's offset.
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        flow: {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-1200" },
        },
        // The selected city breathes: a star blooms outward and fades.
        star: {
          "0%": { opacity: "0.85", transform: "scale(0.24) rotate(0deg)" },
          "55%": { opacity: "0.4" },
          "100%": { opacity: "0", transform: "scale(1) rotate(45deg)" },
        },
        ripple: {
          "0%": { opacity: "0.45", transform: "scale(0.35)" },
          "100%": { opacity: "0", transform: "scale(1)" },
        },
        stamp: {
          "0%": { opacity: "0", transform: "rotate(-8deg) scale(1.5)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "rotate(-8deg) scale(1)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        rise: "rise 0.24s ease-out both",
        fade: "fade 0.14s ease-out both",
        blink: "blink 1.6s steps(2, end) infinite",
        flow: "flow 1.8s linear infinite",
        star: "star 2.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite",
        ripple: "ripple 2.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite",
        stamp: "stamp 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both",
        glow: "glow 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
