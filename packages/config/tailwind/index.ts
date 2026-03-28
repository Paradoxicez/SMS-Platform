import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "../../packages/ui/src/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
