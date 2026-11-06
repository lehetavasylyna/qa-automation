export interface OrderItem {
  sku: string;
  price: number;
  qty: number;
}

export type CustomerTier = 'basic' | 'silver' | 'gold';

const TIER_RATE: Record<CustomerTier, number> = {
  basic: 0,
  silver: 0.05,
  gold: 0.1,
};

const LARGE_ORDER_THRESHOLD = 2000;
const LARGE_ORDER_BONUS = 0.05;
const MAX_DISCOUNT_RATE = 0.25;

const FREE_SHIPPING_THRESHOLD = 1000;
const SHIPPING_FEE = 60;

export function calcSubtotal(items: OrderItem[]): number {
  if (items.length === 0) throw new Error('EMPTY_ORDER');

  return items.reduce((sum, { price, qty }) => {
    if (price < 0) throw new Error('NEGATIVE_PRICE');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('INVALID_QTY');
    return sum + price * qty;
  }, 0);
}

export function calcDiscountRate(
  tier: CustomerTier,
  subtotal: number,
  promo = 0,
): number {
  if (promo < 0) throw new Error('INVALID_PROMO');

  const bonus = subtotal >= LARGE_ORDER_THRESHOLD ? LARGE_ORDER_BONUS : 0;
  return Math.min(TIER_RATE[tier] + bonus + promo, MAX_DISCOUNT_RATE);
}

export function calcShipping(amount: number): number {
  return amount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

export function calcOrderTotal(
  items: OrderItem[],
  tier: CustomerTier,
  promo = 0,
): number {
  const subtotal = calcSubtotal(items);
  const discounted = subtotal * (1 - calcDiscountRate(tier, subtotal, promo));
  return discounted + calcShipping(discounted);
}

// Варіант 1: списання бонусних балів
// 1 бал = 1 грн; за один раз балами можна оплатити не більше 30 % суми.
export const MAX_POINTS_PERCENT = 30;

export interface LoyaltyResult {
  payable: number;
  pointsUsed: number;
}

export function applyLoyaltyPoints(
  total: number,
  points: number,
): LoyaltyResult {
  if (!Number.isFinite(total) || total < 0) throw new Error('INVALID_TOTAL');
  if (!Number.isInteger(points) || points < 0) {
    throw new Error('INVALID_POINTS');
  }
  const cents = Math.round(total * 100);
  const maxPoints = Math.floor((cents * MAX_POINTS_PERCENT) / 10000);
  const pointsUsed = Math.min(points, maxPoints);
  return { payable: (cents - pointsUsed * 100) / 100, pointsUsed };
}
