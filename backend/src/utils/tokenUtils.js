const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateToken(payload, remember = false) {
  const expiresIn = remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn;
  return jwt.sign(payload, env.jwtSecret, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function getExpiryTime(remember = false) {
  const ms = remember ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  return Date.now() + ms;
}

module.exports = { generateToken, verifyToken, getExpiryTime };
