import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductsService {
  private products: Map<string, Product> = new Map();

  constructor() {
    // Seed initial inventory
    this.seedProduct('sku_macbook_pro', 'MacBook Pro M3 Max', 3499, 15, 'tenant_main');
    this.seedProduct('sku_sony_wh1000xm5', 'Sony WH-1000XM5 Headphones', 399, 50, 'tenant_main');
    this.seedProduct('sku_dell_u2723qe', 'Dell UltraSharp 27 4K Hub Monitor', 579, 30, 'tenant_main');
  }

  private seedProduct(sku: string, name: string, price: number, stock: number, tenantId: string) {
    const id = `prod_${uuidv4().substring(0, 8)}`;
    this.products.set(id, {
      id,
      sku,
      name,
      description: `High performance ${name} for enterprise workflows`,
      price,
      currency: 'USD',
      stock,
      tenantId,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async create(createProductDto: CreateProductDto, tenantId: string): Promise<Product> {
    const existing = Array.from(this.products.values()).find(
      (p) => p.sku === createProductDto.sku && p.tenantId === tenantId,
    );
    if (existing) {
      throw new ConflictException(`Product with SKU ${createProductDto.sku} already exists for this tenant`);
    }

    const newProduct: Product = {
      id: `prod_${uuidv4().substring(0, 8)}`,
      sku: createProductDto.sku,
      name: createProductDto.name,
      description: createProductDto.description || '',
      price: createProductDto.price,
      currency: createProductDto.currency || 'USD',
      stock: createProductDto.stock,
      tenantId,
      isAvailable: createProductDto.stock > 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }

  async findAll(tenantId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (p) => p.tenantId === tenantId && p.isAvailable,
    );
  }

  async findById(id: string, tenantId: string): Promise<Product> {
    const product = this.products.get(id);
    if (!product || product.tenantId !== tenantId) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async decrementStock(productId: string, quantity: number): Promise<Product> {
    const product = this.products.get(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (product.stock < quantity) {
      throw new ConflictException(`Insufficient stock for product ${product.name}`);
    }

    product.stock -= quantity;
    product.updatedAt = new Date();
    if (product.stock === 0 && product.isAvailable) {
      product.isAvailable = false;
      product.autoDisabledDueToStockOut = true;
    }

    this.products.set(product.id, product);
    return product;
  }

  async reserveStock(productId: string, quantity: number, tenantId: string): Promise<boolean> {
    if (quantity <= 0) {
      throw new BadRequestException('Reservation quantity must be greater than zero');
    }
    const product = await this.findById(productId, tenantId);

    // Atomic synchronous check and decrement (Prevents concurrency overselling)
    if (product.stock >= quantity) {
      product.stock -= quantity;
      product.reservedStock = (product.reservedStock || 0) + quantity;
      if (product.stock === 0 && product.isAvailable) {
        product.isAvailable = false; // Mark unavailable when stock reaches 0
        product.autoDisabledDueToStockOut = true;
      }
      product.updatedAt = new Date();
      this.products.set(product.id, product);
      return true;
    }

    return false;
  }

  async releaseStock(productId: string, quantity: number, tenantId: string): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Release quantity must be greater than zero');
    }
    const product = await this.findById(productId, tenantId);
    const currentlyReserved = product.reservedStock || 0;
    if (quantity > currentlyReserved) {
      throw new BadRequestException(
        `Cannot release ${quantity} units: exceeds currently reserved stock of ${currentlyReserved}`,
      );
    }

    product.reservedStock = currentlyReserved - quantity;
    product.stock += quantity;

    // Only restore availability if previously auto-disabled strictly due to a 0-stock condition,
    // preserving deliberate admin unlisting
    if (product.stock > 0 && product.autoDisabledDueToStockOut) {
      product.isAvailable = true;
      product.autoDisabledDueToStockOut = false;
    }
    product.updatedAt = new Date();
    this.products.set(product.id, product);
  }
}
