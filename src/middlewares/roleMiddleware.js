exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res
        .status(401)
        .json({ message: "Not authenticated or role missing" });
    }

    const { role } = req.user;
console.log("role", role,allowedRoles)
    if (!allowedRoles.includes(role)) {
      return res
        .status(403)
        .json({ message: "Access denied: Insufficient privileges" });
    }

    next();
  };
};

exports.isAdmin = exports.authorizeRoles("admin");
exports.isClient = exports.authorizeRoles("client");
exports.isPartner = exports.authorizeRoles("partner");
exports.isClientOrPartner = exports.authorizeRoles("client", "partner");
exports.isAdminOrPartner = exports.authorizeRoles("admin", "partner");
