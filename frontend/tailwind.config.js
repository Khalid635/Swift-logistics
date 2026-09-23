/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  // Keep the existing hand-written CSS looking exactly as it does now
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
