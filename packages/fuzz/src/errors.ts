export class FuzzError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  static create(message: string): FuzzError {
    return new FuzzError(message);
  }
}
