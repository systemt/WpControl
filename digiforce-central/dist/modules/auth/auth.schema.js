"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email().transform((v) => v.toLowerCase().trim()),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.signupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
    email: zod_1.z.string().email().transform((v) => v.toLowerCase().trim()),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(200, 'Password is too long'),
});
//# sourceMappingURL=auth.schema.js.map