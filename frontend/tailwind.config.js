/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/react-tailwindcss-datepicker/dist/index.esm.js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Los colores del tema llegan en CANALES, no como `var()` pelado.
      //
      // Tailwind 3 construye `bg-primary/10` sustituyendo `<alpha-value>` en el
      // valor del color. Con `"var(--color-primary)"` no hay dónde
      // sustituirlo, así que la clase NO GENERA CSS: no es que se vea
      // atenuada, es que no existe. Eran 183 usos y 44 clases distintas, todas
      // muertas, y cada tipo fallaba de una forma distinta y silenciosa:
      //
      //   border-primary/30  -> sin color declarado, el borde cae a
      //                         `currentColor`: el color del TEXTO. Es la
      //                         "línea blanca tan fuerte" de la matriz de
      //                         permisos, y estaba en 25 sitios más.
      //   ring-primary/20    -> el anillo de foco cae al azul por defecto de
      //                         Tailwind, fuera de la paleta, en 40 sitios.
      //   bg-primary/5       -> ningún fondo.
      //   hover:bg-primary/90-> el hover no cambiaba nada.
      //   shadow-primary/20  -> sombra sin tintar.
      //
      // Con `rgb(var(--primary-rgb) / <alpha-value>)` sí hay dónde sustituir.
      // Los canales se declaran en index.css y el hex se DERIVA de ellos
      // (`--color-primary: rgb(var(--primary-rgb))`), así que el número sigue
      // estando en un solo sitio y el CSS que usa `var(--color-primary)`
      // directamente no se toca.
      colors: {
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          dark: "rgb(var(--primary-dark-rgb) / <alpha-value>)",
          light: "rgb(var(--primary-light-rgb) / <alpha-value>)",
        },
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-dark": "rgb(var(--accent-dark-rgb) / <alpha-value>)",
        // Acento con fuerza para el detalle de venta. Ver el comentario en
        // index.css: el `accent` de la marca es demasiado apagado para énfasis.
        highlight: {
          DEFAULT: "rgb(var(--highlight-rgb) / <alpha-value>)",
          soft: "rgb(var(--highlight-soft-rgb) / <alpha-value>)",
          ink: "rgb(var(--highlight-ink-rgb) / <alpha-value>)",
        },
        // El fondo de la barra de navegación, teñido con la marca de la agencia.
        nav: "rgb(var(--nav-rgb) / <alpha-value>)",
        "gray-light": "rgb(var(--bg-base-rgb) / <alpha-value>)",
        "gray-border": "rgb(var(--border-main-rgb) / <alpha-value>)",
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#dc2626",
      },
      fontFamily: {
        heading: ["Outfit", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
