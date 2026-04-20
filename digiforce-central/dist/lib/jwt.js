"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function signToken(payload) {
    const options = {
        expiresIn: config_1.config.jwtExpiresIn,
        issuer: config_1.config.APP_NAME,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_SECRET, options);
}
function verifyToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET, { issuer: config_1.config.APP_NAME });
    if (typeof decoded === 'string') {
        throw new Error('Invalid token payload');
    }
    return decoded;
}
//# sourceMappingURL=jwt.js.map