/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./content.tsx",
    "./options.tsx",
    "./lib/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}

