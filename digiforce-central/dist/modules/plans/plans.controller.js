"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicPlans = void 0;
const async_handler_1 = require("../../utils/async-handler");
const prisma_1 = require("../../lib/prisma");
exports.listPublicPlans = (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const plans = await prisma_1.prisma.plan.findMany({
        where: { isPublic: true },
        orderBy: { sortOrder: 'asc' },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            maxSites: true,
            priceMonthly: true,
            currency: true,
            features: true,
        },
    });
    res.json({ success: true, data: plans });
});
//# sourceMappingURL=plans.controller.js.map