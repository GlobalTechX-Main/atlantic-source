import { describe, it, expect } from "vitest";
import { officeFromSourceUrl, townBeforePhone, regionForAreaCode } from "@/lib/contacts/office";

describe("phone labels", () => {
  it("names the office from a location page address", () => {
    expect(officeFromSourceUrl("https://armtec.com/locations/bishops-falls")).toBe("Bishops Falls");
    expect(officeFromSourceUrl("https://armtec.com/new-brunswick")).toBe("New Brunswick");
    expect(officeFromSourceUrl("https://armtec.com/alberta/")).toBe("Alberta");
    expect(officeFromSourceUrl("https://armtec.com/locations")).toBeNull();
    expect(officeFromSourceUrl("https://armtec.com/about-us")).toBeNull();
  });
  it("finds a town not in our list from the address before the number", () => {
    const text = "Plant 12 Main Street, Bishop's Falls, NL A0H 1C0 Phone: (709) 258-6200";
    expect(townBeforePhone(text, "7092586200")).toBe("Bishop's Falls");
  });
  it("falls back to the area code region", () => {
    expect(regionForAreaCode("+15068585688")).toBe("New Brunswick line");
    expect(regionForAreaCode("9028972717")).toBe("Nova Scotia / PEI line");
    expect(regionForAreaCode("18005551234")).toBe("Toll-free line");
    expect(regionForAreaCode("4165551234")).toBe("Out-of-province line");
  });
});
