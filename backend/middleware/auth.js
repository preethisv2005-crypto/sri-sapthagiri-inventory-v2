/**
 * Simple role-based auth middleware.
 * The frontend sends role in the X-User-Role header.
 * For stronger auth, use JWT tokens in production.
 */

exports.requireAdmin = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    next();
};

exports.requireAuth = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role || (role !== 'admin' && role !== 'transporter')) {
        return res.status(401).json({ message: 'Unauthorized. Please login first.' });
    }
    next();
};
