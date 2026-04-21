"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billing = billing;
const config_1 = require("../../config");
const mock_1 = require("./mock");
const stripe_1 = require("./stripe");
let cached = null;
/**
 * Returns the singleton billing provider. Defaults to the mock implementation
 * unless `BILLING_PROVIDER=stripe` + `STRIPE_SECRET_KEY` are both set.
 */
function billing() {
    if (cached)
        return cached;
    if (config_1.config.BILLING_PROVIDER === 'stripe' && config_1.config.STRIPE_SECRET_KEY) {
        cached = new stripe_1.StripeBillingProvider(config_1.config.STRIPE_SECRET_KEY);
    }
    else {
        cached = new mock_1.MockBillingProvider();
    }
    return cached;
}
//# sourceMappingURL=index.js.map