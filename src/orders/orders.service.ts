import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Order, OrderStatus, OrderItem } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { ProductsService } from '../products/products.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  private orders: Map<string, Order> = new Map();

  constructor(private readonly productsService: ProductsService) {}

  async create(createOrderDto: CreateOrderDto, customerId: string, tenantId: string): Promise<Order> {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const orderItems: OrderItem[] = [];
    let totalAmount = 0;

    for (const item of createOrderDto.items) {
      const product = await this.productsService.findById(item.productId, tenantId);
      await this.productsService.decrementStock(product.id, item.quantity);

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });
    }

    const order: Order = {
      id: `ord_${uuidv4().substring(0, 10)}`,
      customerId,
      tenantId,
      items: orderItems,
      totalAmount,
      currency: 'USD',
      status: OrderStatus.COMPLETED, // Mark completed upon payment confirmation and stock allocation
      paymentReference: `pay_ref_${uuidv4().substring(0, 8)}`,
      shippingAddress: createOrderDto.shippingAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async updateStatus(id: string, status: OrderStatus, tenantId: string): Promise<Order> {
    const order = await this.findById(id, tenantId);
    order.status = status;
    order.updatedAt = new Date();
    this.orders.set(order.id, order);
    return order;
  }

  async findAll(tenantId: string, customerId?: string): Promise<Order[]> {
    let list = Array.from(this.orders.values()).filter((o) => o.tenantId === tenantId);
    if (customerId) {
      list = list.filter((o) => o.customerId === customerId);
    }
    return list;
  }

  async findById(id: string, tenantId: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async processRefund(orderId: string, refundDto: RefundOrderDto, user: any): Promise<Order> {
    // 1. Enforce tenant isolation via scoped findById (Fixes IDOR)
    const order = await this.findById(orderId, user.tenantId);

    // 2. Validate order status lifecycle (Fixes refunding unpaid or cancelled orders)
    if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException('Only completed or processing orders can be refunded');
    }

    // 3. Compute in integer cents and validate max 2 decimals to avoid float precision drift
    const totalCents = Math.round(order.totalAmount * 100);
    const currentRefundedCents = Math.round((order.refundedAmount || 0) * 100);
    const refundCents = Math.round(refundDto.amount * 100);

    if (refundCents <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    if (Math.abs(refundDto.amount * 100 - refundCents) > 1e-4) {
      throw new BadRequestException('Refund amount cannot have more than 2 decimal places');
    }

    // 4. Track cumulative refunded amount in integer cents (Fixes float cents breaking refund cap)
    if (currentRefundedCents + refundCents > totalCents) {
      const remainingCents = totalCents - currentRefundedCents;
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable balance of ${(remainingCents / 100).toFixed(2)}`,
      );
    }

    const newRefundedCents = currentRefundedCents + refundCents;
    order.refundedAmount = Number((newRefundedCents / 100).toFixed(2));
    if (newRefundedCents >= totalCents) {
      order.status = OrderStatus.REFUNDED;
    }

    // Record audit entry preserving reason, notes, timestamp and operator id (Fixes using user.id)
    if (!order.refunds) {
      order.refunds = [];
    }
    order.refunds.push({
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: Number((refundCents / 100).toFixed(2)),
      reason: refundDto.reason,
      notes: refundDto.notes,
      processedBy: user.id || 'system',
      processedAt: new Date(),
    });

    order.updatedAt = new Date();
    this.orders.set(order.id, order);

    return order;
  }

  sanitizeForUser(order: Order, user: any): Order {
    if (user?.role === 'ADMIN') {
      return order;
    }
    // Customers only see order state; strip internal staff audit notes and staff identity
    const { refunds, ...safeOrder } = order;
    return safeOrder as Order;
  }
}
