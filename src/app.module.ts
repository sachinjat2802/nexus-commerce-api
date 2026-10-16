import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [AuthModule, UsersModule, ProductsModule, OrdersModule, AnalyticsModule],
})
export class AppModule {}
