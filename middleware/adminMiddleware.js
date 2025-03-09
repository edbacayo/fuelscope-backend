const adminMiddleware = (req, res, next) => {

    console.log('adminMiddleware: ', req.user);

    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    next();
};

module.exports = adminMiddleware;
