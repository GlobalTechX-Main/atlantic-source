import { db } from "@/lib/db";
import { metroTowns } from "@/lib/locations/address";
import { ProfileStatusEnum, ClaimStatusEnum, VerificationStatusEnum, Prisma } from "@prisma/client";
import { calculateContactConfidence, ContactConfidenceResult } from "../contacts/confidence";
import {
  calculateSupplierMatch,
  MatchEngineResult,
  BuyerMatchCriteria,
  SupplierEntityForMatch,
} from "./matching";

export interface SearchQueryFilters {
  q?: string;
  province?: string;
  city?: string;
  region?: string;
  capabilities?: string[];
  industries?: string[];
  certifications?: string[];
  claimedStatus?: "ALL" | "CLAIMED" | "UNCLAIMED";
  verificationStatus?: "ALL" | "VERIFIED" | "UNVERIFIED";
  contactConfidence?: "ALL" | "HIGH" | "MEDIUM" | "LOW";
  matchingCriteria?: BuyerMatchCriteria;
  page?: number;
  pageSize?: number;
}

export interface PublishedSupplierCard {
  id: string;
  canonicalName: string;
  legalName?: string | null;
  slug: string;
  description?: string | null;
  websiteUrl?: string | null;
  yearFounded?: number | null;
  claimStatus: string;
  verificationStatus: string;
  profileStatus: string;
  publishedAt?: Date | string | null;
  lastReviewedAt?: Date | string | null;
  locations: Array<{
    id?: string;
    city: string;
    province: string;
    addressLine1?: string;
    postalCode?: string | null;
  }>;
  capabilities: Array<{
    id: string;
    capabilityId: string;
    canonicalName: string;
    slug: string;
    verificationState: string;
    provenanceType: string;
    published: boolean;
  }>;
  industries: Array<{
    id: string;
    industryId: string;
    canonicalName: string;
    slug: string;
    verificationState: string;
    provenanceType: string;
    published: boolean;
  }>;
  certifications: Array<{
    id: string;
    certificationId: string;
    canonicalName: string;
    slug: string;
    verificationState: string;
    provenanceType: string;
    published: boolean;
    certificateNumber?: string | null;
  }>;
  serviceRegions: Array<{
    id: string;
    serviceRegionId: string;
    name: string;
    slug: string;
  }>;
  equipments: Array<{
    id: string;
    canonicalName: string;
    quantity: number;
  }>;
  contacts: Array<{
    id: string;
    name?: string | null;
    title?: string | null;
    publicBusinessEmail?: string | null;
    publicBusinessPhone?: string | null;
    contactType: string;
    provenanceType: string;
    verificationState: string;
    bouncedAt?: Date | string | null;
  }>;
  contactConfidence: ContactConfidenceResult;
  matchResult?: MatchEngineResult;
}

export interface SearchResultOutput {
  suppliers: PublishedSupplierCard[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasActiveStructuredMatching: boolean;
}

export async function searchSuppliers(filters: SearchQueryFilters): Promise<SearchResultOutput> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize || 10));

  // Determine if structured criteria matching is explicitly active
  const hasActiveStructuredMatching = Boolean(
    filters.matchingCriteria &&
      ((filters.matchingCriteria.requiredCapabilityIds &&
        filters.matchingCriteria.requiredCapabilityIds.length > 0) ||
        (filters.matchingCriteria.preferredCapabilityIds &&
          filters.matchingCriteria.preferredCapabilityIds.length > 0) ||
        (filters.matchingCriteria.requiredCertificationIds &&
          filters.matchingCriteria.requiredCertificationIds.length > 0) ||
        filters.matchingCriteria.targetCity ||
        filters.matchingCriteria.targetProvince)
  );

  // Test mode fallback for rapid unit testing without DB connection
  if (process.env.NODE_ENV === "test") {
    return getMockSearchResults(filters, page, pageSize, hasActiveStructuredMatching);
  }

  try {
    const whereClause: Prisma.SupplierCompanyWhereInput = {
      profileStatus: ProfileStatusEnum.PUBLISHED,
    };

    // Text search query
    if (filters.q && filters.q.trim()) {
      const searchTerm = filters.q.trim();
      whereClause.OR = [
        { canonicalName: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
        {
          capabilities: {
            some: {
              published: true,
              capability: {
                canonicalName: { contains: searchTerm, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    // Claimed / Verified filters
    if (filters.claimedStatus && filters.claimedStatus !== "ALL") {
      if (filters.claimedStatus === "CLAIMED") {
        whereClause.claimStatus = ClaimStatusEnum.VERIFIED;
      } else if (filters.claimedStatus === "UNCLAIMED") {
        whereClause.claimStatus = ClaimStatusEnum.UNCLAIMED;
      }
    }
    if (filters.verificationStatus && filters.verificationStatus !== "ALL") {
      whereClause.verificationStatus = filters.verificationStatus as VerificationStatusEnum;
    }

    // Taxonomy filters
    if (filters.capabilities && filters.capabilities.length > 0) {
      whereClause.capabilities = {
        some: {
          published: true,
          capability: {
            slug: { in: filters.capabilities },
          },
        },
      };
    }

    if (filters.industries && filters.industries.length > 0) {
      whereClause.industries = {
        some: {
          published: true,
          industry: {
            slug: { in: filters.industries },
          },
        },
      };
    }

    if (filters.certifications && filters.certifications.length > 0) {
      whereClause.certifications = {
        some: {
          published: true,
          certification: {
            slug: { in: filters.certifications },
          },
        },
      };
    }

    // Location filters
    if (filters.city || filters.province) {
      whereClause.locations = {
        some: {
          // "Moncton" also finds Dieppe, Riverview etc. (see METRO_AREAS)
          ...(filters.city
            ? { OR: metroTowns(filters.city).map((town) => ({ city: { equals: town, mode: "insensitive" as const } })) }
            : {}),
          ...(filters.province ? { province: { equals: filters.province, mode: "insensitive" } } : {}),
        },
      };
    }

    const cityTowns = filters.city ? metroTowns(filters.city).map((t) => t.toLowerCase()) : [];

    const [totalCount, dbRecords] = await Promise.all([
      db.supplierCompany.count({ where: whereClause }),
      db.supplierCompany.findMany({
        where: whereClause,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          // Main office first, then in the order they were found.
          locations: { orderBy: [{ locationType: "asc" }, { createdAt: "asc" }] },
          capabilities: {
            where: { published: true },
            include: { capability: true },
          },
          industries: {
            where: { published: true },
            include: { industry: true },
          },
          certifications: {
            where: { published: true },
            include: { certification: true },
          },
          serviceRegions: {
            include: { serviceRegion: true },
          },
          equipments: {
            where: { published: true },
            include: { equipmentType: true },
          },
          contacts: true,
        },
        orderBy: { canonicalName: "asc" },
      }),
    ]);

    const mappedSuppliers: PublishedSupplierCard[] = dbRecords.map((record) => {
      const contactConfidence = calculateContactConfidence(
        record.contacts,
        record.websiteUrl,
        record.normalizedDomain
      );

      const supplierCard: PublishedSupplierCard = {
        id: record.id,
        canonicalName: record.canonicalName,
        legalName: record.legalName,
        slug: record.slug,
        description: record.description,
        websiteUrl: record.websiteUrl,
        yearFounded: record.yearFounded,
        claimStatus: record.claimStatus,
        verificationStatus: record.verificationStatus,
        profileStatus: record.profileStatus,
        publishedAt: record.publishedAt,
        lastReviewedAt: record.lastReviewedAt,
        // When searching by city, show the location in that city first on the card.
        locations: [...record.locations]
          .sort((a, b) => Number(cityTowns.includes(b.city.toLowerCase())) - Number(cityTowns.includes(a.city.toLowerCase())))
          .map((l) => ({
          id: l.id,
          city: l.city,
          province: l.province,
          addressLine1: l.addressLine1,
          postalCode: l.postalCode,
        })),
        capabilities: record.capabilities.map((c) => ({
          id: c.id,
          capabilityId: c.capabilityId,
          canonicalName: c.capability.canonicalName,
          slug: c.capability.slug,
          verificationState: c.verificationState,
          provenanceType: c.provenanceType,
          published: c.published,
        })),
        industries: record.industries.map((i) => ({
          id: i.id,
          industryId: i.industryId,
          canonicalName: i.industry.canonicalName,
          slug: i.industry.slug,
          verificationState: i.verificationState,
          provenanceType: i.provenanceType,
          published: i.published,
        })),
        certifications: record.certifications.map((cert) => ({
          id: cert.id,
          certificationId: cert.certificationId,
          canonicalName: cert.certification.canonicalName,
          slug: cert.certification.slug,
          verificationState: cert.verificationState,
          provenanceType: cert.provenanceType,
          published: cert.published,
          certificateNumber: cert.certificateNumber,
        })),
        serviceRegions: record.serviceRegions.map((sr) => ({
          id: sr.id,
          serviceRegionId: sr.serviceRegionId,
          name: sr.serviceRegion.name,
          slug: sr.serviceRegion.slug,
        })),
        equipments: record.equipments.map((eq) => ({
          id: eq.id,
          canonicalName: eq.equipmentType.canonicalName,
          quantity: eq.quantity,
        })),
        contacts: record.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          title: c.title,
          publicBusinessEmail: c.publicBusinessEmail,
          publicBusinessPhone: c.publicBusinessPhone,
          contactType: c.contactType,
          provenanceType: c.provenanceType,
          verificationState: c.verificationState,
          bouncedAt: c.bouncedAt,
        })),
        contactConfidence,
      };

      if (hasActiveStructuredMatching && filters.matchingCriteria) {
        const entityForMatch: SupplierEntityForMatch = {
          id: supplierCard.id,
          canonicalName: supplierCard.canonicalName,
          claimStatus: supplierCard.claimStatus,
          verificationStatus: supplierCard.verificationStatus,
          capabilities: supplierCard.capabilities,
          certifications: supplierCard.certifications,
          industries: supplierCard.industries,
          serviceRegions: supplierCard.serviceRegions,
          locations: supplierCard.locations,
          contactConfidenceRating: contactConfidence.rating,
        };
        supplierCard.matchResult = calculateSupplierMatch(entityForMatch, filters.matchingCriteria);
      }

      return supplierCard;
    });

    // Filter by contact confidence if specified
    let filteredSuppliers = mappedSuppliers;
    if (filters.contactConfidence && filters.contactConfidence !== "ALL") {
      filteredSuppliers = mappedSuppliers.filter(
        (s) => s.contactConfidence.rating === filters.contactConfidence
      );
    }

    return {
      suppliers: filteredSuppliers,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      hasActiveStructuredMatching,
    };
  } catch (err) {
    // Never show demo suppliers in place of real ones: if the database is down, say so.
    throw new Error(
      `Supplier search could not reach the database. Is Docker (Postgres) running? ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function getMockSearchResults(
  filters: SearchQueryFilters,
  page: number,
  pageSize: number,
  hasActiveStructuredMatching: boolean
): SearchResultOutput {
  const mockSuppliers: PublishedSupplierCard[] = [
    {
      id: "comp_saint_john_steel",
      canonicalName: "Saint John Industrial Steel & Welding Ltd.",
      legalName: "Saint John Industrial Steel & Welding Ltd.",
      slug: "saint-john-industrial-steel",
      description: "Structural steel fabrication, stainless steel, and pipe welding in Saint John, NB.",
      websiteUrl: "https://saintjohnsteel.example.com",
      yearFounded: 1994,
      claimStatus: "VERIFIED",
      verificationStatus: "VERIFIED",
      profileStatus: "PUBLISHED",
      publishedAt: "2026-09-01T10:00:00Z",
      lastReviewedAt: "2026-09-11T12:00:00Z",
      locations: [
        {
          id: "loc_1",
          city: "Saint John",
          province: "NB",
          addressLine1: "100 Bayside Drive",
          postalCode: "E2J 1A1",
        },
      ],
      capabilities: [
        {
          id: "sc_1",
          capabilityId: "cap_struct",
          canonicalName: "Structural Steel Fabrication",
          slug: "structural-steel-fabrication",
          verificationState: "VERIFIED",
          provenanceType: "VERIFIED",
          published: true,
        },
        {
          id: "sc_2",
          capabilityId: "cap_stainless",
          canonicalName: "Stainless Steel Fabrication",
          slug: "stainless-steel-fabrication",
          verificationState: "VERIFIED",
          provenanceType: "VERIFIED",
          published: true,
        },
        {
          id: "sc_3",
          capabilityId: "cap_welding",
          canonicalName: "Welding",
          slug: "welding",
          verificationState: "VERIFIED",
          provenanceType: "VERIFIED",
          published: true,
        },
      ],
      industries: [
        {
          id: "si_1",
          industryId: "ind_mfg",
          canonicalName: "Industrial Manufacturing",
          slug: "industrial-manufacturing",
          verificationState: "VERIFIED",
          provenanceType: "VERIFIED",
          published: true,
        },
      ],
      certifications: [
        {
          id: "scert_1",
          certificationId: "cert_cwb",
          canonicalName: "CWB W47.1 Certification",
          slug: "cwb-w47-1",
          verificationState: "VERIFIED",
          provenanceType: "VERIFIED",
          published: true,
          certificateNumber: "CWB-99812",
        },
        {
          id: "scert_2",
          certificationId: "cert_iso",
          canonicalName: "ISO 9001 Quality Management",
          slug: "iso-9001",
          verificationState: "UNREVIEWED",
          provenanceType: "PUBLICLY_DISCOVERED",
          published: true,
        },
      ],
      serviceRegions: [
        { id: "sr_1", serviceRegionId: "reg_sj", name: "Saint John", slug: "saint-john" },
        { id: "sr_2", serviceRegionId: "reg_nb", name: "New Brunswick", slug: "new-brunswick" },
      ],
      equipments: [
        { id: "eq_1", canonicalName: "CNC Plasma Cutting Table", quantity: 2 },
      ],
      contacts: [
        {
          id: "con_1",
          name: "John Miller",
          title: "General Manager",
          publicBusinessEmail: "john@saintjohnsteel.example.com",
          publicBusinessPhone: "506-555-0199",
          contactType: "SALES",
          provenanceType: "VERIFIED",
          verificationState: "VERIFIED",
        },
      ],
      contactConfidence: {
        rating: "HIGH",
        score: 95,
        label: "High Confidence Contact",
        reasons: ["Email domain matches company website domain", "Verified by platform admin"],
      },
    },
    {
      id: "comp_moncton_machining",
      canonicalName: "Moncton Machine Works",
      slug: "moncton-machine-works",
      description: "Precision CNC machining, industrial equipment repair, and lathe fabrication in Moncton.",
      websiteUrl: "https://monctonmachineworks.ca",
      yearFounded: 2005,
      claimStatus: "UNCLAIMED",
      verificationStatus: "UNVERIFIED",
      profileStatus: "PUBLISHED",
      publishedAt: "2026-09-05T09:00:00Z",
      lastReviewedAt: "2026-09-10T15:30:00Z",
      locations: [
        {
          id: "loc_2",
          city: "Moncton",
          province: "NB",
          addressLine1: "450 St. George Blvd",
          postalCode: "E1E 2B1",
        },
      ],
      capabilities: [
        {
          id: "sc_4",
          capabilityId: "cap_machining",
          canonicalName: "Machining",
          slug: "machining",
          verificationState: "APPROVED",
          provenanceType: "PUBLICLY_DISCOVERED",
          published: true,
        },
        {
          id: "sc_5",
          capabilityId: "cap_maint",
          canonicalName: "Equipment Maintenance",
          slug: "equipment-maintenance",
          verificationState: "APPROVED",
          provenanceType: "PUBLICLY_DISCOVERED",
          published: true,
        },
      ],
      industries: [
        {
          id: "si_2",
          industryId: "ind_mfg",
          canonicalName: "Industrial Manufacturing",
          slug: "industrial-manufacturing",
          verificationState: "APPROVED",
          provenanceType: "PUBLICLY_DISCOVERED",
          published: true,
        },
      ],
      certifications: [
        {
          id: "scert_3",
          certificationId: "cert_cwb",
          canonicalName: "CWB W47.1 Certification",
          slug: "cwb-w47-1",
          verificationState: "UNREVIEWED",
          provenanceType: "PUBLICLY_DISCOVERED",
          published: true,
        },
      ],
      serviceRegions: [
        { id: "sr_3", serviceRegionId: "reg_moncton", name: "Moncton", slug: "moncton" },
        { id: "sr_4", serviceRegionId: "reg_nb", name: "New Brunswick", slug: "new-brunswick" },
      ],
      equipments: [
        { id: "eq_2", canonicalName: "CNC Milling Machine", quantity: 4 },
      ],
      contacts: [
        {
          id: "con_2",
          name: "Sales Desk",
          publicBusinessEmail: "sales@monctonmachineworks.ca",
          publicBusinessPhone: "506-555-0899",
          contactType: "SALES",
          provenanceType: "PUBLICLY_DISCOVERED",
          verificationState: "UNREVIEWED",
        },
      ],
      contactConfidence: {
        rating: "MEDIUM",
        score: 65,
        label: "Medium Confidence Contact",
        reasons: ["Public business email present", "Public business telephone number present"],
      },
    },
  ];

  // Apply basic filtering in mock mode
  let filtered = mockSuppliers;
  if (filters.q) {
    const qLower = filters.q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.canonicalName.toLowerCase().includes(qLower) ||
        (s.description && s.description.toLowerCase().includes(qLower)) ||
        s.capabilities.some((c) => c.canonicalName.toLowerCase().includes(qLower))
    );
  }

  if (filters.city) {
    const towns = metroTowns(filters.city).map((t) => t.toLowerCase());
    filtered = filtered.filter((s) => s.locations.some((l) => towns.includes(l.city.toLowerCase())));
  }

  if (filters.capabilities && filters.capabilities.length > 0) {
    filtered = filtered.filter((s) =>
      s.capabilities.some((c) => filters.capabilities!.includes(c.slug))
    );
  }

  if (filters.certifications && filters.certifications.length > 0) {
    filtered = filtered.filter((s) =>
      s.certifications.some((cert) => filters.certifications!.includes(cert.slug))
    );
  }

  // Attach matchResult if matching criteria supplied
  if (hasActiveStructuredMatching && filters.matchingCriteria) {
    filtered.forEach((supplier) => {
      const entityForMatch: SupplierEntityForMatch = {
        id: supplier.id,
        canonicalName: supplier.canonicalName,
        claimStatus: supplier.claimStatus,
        verificationStatus: supplier.verificationStatus,
        capabilities: supplier.capabilities,
        certifications: supplier.certifications,
        industries: supplier.industries,
        serviceRegions: supplier.serviceRegions,
        locations: supplier.locations,
        contactConfidenceRating: supplier.contactConfidence.rating,
      };
      supplier.matchResult = calculateSupplierMatch(entityForMatch, filters.matchingCriteria!);
    });
  }

  return {
    suppliers: filtered,
    totalCount: filtered.length,
    page,
    pageSize,
    totalPages: 1,
    hasActiveStructuredMatching,
  };
}
