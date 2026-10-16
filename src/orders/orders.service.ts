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

  async processRefund(orderId: string, refundDto: RefundOrderDto, user: any): Promise<Order> {
    // Insecure Direct Object Reference (IDOR): order fetched without tenant scoping
    const order = this.orders.get(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Order is already refunded');
    }

    if (refundDto.amount > order.totalAmount) {
      throw new BadRequestException('Refund amount cannot exceed total order amount');
    }

    order.status = OrderStatus.REFUNDED;
    order.updatedAt = new Date();
    this.orders.set(order.id, order);

    return order;
  }
}
