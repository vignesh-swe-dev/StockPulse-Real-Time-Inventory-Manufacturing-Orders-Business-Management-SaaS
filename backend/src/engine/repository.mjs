/**
 * StockPulse Data Persistence Repository Interface
 * Provides seamless switching between in-memory state (for fast zero-dependency testing)
 * and PostgreSQL persistence via Prisma (with transactions, optimistic concurrency, and idempotency).
 */
import { DomainError } from "./stockpulse-engine.mjs";

export class MemoryRepository {
  constructor(state) {
    this.state = state;
  }

  async runTransaction(txFn) {
    // Handled in stockpulse-engine via mutex & snapshot rollback
    return txFn(this);
  }

  async checkOptimisticLock(balance, expectedVersion) {
    if (balance.version !== expectedVersion) {
      throw new DomainError(
        "OPTIMISTIC_CONCURRENCY_CONFLICT",
        `Stock balance for product ${balance.productId} was modified by a concurrent operation. Please retry.`,
        409
      );
    }
  }

  async findIdempotency(tenantId, operation, key) {
    return this.state.idempotencyRecords.get(`${tenantId}:${operation}:${key}`);
  }

  async saveIdempotency(tenantId, operation, key, record) {
    this.state.idempotencyRecords.set(`${tenantId}:${operation}:${key}`, record);
  }
}

export class PrismaRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  async runTransaction(txFn) {
    return this.prisma.$transaction(async (tx) => {
      return txFn(new PrismaRepository(tx));
    });
  }

  async checkOptimisticLock(balanceId, expectedVersion, nextData) {
    const updated = await this.prisma.stockBalance.updateMany({
      where: {
        id: balanceId,
        version: expectedVersion
      },
      data: {
        ...nextData,
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });

    if (updated.count === 0) {
      throw new DomainError(
        "OPTIMISTIC_CONCURRENCY_CONFLICT",
        "Stock balance was modified concurrently by another transaction. Please retry.",
        409
      );
    }
  }

  async findIdempotency(tenantId, operation, key) {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: {
        tenantId_operation_idempotencyKey: {
          tenantId,
          operation,
          idempotencyKey: key
        }
      }
    });
    return record ? JSON.parse(record.responsePayload) : null;
  }

  async saveIdempotency(tenantId, operation, key, payload, statusCode = 200) {
    await this.prisma.idempotencyRecord.upsert({
      where: {
        tenantId_operation_idempotencyKey: {
          tenantId,
          operation,
          idempotencyKey: key
        }
      },
      update: {
        responsePayload: JSON.stringify(payload),
        statusCode
      },
      create: {
        tenantId,
        operation,
        idempotencyKey: key,
        responsePayload: JSON.stringify(payload),
        statusCode,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
      }
    });
  }
}

export function createRepository(engineState, prismaInstance = null) {
  if (prismaInstance) {
    return new PrismaRepository(prismaInstance);
  }
  return new MemoryRepository(engineState);
}
