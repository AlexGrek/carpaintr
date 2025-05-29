/**
 * Decodes JWT token and extracts expiration information
 * 
 * @param {string} token - JWT token string
 * @returns {Object} Object containing expiration date, days till expiration, and expired status
 */
function decodeJwtExpiration(token) {
  // Guard against invalid input
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: Token must be a non-empty string');
  }

  try {
    // Split the token into parts
    const parts = token.split('.');

    // A valid JWT has 3 parts: header, payload, and signature
    if (parts.length !== 3) {
      throw new Error('Invalid token format: JWT must have three parts');
    }

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check if the token has an expiration claim (exp)
    if (!payload.exp) {
      throw new Error('Token does not contain expiration information');
    }

    // Convert exp (seconds since epoch) to milliseconds for Date object
    const expirationDate = new Date(payload.exp * 1000);
    const currentDate = new Date();

    // Calculate days till expiration
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const daysTillExpiration = (expirationDate - currentDate) / millisecondsPerDay;

    // Check if expired
    const isExpired = currentDate > expirationDate;

    return {
      expirationDate,
      daysTillExpiration: parseFloat(daysTillExpiration.toFixed(2)),
      isExpired
    };
  } catch (error) {
    if (error.message.includes('Token')) {
      throw error; // Re-throw our custom errors
    } else {
      throw new Error(`Error decoding JWT token: ${error.message}`);
    }
  }
}

export default decodeJwtExpiration;