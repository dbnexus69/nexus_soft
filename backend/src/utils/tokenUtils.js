const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateToken(payload, remember = false) {
  const expiresIn = remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn;
  return jwt.sign(payload, env.jwtSecret, { expiresIn });
}

/**
 * Un token con caducidad propia, en segundos.
 *
 * Lo usa la suplantación: entrar en una agencia para dar soporte no puede durar
 * lo que dura una sesión normal. Que caduque sola es lo que impide que olvidarse
 * de salir equivalga a un acceso permanente.
 */
function generateTokenConCaducidad(payload, segundos) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: segundos });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/**
 * Sin "recordarme", la sesión caduca tras este tiempo SIN ACTIVIDAD: el
 * middleware de auth la renueva mientras se usa (ver `auth.js`). Antes eran 30
 * minutos fijos desde el login, y quien llevaba media hora trabajando se
 * quedaba fuera a mitad de una venta.
 */
const VENTANA_INACTIVIDAD_MS = 30 * 60 * 1000;

const DURACION_RECORDAR_MS = 7 * 24 * 60 * 60 * 1000;

function getExpiryTime(remember = false) {
  const ms = remember ? DURACION_RECORDAR_MS : VENTANA_INACTIVIDAD_MS;
  return Date.now() + ms;
}

/**
 * La sesión del navegador viaja en una cookie `httpOnly` (spec 035): ningún
 * script de la página puede leerla, así que un XSS no se lleva el token.
 * `SameSite=Strict` porque el navegador habla con un único sitio (Vercel
 * reenvía `/api` a Render); `Secure` solo en producción, que en local es http.
 *
 * Al suplantar, el token del superadministrador se guarda en la segunda cookie
 * y se restaura al salir: antes vivía en `localStorage`.
 */
const COOKIE_SESION = 'nexus_sesion';
const COOKIE_ORIGINAL = 'nexus_sesion_original';

/** Sin `maxAge` es cookie de sesión del navegador: se va al cerrarlo. */
function opcionesCookie(maxAge) {
  return { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'strict', path: '/api', ...(maxAge ? { maxAge } : {}) };
}

/**
 * El token de la petición: la cookie del navegador o, si no hay, el `Bearer`.
 * El `Bearer` sigue valiendo para las suites de pruebas y clientes que no son
 * un navegador; no abre nada, porque el navegador ya no tiene el token a mano.
 */
function tokenDe(req) {
  const header = req.headers.authorization || '';
  return req.cookies?.[COOKIE_SESION] || (header.startsWith('Bearer ') ? header.slice(7) : null);
}

module.exports = {
  generateToken, generateTokenConCaducidad, verifyToken, getExpiryTime, VENTANA_INACTIVIDAD_MS, DURACION_RECORDAR_MS,
  COOKIE_SESION, COOKIE_ORIGINAL, opcionesCookie, tokenDe,
};
