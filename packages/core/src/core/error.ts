import { plainToClass } from "class-transformer";

export class FookieError extends Error {
  validationErrors!: {
    [key: string]: string[];
  };

  static create(error: FookieError) {
    return plainToClass(FookieError, error);
  }
}
