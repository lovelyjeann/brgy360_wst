function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    next();
}

function isResident(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    if (req.session.user.role !== "resident") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Residents only."
        });
    }

    next();
}

function isAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    if (req.session.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admins only."
        });
    }

    next();
}

module.exports = {
    isAuthenticated,
    isResident,
    isAdmin
};