import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { HttpRateProvider } from '../src/rate-provider';
import { RATE_URL, server } from './msw/server';

const provider = new HttpRateProvider('https://api.example.com');

describe('HttpRateProvider', () => {
  it('повертає курс з успішної відповіді', async () => {
    await expect(provider.getRate('USD', 'UAH')).resolves.toBe(41.25);
  });

  it('відхиляє відповідь зі статусом 503', async () => {
    server.use(
      http.get(RATE_URL, () => new HttpResponse(null, { status: 503 })),
    );
    await expect(provider.getRate('USD', 'UAH')).rejects.toThrow(
      'RATE_UNAVAILABLE',
    );
  });

  it('відхиляє курс у вигляді рядка', async () => {
    server.use(http.get(RATE_URL, () => HttpResponse.json({ rate: '41.25' })));
    await expect(provider.getRate('USD', 'UAH')).rejects.toThrow(
      'INVALID_RATE_FORMAT',
    );
  });

  it('передає параметри валют у запит', async () => {
    let captured: URL | undefined;
    server.use(
      http.get(RATE_URL, ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ rate: 1 });
      }),
    );

    await provider.getRate('EUR', 'PLN');

    expect(captured?.searchParams.get('from')).toBe('EUR');
    expect(captured?.searchParams.get('to')).toBe('PLN');
  });

  it('опрацьовує мережеву помилку', async () => {
    server.use(http.get(RATE_URL, () => HttpResponse.error()));
    await expect(provider.getRate('USD', 'UAH')).rejects.toThrow();
  });
});
