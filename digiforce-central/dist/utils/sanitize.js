"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAdminUser = sanitizeAdminUser;
/**
 * Strip the password hash before sending an admin user to the client.
 */
function sanitizeAdminUser(user) {
    const { passwordHash: _omit, ...rest } = user;
    void _omit;
    return rest;
}
//# sourceMappingURL=sanitize.js.map