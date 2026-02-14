export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/ui/**/*.{tsx,ts,js,jsx}"
  ],
  theme: {
    extend: {
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
  presets: [require("./src/ui/tailwind.config.js")]
}
