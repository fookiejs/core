export class GraphqlServerError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  static create(message: string): GraphqlServerError {
    return new GraphqlServerError(message);
  }
}

export class RegistryError extends GraphqlServerError {
  static override create(message: string): RegistryError {
    return new RegistryError(message);
  }
}

export class NamingError extends GraphqlServerError {
  static override create(message: string): NamingError {
    return new NamingError(message);
  }
}

export class QueryTooLargeError extends GraphqlServerError {
  static override create(message: string): QueryTooLargeError {
    return new QueryTooLargeError(message);
  }
}
