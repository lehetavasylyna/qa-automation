import { describe, it, expect } from 'vitest';
import { kilometersToMiles, milesToKilometers } from '../src/distance';

describe('kilometersToMiles', () => {
  it('перетворює 1,609344 км на 1 милю', () => {
    // Arrange
    const kilometers = 1.609344;

    // Act
    const result = kilometersToMiles(kilometers);

    // Assert
    expect(result).toBe(1);
  });

  it('перетворює 8,04672 км на 5 миль', () => {
    expect(kilometersToMiles(8.04672)).toBeCloseTo(5, 5);
  });

  it('перетворює нуль кілометрів на нуль миль', () => {
    expect(kilometersToMiles(0)).toBe(0);
  });

  it('відхиляє від’ємну кількість кілометрів', () => {
    expect(() => kilometersToMiles(-1)).toThrow('INVALID_DISTANCE');
  });

  it('відхиляє нечислове значення кілометрів', () => {
    expect(() => kilometersToMiles(NaN)).toThrow('INVALID_DISTANCE');
  });
});

describe('milesToKilometers', () => {
  it('перетворює 1 милю на 1,609344 км', () => {
    expect(milesToKilometers(1)).toBe(1.609344);
  });

  it('перетворює 5 миль на 8,04672 км', () => {
    expect(milesToKilometers(5)).toBeCloseTo(8.04672, 5);
  });

  it('перетворює нуль миль на нуль кілометрів', () => {
    expect(milesToKilometers(0)).toBe(0);
  });

  it('відхиляє від’ємну кількість миль', () => {
    expect(() => milesToKilometers(-1)).toThrow('INVALID_DISTANCE');
  });
});
