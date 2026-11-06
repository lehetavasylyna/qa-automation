import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { HttpPaymentGateway } from '../src/payment-gateway';
import { REFUND_URL, server } from './msw/server';

const gateway = new HttpPaymentGateway('https://payments.example.com');

describe('HttpPaymentGateway', () => {
  it('повертає номер повернення з успішної відповіді', async () => {
    await expect(gateway.refund('PAY-1', 1500)).resolves.toBe('RF-100');
  });

  it.each([400, 402, 500, 503])(
    'відхиляє відповідь зі статусом %i',
    async (status) => {
      server.use(
        http.post(REFUND_URL, () => new HttpResponse(null, { status })),
      );
      await expect(gateway.refund('PAY-1', 1500)).rejects.toThrow(
        'REFUND_FAILED',
      );
    },
  );

  it.each([
    { name: 'номер повернення числом', body: { refundId: 123 } },
    { name: 'порожній об’єкт', body: {} },
    { name: 'порожній рядок', body: { refundId: '' } },
  ])('відхиляє некоректний формат: $name', async ({ body }) => {
    server.use(http.post(REFUND_URL, () => HttpResponse.json(body)));
    await expect(gateway.refund('PAY-1', 1500)).rejects.toThrow(
      'INVALID_REFUND_FORMAT',
    );
  });

  it('передає платіж і суму в тілі POST-запиту', async () => {
    let method: string | undefined;
    let body: unknown;
    server.use(
      http.post(REFUND_URL, async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json({ refundId: 'RF-1' });
      }),
    );

    await gateway.refund('PAY-7', 249.5);

    expect(method).toBe('POST');
    expect(body).toEqual({ paymentId: 'PAY-7', amount: 249.5 });
  });

  it('опрацьовує мережеву помилку', async () => {
    server.use(http.post(REFUND_URL, () => HttpResponse.error()));
    await expect(gateway.refund('PAY-1', 1500)).rejects.toThrow();
  });
});
