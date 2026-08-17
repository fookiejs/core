export class AnalyzeError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  static create(message: string): AnalyzeError {
    return new AnalyzeError(message);
  }
}
