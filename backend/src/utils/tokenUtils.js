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

function getExpiryTime(remember = false) {
  const ms = remember ? 7 * 24 * 60 * 60 * 1000 : VENTANA_INACTIVIDAD_MS;
  return Date.now() + ms;
}

module.exports = { generateToken, generateTokenConCaducidad, verifyToken, getExpiryTime, VENTANA_INACTIVIDAD_MS };
