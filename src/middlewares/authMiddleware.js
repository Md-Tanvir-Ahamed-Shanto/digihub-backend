const jwt = require('jsonwebtoken');
const config = require('../config'); // Where your jwtSecret is stored

exports.authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        // This is the key part: how req.user (or req.adminId) is populated
        req.user = decoded; // Standard practice: attaches { id, email, role }
        // If you want req.adminId directly, you could do:
        // if (decoded.role === 'admin') {
        //     req.adminId = decoded.id;
        // }
        next();
    } catch (err) {
        console.error('JWT verification failed:', err); // Log the actual error for debugging
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};