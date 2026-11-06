import type { RateProvider } from './order-service';

export class HttpRateProvider implements RateProvider {
  constructor(private baseUrl: string) {}

  async getRate(from: string, to: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/rate?from=${from}&to=${to}`);
    if (!response.ok) throw new Error('RATE_UNAVAILABLE');

    const data = await response.json();
    if (typeof data.rate !== 'number') throw new Error('INVALID_RATE_FORMAT');
    return data.rate;
  }
}
