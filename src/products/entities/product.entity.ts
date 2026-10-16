export class Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  reservedStock?: number;
  autoDisabledDueToStockOut?: boolean;
  tenantId: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}
