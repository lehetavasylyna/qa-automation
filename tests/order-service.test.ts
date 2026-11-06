import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrderService,
  type Notifier,
  type OrderRepository,
  type RateProvider,
} from '../src/order-service';
import { InMemoryOrderRepository } from './fakes/in-memory-repository';

describe('OrderService — заглушки й шпигуни', () => {
  let rates: RateProvider;
  let repo: OrderRepository;
  let notifier: Notifier;
  let service: OrderService;

  beforeEach(() => {
    rates = { getRate: vi.fn().mockResolvedValue(41) };
    repo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
    };
    notifier = { send: vi.fn().mockResolvedValue(undefined) };
    service = new OrderService(rates, repo, notifier);
  });

  it('конвертує суму за отриманим курсом', async () => {
    const record = await service.placeOrder({
      id: 'A-1',
      amountUsd: 100,
      email: 'u@e.com',
    });
    expect(record.amountUah).toBeCloseTo(4100, 2);
  });

  it('надсилає сповіщення з сумою в гривнях', async () => {
    await service.placeOrder({
      id: 'A-2',
      amountUsd: 10,
      email: 'client@e.com',
    });

    expect(notifier.send).toHaveBeenCalledTimes(1);
    expect(notifier.send).toHaveBeenCalledWith(
      'client@e.com',
      expect.stringContaining('410'),
    );
  });

  it('не звертається до залежностей за некоректної суми', async () => {
    await expect(
      service.placeOrder({ id: 'A-3', amountUsd: 0, email: 'u@e.com' }),
    ).rejects.toThrow('INVALID_AMOUNT');

    expect(rates.getRate).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('збережене замовлення можна прочитати зі сховища', async () => {
    const repo = new InMemoryOrderRepository();
    const service = new OrderService(rates, repo, notifier);

    await service.placeOrder({ id: 'A-4', amountUsd: 50, email: 'u@e.com' });

    const saved = await repo.findById('A-4');
    expect(saved?.amountUah).toBeCloseTo(2050, 2);
    expect(repo.size).toBe(1);
  });

  it('не зберігає замовлення й не надсилає листа, якщо курс недоступний', async () => {
    const repo = new InMemoryOrderRepository();
    rates.getRate = vi.fn().mockRejectedValue(new Error('RATE_UNAVAILABLE'));
    const service = new OrderService(rates, repo, notifier);

    await expect(
      service.placeOrder({ id: 'A-5', amountUsd: 100, email: 'u@e.com' }),
    ).rejects.toThrow('RATE_UNAVAILABLE');

    expect(repo.size).toBe(0);
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

    it('записує момент створення замовлення', async () => {
      const record = await service.placeOrder({
        id: 'A-6',
        amountUsd: 20,
        email: 'u@e.com',
      });
      expect(record.createdAt).toBe('2026-03-15T10:00:00.000Z');
    });
  });
});
