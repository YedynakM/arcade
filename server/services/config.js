'use strict';

// Єдине місце для секрету JWT і терміну дії токена
const JWT_SECRET = process.env.JWT_SECRET || 'arcade-local-dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };