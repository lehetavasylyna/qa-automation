import type { Order, OrderRepository } from '../../src/cancel-service';

export class InMemoryOrderStore implements OrderRepository {
  private items = new Map<string, Order>();

  constructor(initial: Order[] = []) {
    for (const order of initial) this.items.set(order.id, order);
  }

  async findById(id: string): Promise<Order | undefined> {
    return this.items.get(id);
  }

  async save(order: Order): Promise<void> {
    this.items.set(order.id, order);
  }

  get size(): number {
    return this.items.size;
  }
}
