export enum Role {
  ADMIN = 'ADMIN',
  MERCHANT = 'MERCHANT',
  CUSTOMER = 'CUSTOMER',
}

export class User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
