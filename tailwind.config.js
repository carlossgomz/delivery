/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F2A24",
        cream: "#F6F3EC",
        leaf: {
          50: "#EEF4EC",
          100: "#D3E4CD",
          400: "#5C8A55",
          600: "#3C6B37",
          800: "#264423"
        },
        clay: {
          100: "#F6E2CE",
          400: "#E0913F",
          600: "#B5701F"
        },
        alert: {
          100: "#FBE3E1",
          600: "#B4392F"
        }
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
