export interface RateProvider {
  getRate(from: string, to: string): Promise<number>;
}

export interface OrderRepository {
  save(record: OrderRecord): Promise<void>;
  findById(id: string): Promise<OrderRecord | undefined>;
}

export interface Notifier {
  send(email: string, text: string): Promise<void>;
}

export interface OrderInput {
  id: string;
  amountUsd: number;
  email: string;
}

export interface OrderRecord extends OrderInput {
  amountUah: number;
  createdAt: string;
}

export class OrderService {
  constructor(
    private rates: RateProvider,
    private repo: OrderRepository,
    private notifier: Notifier,
  ) {}

  async placeOrder(order: OrderInput): Promise<OrderRecord> {
    if (order.amountUsd <= 0) throw new Error('INVALID_AMOUNT');

    const rate = await this.rates.getRate('USD', 'UAH');
    const amountUah = Math.round(order.amountUsd * rate * 100) / 100;
    const record: OrderRecord = {
      ...order,
      amountUah,
      createdAt: new Date().toISOString(),
    };

    await this.repo.save(record);
    await this.notifier.send(
      order.email,
      `Замовлення ${order.id} на суму ${amountUah} грн прийнято`,
    );
    return record;
  }
}
