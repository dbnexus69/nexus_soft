import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { limpiarClavesViejas } from './utils/limpiarClavesViejas'

// Antes de montar nada: lo que quedó guardado con la marca anterior no lo va a
// leer nadie, y entre ello hay tokens.
limpiarClavesViejas()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)