import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { ProductsService } from '../products/products.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  // Fix (ReDoS & Hyphens): Unambiguous linear regex supporting alphanumeric, underscores, and hyphens in values
  private readonly FILTER_REGEX = /^[a-zA-Z0-9_]+(=[a-zA-Z0-9_\-]+)?(&[a-zA-Z0-9_]+(=[a-zA-Z0-9_\-]+)?)*$/;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
  ) {}

  parseFilter(filterQuery: string): Record<string, string> {
    if (!filterQuery) return {};

    if (!this.FILTER_REGEX.test(filterQuery)) {
      throw new BadRequestException('Invalid query filter format. Expected format: key=value&key2=value2');
    }

    const result: Record<string, string> = {};
    const pairs = filterQuery.split('&');
    const allowedKeys = ['status', 'customerId'];

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (!allowedKeys.includes(key)) {
        throw new BadRequestException(`Unsupported filter key: ${key}. Supported keys: ${allowedKeys.join(', ')}`);
      }
      if (key === 'status') {
        const uppercaseStatus = (value || '').toUpperCase();
        if (!Object.values(OrderStatus).includes(uppercaseStatus as OrderStatus)) {
          throw new BadRequestException(`Invalid order status filter: ${value}`);
        }
        result[key] = uppercaseStatus;
      } else {
        result[key] = value || '';
      }
    }
    return result;
  }

  async getRevenueReport(tenantId: string, filterQuery?: string) {
    let orders = await this.ordersService.findAll(tenantId);

    // Fix: Actually apply the validated filter parameters to the order query
    if (filterQuery) {
      const filter = this.parseFilter(filterQuery);
      if (filter.status) {
        orders = orders.filter((o) => o.status === filter.status);
      }
      if (filter.customerId) {
        orders = orders.filter((o) => o.customerId === filter.customerId);
      }
    }

    // Fix (N+1 Query Antipattern): Batch-load unique customers and products into Maps
    const customerIds = Array.from(new Set(orders.map((o) => o.customerId)));
    const productIds = Array.from(
      new Set(orders.flatMap((o) => o.items.map((i) => i.productId))),
    );

    const customerMap = new Map<string, User>();
    for (const cid of customerIds) {
      try {
        const customer = await this.usersService.findById(cid);
        customerMap.set(cid, customer);
      } catch (err) {
        this.logger.warn(`Customer ${cid} not found during report generation`);
      }
    }

    const productMap = new Map<string, Product>();
    for (const pid of productIds) {
      try {
        const product = await this.productsService.findById(pid, tenantId);
        productMap.set(pid, product);
      } catch (err) {
        this.logger.warn(`Product ${pid} not found during report generation`);
      }
    }

    // Build breakdown using O(1) in-memory lookups
    const reportItems = orders.map((order) => {
      const customer = customerMap.get(order.customerId);
      const enrichedItems = order.items.map((item) => {
        const product = productMap.get(item.productId);
        return {
          productName: product ? product.name : item.productName,
          sku: product ? product.sku : 'UNKNOWN_SKU',
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        };
      });

      return {
        orderId: order.id,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
        customerEmail: customer ? customer.email : 'unknown@domain.com',
        totalAmount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
        items: enrichedItems,
      };
    });

    // Fix: Count revenue only from valid completed and processing orders, excluding cancelled and fully refunded orders
    const validRevenueOrders = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.PROCESSING,
    );

    const totalRevenue = validRevenueOrders.reduce(
      (sum, o) => sum + (o.totalAmount - (o.refundedAmount || 0)),
      0,
    );

    return {
      totalRevenue,
      orderCount: validRevenueOrders.length,
      allOrdersCount: orders.length,
      breakdown: reportItems,
    };
  }
}
