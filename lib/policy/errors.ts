export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export class InvalidFilterError extends Error {
  constructor() {
    super("Invalid filter");
    this.name = "InvalidFilterError";
  }
}
