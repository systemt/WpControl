"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdmins = listAdmins;
exports.getAdminById = getAdminById;
const prisma_1 = require("../../lib/prisma");
const sanitize_1 = require("../../utils/sanitize");
/**
 * Lists admin-role accounts only. The legacy `adminUser` model was unified
 * into the multi-tenant `User` table during the SaaS migration; admin
 * privilege is now a `role` flag rather than a separate table.
 */
async function listAdmins() {
    const users = await prisma_1.prisma.user.findMany({
        where: { role: 'admin' },
        orderBy: { createdAt: 'desc' },
    });
    return users.map(sanitize_1.sanitizeAdminUser);
}
/**
 * Fetch any user by id (used for the authenticated session's profile lookup).
 * Role filtering happens at the route layer — keeping this open lets the
 * `/me` endpoint serve both regular tenants and super admins.
 */
async function getAdminById(id) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id } });
    return user ? (0, sanitize_1.sanitizeAdminUser)(user) : null;
}
//# sourceMappingURL=admin-users.service.js.map