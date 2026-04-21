import { config } from '../../config';
import type { BillingProvider } from './types';
import { MockBillingProvider } from './mock';
import { StripeBillingProvider } from './stripe';

let cached: BillingProvider | null = null;

/**
 * Returns the singleton billing provider. Defaults to the mock implementation
 * unless `BILLING_PROVIDER=stripe` + `STRIPE_SECRET_KEY` are both set.
 */
export function billing(): BillingProvider {
  if (cached) return cached;
  if (config.BILLING_PROVIDER === 'stripe' && config.STRIPE_SECRET_KEY) {
    cached = new StripeBillingProvider(config.STRIPE_SECRET_KEY);
  } else {
    cached = new MockBillingProvider();
  }
  return cached;
}

export type { BillingProvider } from './types';
