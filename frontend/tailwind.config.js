/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB', // blue-600
        },
        background: '#F8FAFC',
        sidebar: '#FFFFFF',
        accent: '#6ea8fe',
      },
      fontFamily: {
        // cspell-disable-next-line
        sans: ['Inter', 'system-ui', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
        cardHover: '0 12px 32px 0 rgba(31, 38, 135, 0.22)',
      },
      borderRadius: {
        xl: '22px',
      },
    },
  },
  plugins: [],
};
