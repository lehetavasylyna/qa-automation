const KILOMETERS_PER_MILE = 1.609344;

function assertNonNegativeDistance(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('INVALID_DISTANCE');
  }
}

export function kilometersToMiles(kilometers: number): number {
  assertNonNegativeDistance(kilometers);
  return kilometers / KILOMETERS_PER_MILE;
}

export function milesToKilometers(miles: number): number {
  assertNonNegativeDistance(miles);
  return miles * KILOMETERS_PER_MILE;
}
