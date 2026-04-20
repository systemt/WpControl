"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = void 0;
const config_1 = require("../../config");
const getHealth = (_req, res) => {
    res.json({
        success: true,
        data: {
            app: config_1.config.APP_NAME,
            version: config_1.config.APP_VERSION,
            environment: config_1.config.NODE_ENV,
            server_time: new Date().toISOString(),
        },
    });
};
exports.getHealth = getHealth;
//# sourceMappingURL=system.controller.js.map