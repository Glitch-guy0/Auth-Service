import { ObjectLiteral, Repository } from "typeorm";

export interface Transaction extends ObjectLiteral {
  getRepository<T extends ObjectLiteral>(
    target: new () => T,
  ): Repository<T>;
  discard(): Promise<void>;
}

export type TransactionCallback<T> = (trx: Transaction) => Promise<T>;
