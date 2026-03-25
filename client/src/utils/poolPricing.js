export const MASTERS_PROMO_END = new Date('2026-04-10');
export const isMastersPromoActive = () => new Date() < MASTERS_PROMO_END;

// Single source of truth for pool creation tiers.
// tier   — backend key sent in the payment request
// maxTeams — upper bound for this tier (999 = unlimited)
// price / promoPrice — displayed and charged amounts
export const POOL_TIERS = [
  { tier: 'standard',   maxTeams: 20,  label: '20 teams',        price: 12.99, promoPrice:  9.99, priceLabel: '$12.99/tournament' },
  { tier: 'standard',   maxTeams: 40,  label: '40 teams',        price: 19.99, promoPrice: 14.99, priceLabel: '$19.99/tournament' },
  { tier: 'standard',   maxTeams: 60,  label: '60 teams',        price: 24.99, promoPrice: 18.99, priceLabel: '$24.99/tournament' },
  { tier: 'large_100',  maxTeams: 100, label: '100 teams',       price: 34.99, promoPrice: 26.99, priceLabel: '$34.99/tournament' },
  { tier: 'large_300',  maxTeams: 300, label: '300 teams',       price: 49.99, promoPrice: 37.99, priceLabel: '$49.99/tournament' },
  { tier: 'enterprise', maxTeams: 999, label: 'Enterprise 300+', price: 69.99, promoPrice: 52.99, priceLabel: '$69.99/tournament' },
];
