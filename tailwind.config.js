/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f4ee",
        surface: "#ffffff",
        elevated: "#faf9f5",
        border: "#e8e5dc",
        "border-strong": "#d8d4c5",
        muted: "#8a857a",
        text: "#2c2c2c",
        accent: "#cc785c",
        "accent-deep": "#b8634d",
        protein: "#7a8b5a",
        carbs: "#c89f4a",
        fat: "#b8634d",
      },
      fontFamily: {
        serif: ["Charter", "Iowan Old Style", "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "Segoe UI",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(60,55,40,0.04)",
        sheet: "0 -8px 32px rgba(60,55,40,0.12)",
      },
    },
  },
  plugins: [],
};
