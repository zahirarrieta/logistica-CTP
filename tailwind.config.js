/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
      },
      colors: {
        brand: {
          cyan: '#00E5FF',
          cyanSoft: '#7bf1ff',
          ink: '#0A0027',
          navy: '#071A3D',
          deep: '#003B73',
          white: '#FFFFFF',
          mist: '#EAF4F7',
          yellow: '#FFD400',
          yellowDark: '#C9A400',
        },
      },
      boxShadow: {
        yellowBottom: '0 8px 0 0 #FFD400',
        cardBlue: '0 16px 0 0 #003B73, 0 12px 24px rgba(0,0,0,0.25)',
        brandGlow: '0 0 24px rgba(0,229,255,0.35), 0 12px 40px rgba(0,0,0,0.35)',
        cyanGlow: '0 0 30px rgba(0,229,255,0.45)',
        soft: '0 10px 30px rgba(0,0,0,0.15)',
      },
      keyframes: {
        slideDown: {
          '40%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.98)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        truckMove: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-2px) rotate(1deg)' },
          '50%': { transform: 'translateY(0) rotate(0deg)' },
          '75%': { transform: 'translateY(-2px) rotate(-1deg)' },
        },
        truckRide: {
          '0%': { left: '-12%', opacity: '0' },
          '8%': { opacity: '1' },
          '45%': { opacity: '1' },
          '92%': { opacity: '1' },
          '100%': { left: 'calc(100% - 64px)', opacity: '0' },
        },
        roadStripes: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '-32px 0' },
        },
      },
      animation: {
        slideDown: 'slideDown 1200ms ease-out both',
        fadeIn: 'fadeIn 600ms ease-out both',
        floatY: 'floatY 3s ease-in-out infinite',
        scaleIn: 'scaleIn 300ms ease-out both',
        shimmer: 'shimmer 2.2s linear infinite',
        truckMove: 'truckMove 0.5s ease-in-out infinite',
        truckRide: 'truckRide 7s linear infinite',
        roadStripes: 'roadStripes 0.9s linear infinite',
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        'brand-radial': 'radial-gradient(1200px 700px at 10% 10%, rgba(0,229,255,0.12), transparent 60%), radial-gradient(1000px 600px at 90% 20%, rgba(3,59,115,0.40), transparent 60%)',
        'brand-diagonal': 'linear-gradient(135deg, #0A0027 0%, #071A3D 50%, #003B73 100%)',
        'hero-dark': 'radial-gradient(1600px 900px at 15% 110%, rgba(0,229,255,0.14), transparent 55%), linear-gradient(160deg, #0A0027 0%, #071A3D 55%, #003B73 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}


