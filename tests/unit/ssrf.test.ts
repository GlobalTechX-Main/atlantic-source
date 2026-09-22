import { describe, it, expect } from "vitest";
import {
  isForbiddenIPv4,
  isForbiddenIPv6,
  isForbiddenHostname,
  resolveAndValidateDestination,
} from "@/lib/crawler/ssrf";
import { SSRFValidationError } from "@/lib/errors";

describe("SSRF Protection & Safety Layer", () => {
  it("rejects forbidden IPv4 addresses (loopback, private, link-local, cloud metadata)", () => {
    expect(isForbiddenIPv4("127.0.0.1")).toBe(true);
    expect(isForbiddenIPv4("127.0.0.2")).toBe(true);
    expect(isForbiddenIPv4("169.254.169.254")).toBe(true); // AWS Metadata
    expect(isForbiddenIPv4("10.0.0.1")).toBe(true);
    expect(isForbiddenIPv4("172.16.0.1")).toBe(true);
    expect(isForbiddenIPv4("192.168.1.1")).toBe(true);
    expect(isForbiddenIPv4("100.64.0.1")).toBe(true); // CG-NAT
    expect(isForbiddenIPv4("0.0.0.0")).toBe(true);
    expect(isForbiddenIPv4("224.0.0.1")).toBe(true); // Multicast

    // Valid public IP passes
    expect(isForbiddenIPv4("142.250.190.46")).toBe(false);
  });

  it("rejects forbidden IPv6 addresses", () => {
    expect(isForbiddenIPv6("::1")).toBe(true);
    expect(isForbiddenIPv6("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isForbiddenIPv6("fe80::1")).toBe(true);
    expect(isForbiddenIPv6("fc00::1")).toBe(true);
    expect(isForbiddenIPv6("::ffff:127.0.0.1")).toBe(true);
  });

  it("rejects internal hostnames and aliases", () => {
    expect(isForbiddenHostname("localhost")).toBe(true);
    expect(isForbiddenHostname("LOCALHOST")).toBe(true);
    expect(isForbiddenHostname("server.local")).toBe(true);
    expect(isForbiddenHostname("db.internal")).toBe(true);
    expect(isForbiddenHostname("app.lan")).toBe(true);

    expect(isForbiddenHostname("saintjohnsteel.example.com")).toBe(false);
  });

  it("validates scheme and throws SSRFValidationError for forbidden protocols", async () => {
    await expect(resolveAndValidateDestination("file:///etc/passwd")).rejects.toThrow(SSRFValidationError);
    await expect(resolveAndValidateDestination("ftp://example.com/file")).rejects.toThrow(SSRFValidationError);
    await expect(resolveAndValidateDestination("gopher://127.0.0.1:70")).rejects.toThrow(SSRFValidationError);
    await expect(resolveAndValidateDestination("data:text/html,test")).rejects.toThrow(SSRFValidationError);
  });

  it("rejects loopback and metadata IP URLs directly", async () => {
    await expect(resolveAndValidateDestination("http://127.0.0.1/admin")).rejects.toThrow(SSRFValidationError);
    await expect(resolveAndValidateDestination("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(SSRFValidationError);
    await expect(resolveAndValidateDestination("http://localhost:5432")).rejects.toThrow(SSRFValidationError);
  });
});
