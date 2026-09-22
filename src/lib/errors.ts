export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(message: string = "Validation failed", errors?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

export class SSRFValidationError extends AppError {
  constructor(message: string = "Invalid target URL or forbidden IP address") {
    super(message, 400, "SSRF_VALIDATION_ERROR");
  }
}
