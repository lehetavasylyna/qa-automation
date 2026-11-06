import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CancelOrderService,
  type Notifier,
  type Order,
  type PaymentGateway,
} from '../src/cancel-service';
import { HttpPaymentGateway } from '../src/payment-gateway';
import { InMemoryOrderStore } from './fakes/in-memory-order-store';
import { REFUND_URL, server } from './msw/server';

const paidOrder: Order = {
  id: 'O-1',
  paymentId: 'PAY-1',
  amountUah: 1500,
  email: 'client@e.com',
  status: 'paid',
};

describe('CancelOrderService', () => {
  let gateway: PaymentGateway;
  let notifier: Notifier;
  let store: InMemoryOrderStore;
  let service: CancelOrderService;

  beforeEach(() => {
    gateway = { refund: vi.fn().mockResolvedValue('RF-1') };
    notifier = { send: vi.fn().mockResolvedValue(undefined) };
    store = new InMemoryOrderStore([paidOrder]);
    service = new CancelOrderService(gateway, store, notifier);
  });

  it('позначає замовлення скасованим і зберігає номер повернення', async () => {
    await service.cancelOrder('O-1');

    const saved = await store.findById('O-1');
    expect(saved?.status).toBe('cancelled');
    expect(saved?.refundId).toBe('RF-1');
    expect(store.size).toBe(1);
  });

  it('передає шлюзу платіж і суму замовлення', async () => {
    await service.cancelOrder('O-1');

    expect(gateway.refund).toHaveBeenCalledTimes(1);
    expect(gateway.refund).toHaveBeenCalledWith('PAY-1', 1500);
  });

  it('повідомляє клієнта про скасування', async () => {
    const result = await service.cancelOrder('O-1');

    expect(result.notified).toBe(true);
    expect(notifier.send).toHaveBeenCalledTimes(1);
    expect(notifier.send).toHaveBeenCalledWith(
      'client@e.com',
      expect.stringContaining('1500'),
    );
  });

  it('не надсилає лист і не змінює замовлення, якщо повернення не вдалося', async () => {
    gateway.refund = vi.fn().mockRejectedValue(new Error('REFUND_FAILED'));
    service = new CancelOrderService(gateway, store, notifier);

    await expect(service.cancelOrder('O-1')).rejects.toThrow('REFUND_FAILED');

    expect(notifier.send).not.toHaveBeenCalled();
    const stored = await store.findById('O-1');
    expect(stored?.status).toBe('paid');
    expect(stored?.refundId).toBeUndefined();
  });

  it('залишає замовлення скасованим, якщо лист не вдалося надіслати', async () => {
    notifier.send = vi.fn().mockRejectedValue(new Error('SMTP_DOWN'));
    service = new CancelOrderService(gateway, store, notifier);

    const result = await service.cancelOrder('O-1');

    expect(result.notified).toBe(false);
    const stored = await store.findById('O-1');
    expect(stored?.status).toBe('cancelled');
  });

  it('відхиляє неіснуюче замовлення без звернення до шлюзу', async () => {
    await expect(service.cancelOrder('O-404')).rejects.toThrow(
      'ORDER_NOT_FOUND',
    );

    expect(gateway.refund).not.toHaveBeenCalled();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it('не повертає кошти вдруге за вже скасованим замовленням', async () => {
    const cancelled: Order = {
      ...paidOrder,
      status: 'cancelled',
      refundId: 'RF-0',
    };
    service = new CancelOrderService(
      gateway,
      new InMemoryOrderStore([cancelled]),
      notifier,
    );

    await expect(service.cancelOrder('O-1')).rejects.toThrow(
      'ALREADY_CANCELLED',
    );

    expect(gateway.refund).not.toHaveBeenCalled();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  describe('фіксація часу', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('записує момент скасування замовлення', async () => {
      const result = await service.cancelOrder('O-1');
      expect(result.order.cancelledAt).toBe('2026-03-15T10:00:00.000Z');
    });
  });
});

describe('CancelOrderService разом із HTTP-шлюзом (MSW)', () => {
  let notifier: Notifier;
  let store: InMemoryOrderStore;
  let service: CancelOrderService;

  beforeEach(() => {
    notifier = { send: vi.fn().mockResolvedValue(undefined) };
    store = new InMemoryOrderStore([paidOrder]);
    service = new CancelOrderService(
      new HttpPaymentGateway('https://payments.example.com'),
      store,
      notifier,
    );
  });

  it('за успішної відповіді шлюзу скасовує замовлення й надсилає лист', async () => {
    await service.cancelOrder('O-1');

    const stored = await store.findById('O-1');
    expect(stored?.status).toBe('cancelled');
    expect(stored?.refundId).toBe('RF-100');
    expect(notifier.send).toHaveBeenCalledTimes(1);
  });

  it('за статусу 503 від шлюзу лист не надсилається', async () => {
    server.use(
      http.post(REFUND_URL, () => new HttpResponse(null, { status: 503 })),
    );

    await expect(service.cancelOrder('O-1')).rejects.toThrow('REFUND_FAILED');

    expect(notifier.send).not.toHaveBeenCalled();
    const stored = await store.findById('O-1');
    expect(stored?.status).toBe('paid');
  });
});
