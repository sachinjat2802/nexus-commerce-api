import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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
    return this.ordersService.findAll(user.tenantId, customerFilter);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.findById(id, user.tenantId);
  }

  @Post(':id/refund')
  async refund(
    @Param('id') id: string,
    @Body() refundDto: RefundOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.processRefund(id, refundDto, user);
  }
}
