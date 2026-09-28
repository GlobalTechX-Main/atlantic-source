import { describe, it, expect } from "vitest";
import { officeForPhone, isHomeOffice } from "@/lib/contacts/office";
import { selectRfqContactsFromClaims } from "@/lib/contacts/selection";

// Shortened from a real Atlantic contact page.
const CONTACT_PAGE =
  "Corporate Offices 2 Bloor Street East, Suite 2100, Toronto, ON M4W 1A8. (416) 920-5100 Branch Offices Atlantic Region " +
  "Bathurst, NB – 1945 Miramichi Ave, Bathurst, NB E2A 1Y7. (506) 547-8070 " +
  "Dartmouth, NS – 60 Cutler Avenue, Dartmouth, NS B3B 0J6. (902) 468-3101 " +
  "Fredericton, NB – 60 Melissa Street, Building #3, Unit #7, Richibucto Road, NB E3A 6W1. (506) 459-1650 " +
  "Moncton, NB – 1350 Aviation Ave, Dieppe, NB E1A 9A3. (506) 858-5688 " +
  "Saint John, NB – 53 Clark Road, Saint John, NB E2E 2K9. (506) 693-4822 " +
  "St. John’s, NL (Mount Pearl) – 26A Dundee Avenue, Mount Pearl, NL A1N 4R7. (709) 747-1406";

describe("officeForPhone", () => {
  it("names the office each number on a branch list belongs to", () => {
    expect(officeForPhone(CONTACT_PAGE, "5065478070")).toBe("Bathurst");
    expect(officeForPhone(CONTACT_PAGE, "9024683101")).toBe("Dartmouth");
    expect(officeForPhone(CONTACT_PAGE, "5064591650")).toBe("Fredericton");
    expect(officeForPhone(CONTACT_PAGE, "5068585688")).toBe("Moncton");
    expect(officeForPhone(CONTACT_PAGE, "5066934822")).toBe("Saint John");
  });

  it("ignores towns that are not written as part of an address", () => {
    const text = "We proudly serve Moncton, Saint John and Fredericton. Call us today at 506-555-0142";
    expect(officeForPhone(text, "5065550142")).toBeNull();
  });

  it("returns null when the number is not on the page", () => {
    expect(officeForPhone(CONTACT_PAGE, "5065550000")).toBeNull();
  });

  it("counts nearby towns as the listed city", () => {
    expect(isHomeOffice("Dieppe", "Moncton")).toBe(true);
    expect(isHomeOffice("Bathurst", "Moncton")).toBe(false);
  });
});

describe("selectRfqContactsFromClaims with offices", () => {
  const phones = ["5065478070", "9024683101", "5064591650", "5068585688", "5066934822"].map((n, i) => ({
    id: `c${i}`,
    claimType: "CONTACT",
    rawValue: n,
    normalizedValue: n,
    sourceDocumentId: "doc1",
  }));
  const officeOf = (c: { normalizedValue: string | null; rawValue: string }) => officeForPhone(CONTACT_PAGE, c.normalizedValue || c.rawValue);

  it("makes the listed city's branch the primary number and labels offices", () => {
    const res = selectRfqContactsFromClaims(phones, "blackandmcdonald.com", { homeCity: "Moncton", officeOf });
    expect(res.primary?.normalizedValue).toBe("5068585688");
    expect(res.primary?.office).toBe("Moncton");
    expect(res.allSelected.every((c) => c.office)).toBe(true);
  });

  it("keeps the best email among the three chosen so quote requests can be delivered", () => {
    const withEmail = [
      ...phones,
      { id: "e1", claimType: "CONTACT", rawValue: "jane.doe@blackandmcdonald.com", normalizedValue: "jane.doe@blackandmcdonald.com", evidenceText: "x" },
    ];
    const res = selectRfqContactsFromClaims(withEmail, "blackandmcdonald.com", { homeCity: "Moncton", officeOf });
    expect(res.allSelected.some((c) => c.isEmail)).toBe(true);
    expect(res.allSelected).toHaveLength(3);
    expect(res.primary?.normalizedValue).toBe("5068585688");
  });
});

describe("officeForPhone page layouts", () => {
  it("uses a town heading written after the previous office's address", () => {
    const text = "Moncton (506) 861-2572 291 de Fiedmont St. Moncton, N.B. E1A 6N5 View on Map Truro (902) 897-2717";
    expect(officeForPhone(text, "9028972717")).toBe("Truro");
  });

  it("only looks at the last address block before the number", () => {
    const text =
      "Imperial Ltd. 90 Cutler Avenue, Unit 1 Dartmouth, NS, Canada B3B 0J6 Office: Properties 679 Main Street, Suite 309 Moncton, NB, Canada E1C 1E3 Office: 506-858-9113";
    expect(officeForPhone(text, "5068589113")).toBe("Moncton");
  });

  it("does not label an out-of-region number with the office before it", () => {
    const text = "Canada +1 (902) 469-3606 5 Notting Court Dartmouth, Nova Scotia B3B 1N2, Canada United States +1 (207) 645-4300";
    expect(officeForPhone(text, "2076454300")).toBeNull();
  });
});
