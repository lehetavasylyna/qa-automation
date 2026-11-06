import type { OrderRecord, OrderRepository } from '../../src/order-service';

export class InMemoryOrderRepository implements OrderRepository {
  private items = new Map<string, OrderRecord>();

  async save(record: OrderRecord): Promise<void> {
    this.items.set(record.id, record);
  }

  async findById(id: string): Promise<OrderRecord | undefined> {
    return this.items.get(id);
  }

  get size(): number {
    return this.items.size;
  }
}
