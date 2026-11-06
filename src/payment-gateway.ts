import type { PaymentGateway } from './cancel-service';

export class HttpPaymentGateway implements PaymentGateway {
  constructor(private baseUrl: string) {}

  async refund(paymentId: string, amountUah: number): Promise<string> {
    const response = await fetch(`${this.baseUrl}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, amount: amountUah }),
    });
    if (!response.ok) throw new Error('REFUND_FAILED');

    const data = await response.json();
    if (typeof data.refundId !== 'string' || data.refundId === '') {
      throw new Error('INVALID_REFUND_FORMAT');
    }
    return data.refundId;
  }
}
