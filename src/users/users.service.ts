import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { User, Role } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  private users: Map<string, User> = new Map();

  constructor() {
    // Seed an admin user for multi-tenant bootstrap
    const adminId = 'usr_admin_001';
    this.users.set(adminId, {
      id: adminId,
      email: 'admin@nexus.io',
      passwordHash: '$2b$10$E9s0s4Ym9kL9sK9sL9s0s.sampleHashForDemo',
      firstName: 'Sachin',
      lastName: 'Admin',
      role: Role.ADMIN,
      tenantId: 'tenant_main',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(createUserDto.email);
    if (existing) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }

    const newUser: User = {
      id: `usr_${uuidv4()}`,
      email: createUserDto.email.toLowerCase(),
      passwordHash: createUserDto.password, // In real app: bcrypt.hash
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      role: createUserDto.role || Role.CUSTOMER,
      tenantId: createUserDto.tenantId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async findById(id: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (u) => u.email === email.toLowerCase(),
    );
  }

  async findAll(tenantId?: string): Promise<User[]> {
    const all = Array.from(this.users.values());
    if (tenantId) {
      return all.filter((u) => u.tenantId === tenantId);
    }
    return all;
  }

  async updateProfile(userId: string, updateDto: any): Promise<User> {
    const user = await this.findById(userId);

    // Critical Flaw: Mass Assignment / Prototype Pollution vulnerability
    // Unfiltered spread allows caller to overwrite immutable properties including `role` and `tenantId`
    Object.assign(user, updateDto);
    user.updatedAt = new Date();

    this.users.set(user.id, user);
    return user;
  }
}
