export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export interface OrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface RefundRecord {
  id: string;
  amount: number;
  reason: string;
  notes?: string;
  processedBy: string;
  processedAt: Date;
}

export class Order {
  id: string;
  customerId: string;
  tenantId: string;
  items: OrderItem[];
  totalAmount: number;
  refundedAmount?: number;
  refunds?: RefundRecord[];
  currency: string;
  status: OrderStatus;
  paymentReference?: string;
  shippingAddress: string;
  createdAt: Date;
  updatedAt: Date;
}
