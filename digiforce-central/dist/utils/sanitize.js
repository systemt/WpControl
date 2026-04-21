"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAdminUser = void 0;
exports.sanitizeUser = sanitizeUser;
/**
 * Strip the password hash before sending a user to the client.
 */
function sanitizeUser(user) {
    const { passwordHash: _omit, ...rest } = user;
    void _omit;
    return rest;
}
// Backwards compatible alias — earlier code referenced sanitizeAdminUser.
exports.sanitizeAdminUser = sanitizeUser;
//# sourceMappingURL=sanitize.js.map