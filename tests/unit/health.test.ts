import { describe, it, expect } from "vitest";
import { AppError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, SSRFValidationError } from "@/lib/errors";

describe("Application Error Utility Classes", () => {
  it("should create AppError with status code and error code", () => {
    const error = new AppError("System issue", 500, "SYSTEM_ERROR");
    expect(error.message).toBe("System issue");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("SYSTEM_ERROR");
  });

  it("should format UnauthorizedError correctly", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("should format ForbiddenError correctly", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("should format NotFoundError correctly", () => {
    const error = new NotFoundError("Supplier profile not found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Supplier profile not found");
  });

  it("should format ValidationError with field errors", () => {
    const fieldErrors = { email: ["Invalid email domain"] };
    const error = new ValidationError("Validation failed", fieldErrors);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.errors).toEqual(fieldErrors);
  });

  it("should format SSRFValidationError correctly", () => {
    const error = new SSRFValidationError("Internal IP addresses forbidden");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("SSRF_VALIDATION_ERROR");
  });
});
