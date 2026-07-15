import { DataSource, ObjectLiteral, Repository } from "typeorm";
import { Transaction, TransactionCallback } from "./transaction.types";

class TypeOrmTransaction implements Transaction {
  private isCommitted = false;
  private isRolledBack = false;

  constructor(
    private readonly queryRunner: ReturnType<DataSource["createQueryRunner"]>,
  ) {}

  getRepository<T extends ObjectLiteral>(
    target: new () => T,
  ): Repository<T> {
    return this.queryRunner.manager.getRepository(target);
  }

  async discard(): Promise<void> {
    if (this.isCommitted || this.isRolledBack) return;

    try {
      await this.queryRunner.rollbackTransaction();
    } finally {
      this.isRolledBack = true;
      await this.queryRunner.release();
    }
  }

  async commit(): Promise<void> {
    await this.queryRunner.commitTransaction();
    this.isCommitted = true;
    await this.queryRunner.release();
  }

  async rollback(): Promise<void> {
    try {
      await this.queryRunner.rollbackTransaction();
    } finally {
      this.isRolledBack = true;
      await this.queryRunner.release();
    }
  }
}

export async function createTransaction<T>(
  dataSource: DataSource,
  callback: TransactionCallback<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  const trx = new TypeOrmTransaction(queryRunner);

  try {
    const result = await callback(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
