import type { Config } from "tailwindcss";

// Color tokens are copied verbatim from docs/design/DESIGN_SYSTEM.md.
// These hex values are locked — do not change without updating the design doc.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#9fe870",
        "primary-hover": "#cdffad",
        "primary-pale": "#e2f6d5",
        canvas: "#ffffff",
        "canvas-soft": "#e8ebe6",
        ink: "#0e0f0c",
        body: "#454745",
        mute: "#868685",
        positive: "#2ead4b",
        warning: "#ffd11a",
        negative: "#d03238",
        line: "#e2e8e0",
        // dark theme
        "d-canvas": "#1f221c",
        "d-canvas-soft": "#14150f",
        "d-ink": "#f6f7f3",
        "d-body": "#b8bab5",
        "d-mute": "#868685",
        "d-line": "#2a2c27",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "24px",
      },
      keyframes: {
        fadein: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scalein: {
          from: { opacity: "0", transform: "scale(.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        pulsegreen: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".35" },
        },
        indeterm: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
      },
      animation: {
        fadein: "fadein .22s ease-out both",
        scalein: "scalein .18s ease-out both",
        pulsegreen: "pulsegreen 1.4s ease-in-out infinite",
        indeterm: "indeterm 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
