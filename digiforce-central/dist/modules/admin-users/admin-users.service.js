"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdmins = listAdmins;
exports.getAdminById = getAdminById;
const prisma_1 = require("../../lib/prisma");
const sanitize_1 = require("../../utils/sanitize");
async function listAdmins() {
    const users = await prisma_1.prisma.adminUser.findMany({
        orderBy: { createdAt: 'desc' },
    });
    return users.map(sanitize_1.sanitizeAdminUser);
}
async function getAdminById(id) {
    const user = await prisma_1.prisma.adminUser.findUnique({ where: { id } });
    return user ? (0, sanitize_1.sanitizeAdminUser)(user) : null;
}
//# sourceMappingURL=admin-users.service.js.map