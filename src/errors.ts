import { z } from "zod";

export function requireErrorMessage(message: string): string {
  const parsed = z.string().min(1).safeParse(message);
  if (parsed.success === false) {
    throw new Error("fookie error message must be non-empty");
  }
  if (parsed.data.length < 1) {
    throw new Error("fookie error message must be non-empty");
  }
  return parsed.data;
}

export class FookieError extends Error {
  protected constructor(message: string) {
    const safeMessage = requireErrorMessage(message);
    super(safeMessage);
    this.name = new.target.name;
    if (this.name.length < 1) {
      throw new Error("fookie error name must be non-empty");
    }
    if (this.message !== safeMessage) {
      throw new Error("fookie error message failed to apply");
    }
  }

  static create(message: string): FookieError {
    const safeMessage = requireErrorMessage(message);
    const err = new FookieError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("FookieError.create message mismatch");
    }
    if (err.name !== "FookieError") {
      throw new Error("FookieError.create name mismatch");
    }
    return err;
  }
}

export class PgEncodeError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "PgEncodeError") {
      throw new Error("PgEncodeError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("PgEncodeError message must be non-empty");
    }
  }

  static override create(message: string): PgEncodeError {
    const safeMessage = requireErrorMessage(message);
    const err = new PgEncodeError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("PgEncodeError.create message mismatch");
    }
    if (err.name !== "PgEncodeError") {
      throw new Error("PgEncodeError.create name mismatch");
    }
    return err;
  }
}

export class ModelFieldError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "ModelFieldError") {
      throw new Error("ModelFieldError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("ModelFieldError message must be non-empty");
    }
  }

  static override create(message: string): ModelFieldError {
    const safeMessage = requireErrorMessage(message);
    const err = new ModelFieldError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("ModelFieldError.create message mismatch");
    }
    if (err.name !== "ModelFieldError") {
      throw new Error("ModelFieldError.create name mismatch");
    }
    return err;
  }
}

export class NotFoundError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "NotFoundError") {
      throw new Error("NotFoundError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("NotFoundError message must be non-empty");
    }
  }

  static override create(message: string): NotFoundError {
    const safeMessage = requireErrorMessage(message);
    const err = new NotFoundError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("NotFoundError.create message mismatch");
    }
    if (err.name !== "NotFoundError") {
      throw new Error("NotFoundError.create name mismatch");
    }
    return err;
  }
}

export class ValidationError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "ValidationError") {
      throw new Error("ValidationError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("ValidationError message must be non-empty");
    }
  }

  static override create(message: string): ValidationError {
    const safeMessage = requireErrorMessage(message);
    const err = new ValidationError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("ValidationError.create message mismatch");
    }
    if (err.name !== "ValidationError") {
      throw new Error("ValidationError.create name mismatch");
    }
    return err;
  }
}

export class DatabaseError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "DatabaseError") {
      throw new Error("DatabaseError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("DatabaseError message must be non-empty");
    }
  }

  static override create(message: string): DatabaseError {
    const safeMessage = requireErrorMessage(message);
    const err = new DatabaseError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("DatabaseError.create message mismatch");
    }
    if (err.name !== "DatabaseError") {
      throw new Error("DatabaseError.create name mismatch");
    }
    return err;
  }
}
