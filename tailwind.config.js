/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        prism: {
          bg: "#1a1a2e",
          surface: "#16213e",
          card: "#1c2a4a",
          primary: "#7f5af0",
          accent: "#e45858",
          text: "#fffffe",
          muted: "#94a1b2",
        },
      },
    },
  },
  plugins: [],
};
