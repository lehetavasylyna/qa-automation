// Варіант 1: сервіс скасування замовлення.
// Повертає кошти через платіжний шлюз і надсилає клієнту лист.
// Лист не надсилається, якщо повернення коштів не вдалося.

export type OrderStatus = 'paid' | 'cancelled';

export interface Order {
  id: string;
  paymentId: string;
  amountUah: number;
  email: string;
  status: OrderStatus;
  refundId?: string;
  cancelledAt?: string;
}

export interface PaymentGateway {
  refund(paymentId: string, amountUah: number): Promise<string>;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | undefined>;
  save(order: Order): Promise<void>;
}

export interface Notifier {
  send(email: string, text: string): Promise<void>;
}

export interface CancelResult {
  order: Order;
  notified: boolean;
}

export class CancelOrderService {
  constructor(
    private gateway: PaymentGateway,
    private repo: OrderRepository,
    private notifier: Notifier,
  ) {}

  async cancelOrder(orderId: string): Promise<CancelResult> {
    const order = await this.repo.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status === 'cancelled') throw new Error('ALREADY_CANCELLED');

    // Якщо повернення не вдалося, виняток проходить нагору:
    // замовлення не змінюється, лист не надсилається.
    const refundId = await this.gateway.refund(
      order.paymentId,
      order.amountUah,
    );

    const cancelled: Order = {
      ...order,
      status: 'cancelled',
      refundId,
      cancelledAt: new Date().toISOString(),
    };
    await this.repo.save(cancelled);

    // Кошти вже повернено, тому збій листа не скасовує результат операції.
    let notified = true;
    try {
      await this.notifier.send(
        order.email,
        `Замовлення ${order.id} скасовано, ${order.amountUah} грн повернено`,
      );
    } catch {
      notified = false;
    }

    return { order: cancelled, notified };
  }
}
