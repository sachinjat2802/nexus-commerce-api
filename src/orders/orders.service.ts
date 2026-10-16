import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Order, OrderStatus, OrderItem } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
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
      status: OrderStatus.PENDING,
      paymentReference: `pay_ref_${uuidv4().substring(0, 8)}`,
      shippingAddress: createOrderDto.shippingAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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

  private reservations: Map<string, {
    id: string;
    customerId: string;
    tenantId: string;
    items: { productId: string; quantity: number }[];
    expiresAt: Date;
    status: 'ACTIVE' | 'RELEASED' | 'CONFIRMED';
  }> = new Map();

  async cleanupExpiredReservations(tenantId: string): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    for (const [id, res] of this.reservations.entries()) {
      if (res.tenantId === tenantId && res.status === 'ACTIVE' && res.expiresAt < now) {
        res.status = 'RELEASED';
        this.reservations.set(id, res);
        for (const item of res.items) {
          await this.productsService.releaseStock(item.productId, item.quantity, tenantId);
        }
        cleaned++;
      }
    }
    return cleaned;
  }

  async createBatchReservation(
    batchItems: { productId: string; quantity: number }[],
    customerId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string; reservedCount: number; reservationId: string }> {
    // 1. Evict any expired stock holds before new allocations
    await this.cleanupExpiredReservations(tenantId);

    const successfullyReserved: { productId: string; quantity: number }[] = [];

    // 2. Sequential for..of loop that strictly awaits each reservation
    // and provides automatic rollback if any stock reservation fails
    for (const item of batchItems) {
      const reserved = await this.productsService.reserveStock(item.productId, item.quantity, tenantId);
      if (reserved) {
        successfullyReserved.push(item);
      } else {
        // Rollback all previously reserved items in this batch
        for (const rollbackItem of successfullyReserved) {
          await this.productsService.releaseStock(rollbackItem.productId, rollbackItem.quantity, tenantId);
        }
        throw new BadRequestException(
          `Failed to reserve stock for product ${item.productId}. Batch reservation aborted and rolled back.`,
        );
      }
    }

    // 3. Store temporary hold record tied to customer with 15-minute TTL
    const reservationId = `res_${uuidv4().substring(0, 8)}`;
    this.reservations.set(reservationId, {
      id: reservationId,
      customerId,
      tenantId,
      items: batchItems,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15-minute hold
      status: 'ACTIVE',
    });

    return {
      success: true,
      message: 'Batch stock reservation completed successfully with 15-minute hold',
      reservedCount: successfullyReserved.length,
      reservationId,
    };
  }

  async releaseReservation(reservationId: string, tenantId: string): Promise<boolean> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.tenantId !== tenantId) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== 'ACTIVE') {
      throw new ConflictException(`Reservation ${reservationId} is already ${reservation.status.toLowerCase()}`);
    }

    // Fix: Mark RELEASED before awaiting stock restoration to prevent concurrent double-releases
    reservation.status = 'RELEASED';
    this.reservations.set(reservationId, reservation);

    for (const item of reservation.items) {
      await this.productsService.releaseStock(item.productId, item.quantity, tenantId);
    }

    return true;
  }
}
