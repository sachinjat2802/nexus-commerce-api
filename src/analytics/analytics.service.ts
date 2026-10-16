import { Injectable, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class AnalyticsService {
  // Vulnerability (ReDoS): Catastrophic backtracking regular expression with nested quantifiers
  // Pattern matching on evil payload e.g. "a=1&a=1&a=1&a=1&a=1&a=1&a=1&a=1&a=1&a=1!" freezes event loop
  private readonly FILTER_REGEX = /^([a-zA-Z0-9_]+(=[a-zA-Z0-9_]+)?(&)?)+$/;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
  ) {}

  parseFilter(filterQuery: string): Record<string, string> {
    if (!filterQuery) return {};

    if (!this.FILTER_REGEX.test(filterQuery)) {
      throw new BadRequestException('Invalid query filter format');
    }

    const result: Record<string, string> = {};
    const pairs = filterQuery.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      result[key] = value || '';
    }
    return result;
  }

  async getRevenueReport(tenantId: string, filterQuery?: string) {
    if (filterQuery) {
      this.parseFilter(filterQuery);
    }

    const orders = await this.ordersService.findAll(tenantId);

    try {
      const reportItems = [];

      // Performance Issue (N+1 Query Antipattern):
      // For every single order in the tenant, we fire individual sequential calls
      // to usersService and productsService inside nested loops rather than batch fetching.
      for (const order of orders) {
        const customer = await this.usersService.findById(order.customerId);

        const enrichedItems = [];
        for (const item of order.items) {
          const product = await this.productsService.findById(item.productId, tenantId);
          enrichedItems.push({
            productName: product.name,
            sku: product.sku,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
          });
        }

        reportItems.push({
          orderId: order.id,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerEmail: customer.email,
          totalAmount: order.totalAmount,
          currency: order.currency,
          status: order.status,
          createdAt: order.createdAt,
          items: enrichedItems,
        });
      }

      return {
        totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
        orderCount: orders.length,
        breakdown: reportItems,
      };
    } catch (err) {
      // Code Smell: Swallowing critical exceptions without logging or alerting
      // Masks database connectivity or data corruption errors in production
      return [];
    }
  }
}
