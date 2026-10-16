import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, Role } from '../users/entities/user.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.create(createOrderDto, user.id, user.tenantId);
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    const customerFilter = user.role === Role.CUSTOMER ? user.id : undefined;
    const orders = await this.ordersService.findAll(user.tenantId, customerFilter);
    return orders.map((o) => this.ordersService.sanitizeForUser(o, user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.ordersService.findById(id, user.tenantId);
    if (user.role === Role.CUSTOMER && order.customerId !== user.id) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return this.ordersService.sanitizeForUser(order, user);
  }

  @Post(':id/refund')
  @Roles(Role.ADMIN)
  async refund(
    @Param('id') id: string,
    @Body() refundDto: RefundOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.processRefund(id, refundDto, user);
  }
}
