import { describe, it, expect } from 'vitest';
import {
  calcSubtotal,
  calcDiscountRate,
  calcShipping,
  calcOrderTotal,
  applyLoyaltyPoints,
  type OrderItem,
} from '../src/order';

const item = (price: number, qty = 1): OrderItem => ({
  sku: 'SKU-1',
  price,
  qty,
});

describe('calcSubtotal', () => {
  it('підсумовує вартість позицій з урахуванням кількості', () => {
    // Дві позиції з різною кількістю: 100·2 + 50·3 = 350. Ціле число — toBe.
    // Arrange
    const items = [item(100, 2), { sku: 'SKU-2', price: 50, qty: 3 }];

    // Act
    const result = calcSubtotal(items);

    // Assert
    expect(result).toBe(350);
  });

  it('відхиляє порожнє замовлення', () => {
    // Окремий клас некоректних даних: порожній масив → EMPTY_ORDER.
    expect(() => calcSubtotal([])).toThrow('EMPTY_ORDER');
  });

  it('відхиляє від’ємну ціну', () => {
    // Окремий клас: від’ємна ціна. −1 — представник класу → NEGATIVE_PRICE.
    expect(() => calcSubtotal([item(-1)])).toThrow('NEGATIVE_PRICE');
  });

  it.each([0, -1, 1.5])('відхиляє кількість %s', (qty) => {
    // Один клас «недодатна або дробова кількість»:
    // 0 — межа, −1 — від’ємне, 1,5 — дробове → INVALID_QTY.
    expect(() => calcSubtotal([item(100, qty)])).toThrow('INVALID_QTY');
  });
});

describe('calcDiscountRate', () => {
  // Три рівні нижче порога 2000 і два рівні на самому порозі (+0,05).
  // Дробові ставки порівнюємо через toBeCloseTo.
  it.each([
    { tier: 'basic' as const, subtotal: 500, expected: 0 },
    { tier: 'silver' as const, subtotal: 500, expected: 0.05 },
    { tier: 'gold' as const, subtotal: 500, expected: 0.1 },
    { tier: 'basic' as const, subtotal: 2000, expected: 0.05 },
    { tier: 'gold' as const, subtotal: 2000, expected: 0.15 },
  ])(
    'рівень $tier із сумою $subtotal дає ставку $expected',
    ({ tier, subtotal, expected }) => {
      expect(calcDiscountRate(tier, subtotal)).toBeCloseTo(expected, 4);
    },
  );

  // Правило «межа мінус один, межа, межа плюс один» для порога 2000.
  it.each([
    { subtotal: 1999, expected: 0 },
    { subtotal: 2000, expected: 0.05 },
    { subtotal: 2001, expected: 0.05 },
  ])('межа великого замовлення: $subtotal', ({ subtotal, expected }) => {
    expect(calcDiscountRate('basic', subtotal)).toBeCloseTo(expected, 4);
  });

  it('обмежує сумарну знижку максимальним значенням', () => {
    // gold 0,1 + бонус 0,05 + промокод 0,5 = 0,65 → обмеження 0,25.
    expect(calcDiscountRate('gold', 2000, 0.5)).toBe(0.25);
  });

  it('відхиляє від’ємний промокод', () => {
    // Від’ємний промокод — окремий некоректний клас → INVALID_PROMO.
    expect(() => calcDiscountRate('basic', 500, -0.1)).toThrow('INVALID_PROMO');
  });
});

describe('calcShipping', () => {
  // Межа порога безкоштовної доставки; поріг включний (≥ 1000).
  it.each([
    [999, 60],
    [1000, 0],
    [1001, 0],
  ])('сума %i → доставка %i', (amount, expected) => {
    expect(calcShipping(amount)).toBe(expected);
  });
});

describe('calcOrderTotal', () => {
  it('додає доставку до замовлення нижче порога', () => {
    // 500 без знижки + доставка 60 = 560.
    const total = calcOrderTotal([item(500)], 'basic');
    expect(total).toBeCloseTo(560, 2);
  });

  it('не додає доставку, якщо сума після знижки сягає порога', () => {
    // 1200 − 10 % = 1080 ≥ 1000, доставка безкоштовна
    const total = calcOrderTotal([item(1200)], 'gold');
    expect(total).toBeCloseTo(1080, 2);
  });

  it('знижка може опустити суму нижче порога доставки', () => {
    // 1050 − 10 % = 945 < 1000, тому доставка платна
    const total = calcOrderTotal([item(1050)], 'gold');
    expect(total).toBeCloseTo(1005, 2);
  });

  it('передає виняток із нижнього рівня', () => {
    // Порожній масив: виняток EMPTY_ORDER із calcSubtotal доходить сюди.
    expect(() => calcOrderTotal([], 'gold')).toThrow('EMPTY_ORDER');
  });
});

describe('applyLoyaltyPoints', () => {
  // Сума 1000 грн: ліміт 30 % = 300 балів.
  // 299 списується повністю, 300 — рівно по ліміту, 301 обрізається до 300.
  it.each([
    { points: 299, pointsUsed: 299, payable: 701 },
    { points: 300, pointsUsed: 300, payable: 700 },
    { points: 301, pointsUsed: 300, payable: 700 },
  ])(
    'межа списання для суми 1000: $points балів → списано $pointsUsed',
    ({ points, pointsUsed, payable }) => {
      const result = applyLoyaltyPoints(1000, points);
      expect(result.pointsUsed).toBe(pointsUsed);
      expect(result.payable).toBeCloseTo(payable, 2);
    },
  );

  it('не змінює суму, якщо балів немає', () => {
    // Нижня межа допустимих балів: списано 0, сума лишається 1000.
    const result = applyLoyaltyPoints(1000, 0);
    expect(result.pointsUsed).toBe(0);
    expect(result.payable).toBeCloseTo(1000, 2);
  });

  it('списує всі бали, якщо вони менші за ліміт', () => {
    // Типовий випадок усередині діапазону: 100 < 300, 1000 − 100 = 900.
    const result = applyLoyaltyPoints(1000, 100);
    expect(result.pointsUsed).toBe(100);
    expect(result.payable).toBeCloseTo(900, 2);
  });

  it('обмежує списання 30 % суми, якщо балів забагато', () => {
    // Клас «балів значно більше за ліміт»: 5000 обрізається до 300.
    const result = applyLoyaltyPoints(1000, 5000);
    expect(result.pointsUsed).toBe(300);
    expect(result.payable).toBeCloseTo(700, 2);
  });

  it('округлює ліміт униз до цілого балу для дробової суми', () => {
    // 30 % від 99,99 = 29,997 → не більше 29 балів
    const result = applyLoyaltyPoints(99.99, 30);
    expect(result.pointsUsed).toBe(29);
    expect(result.payable).toBeCloseTo(70.99, 2);
  });

  it('зберігає копійки в сумі до сплати', () => {
    // 30 % від 333,33 = 99,999 → не більше 99 балів
    const result = applyLoyaltyPoints(333.33, 200);
    expect(result.pointsUsed).toBe(99);
    expect(result.payable).toBeCloseTo(234.33, 2);
  });

  it('не списує бали з нульової суми', () => {
    // Нижня межа суми: ліміт 0, списати нічого не можна, виняток не викидається.
    const result = applyLoyaltyPoints(0, 50);
    expect(result.pointsUsed).toBe(0);
    expect(result.payable).toBeCloseTo(0, 2);
  });

  it.each([-1, -100, 1.5, NaN, Infinity])(
    'відхиляє некоректну кількість балів %s',
    (points) => {
      // −1 — найближче від’ємне, −100 — віддалене, 1,5 — дробове,
      // NaN і Infinity — нечислові → INVALID_POINTS.
      expect(() => applyLoyaltyPoints(1000, points)).toThrow('INVALID_POINTS');
    },
  );

  it.each([-0.01, -500, NaN, Infinity])(
    'відхиляє некоректну суму замовлення %s',
    (total) => {
      // −0,01 — межа нуля, −500 — віддалене від’ємне,
      // NaN і Infinity — нечислові → INVALID_TOTAL.
      expect(() => applyLoyaltyPoints(total, 10)).toThrow('INVALID_TOTAL');
    },
  );
});
