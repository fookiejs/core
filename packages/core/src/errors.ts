export class FookieError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  static create(message: string): FookieError {
    return new FookieError(message);
  }
}

export class PgEncodeError extends FookieError {
  private constructor(message: string) {
    super(message);
  }

  static override create(message: string): PgEncodeError {
    return new PgEncodeError(message);
  }
}

export class ModelFieldError extends FookieError {
  private constructor(message: string) {
    super(message);
  }

  static override create(message: string): ModelFieldError {
    return new ModelFieldError(message);
  }
}

export class NotFoundError extends FookieError {
  private constructor(message: string) {
    super(message);
  }

  static override create(message: string): NotFoundError {
    return new NotFoundError(message);
  }
}

export class ValidationError extends FookieError {
  private constructor(message: string) {
    super(message);
  }

  static override create(message: string): ValidationError {
    return new ValidationError(message);
  }
}

export class DatabaseError extends FookieError {
  private constructor(message: string) {
    super(message);
  }

  static override create(message: string): DatabaseError {
    return new DatabaseError(message);
  }
}
