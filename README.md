# Nexus Commerce API 🛍️⚡

A modular, multi-tenant enterprise e-commerce backend service architected with **NestJS**, **TypeScript**, and **Passport JWT** authentication.

## 🚀 Overview

Nexus Commerce provides resilient backend services for digital storefronts, powering:
- **Authentication & RBAC**: JWT access tokens with granular role-based authorization (`ADMIN`, `MERCHANT`, `CUSTOMER`).
- **Catalog & Inventory Service**: Real-time product tracking, SKU management, and stock allocation.
- **Order Processing Lifecycle**: Multi-tenant checkout orchestration, order state transitions, and fulfillment hooks.
- **Auditing & Enterprise Resilience**: Structured exception filters, response transformation interceptors, and tenant isolation layers.

---

## 🏛️ Architecture

The codebase follows the recommended NestJS modular design pattern:

```text
src/
├── auth/            # JWT authentication, login/registration strategies
├── users/           # User lifecycle, profile management, role policies
├── products/        # Product catalog, pricing, and stock inventory
├── orders/          # Order pipeline, payments, and refund processing
├── common/          # Cross-cutting guards, decorators, and HTTP filters
├── app.module.ts    # Root application module orchestration
└── main.ts          # Application bootstrap & global pipes
```

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js >= 18.x
- npm / pnpm / yarn

### 2. Installation
```bash
npm install
```

### 3. Running Locally
```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 4. Running Tests
```bash
npm run test
```

---

## 🛡️ Security & Reliability Policies
- All incoming payload DTOs are validated using `class-validator` and `ValidationPipe`.
- Cross-tenant boundaries are strictly isolated by `tenantId` context.
- Sensitive endpoints require bearer token authentication via `JwtAuthGuard`.

---

## 📜 License
MIT © 2026 Sachin Jat
