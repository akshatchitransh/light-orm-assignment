/**
 * Standard error classes for @light-orm/core
 */

export class OrmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrmError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends OrmError {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends OrmError {
  constructor(modelName: string, queryDescription?: string) {
    const desc = queryDescription ? ` with criteria: ${queryDescription}` : "";
    super(`Record not found in '${modelName}'${desc}`);
    this.name = "NotFoundError";
  }
}

export class QueryError extends OrmError {
  constructor(
    message: string,
    public readonly sql?: string,
    public readonly params?: any[],
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "QueryError";
  }
}

export class ConnectionError extends OrmError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "ConnectionError";
  }
}
