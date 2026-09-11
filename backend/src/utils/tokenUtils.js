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

function getExpiryTime(remember = false) {
  const ms = remember ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  return Date.now() + ms;
}

module.exports = { generateToken, generateTokenConCaducidad, verifyToken, getExpiryTime };
