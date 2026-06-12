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
        brand: {
          amber: "#f59e0b",
          dark: "#0a0a0f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
