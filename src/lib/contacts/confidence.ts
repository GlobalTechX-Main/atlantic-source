export type ContactConfidenceRating = "HIGH" | "MEDIUM" | "LOW";

export interface ContactConfidenceResult {
  rating: ContactConfidenceRating;
  score: number; // 0 to 100
  label: string;
  reasons: string[];
}

export interface ContactDataInput {
  publicBusinessEmail?: string | null;
  publicBusinessPhone?: string | null;
  provenanceType?: string | null;
  verificationState?: string | null;
  bouncedAt?: Date | string | null;
  lastVerifiedAt?: Date | string | null;
}

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
]);

export function calculateContactConfidence(
  contacts: ContactDataInput[],
  companyWebsiteUrl?: string | null,
  companyNormalizedDomain?: string | null
): ContactConfidenceResult {
  if (!contacts || contacts.length === 0) {
    return {
      rating: "LOW",
      score: 15,
      label: "Unverified Public Contact",
      reasons: ["No direct business contacts recorded on file"],
    };
  }

  let highestScore = 0;
  let bestRating: ContactConfidenceRating = "LOW";
  const accumulatedReasons: string[] = [];

  const targetDomain = (
    companyNormalizedDomain ||
    (companyWebsiteUrl ? extractDomain(companyWebsiteUrl) : "")
  ).toLowerCase();

  for (const contact of contacts) {
    let currentScore = 20;
    const reasons: string[] = [];

    // Check bounce status
    if (contact.bouncedAt) {
      currentScore = 10;
      reasons.push("Recent email bounce recorded");
    } else {
      if (contact.publicBusinessEmail) {
        currentScore += 30;
        const emailDomain = extractEmailDomain(contact.publicBusinessEmail);

        if (GENERIC_EMAIL_DOMAINS.has(emailDomain)) {
          currentScore -= 10;
          reasons.push("Uses generic webmail provider");
        } else if (targetDomain && emailDomain && targetDomain.includes(emailDomain)) {
          currentScore += 35;
          reasons.push("Email domain matches company website domain");
        } else {
          reasons.push("Public business email present");
        }
      }

      if (contact.publicBusinessPhone) {
        currentScore += 15;
        reasons.push("Public business telephone number present");
      }

      if (
        contact.provenanceType === "VERIFIED" ||
        contact.verificationState === "VERIFIED" ||
        contact.verificationState === "APPROVED"
      ) {
        currentScore += 20;
        reasons.push("Contact verified by AtlanticSource platform admin or claimed supplier");
      }
    }

    const clampedScore = Math.min(100, Math.max(0, currentScore));
    if (clampedScore > highestScore) {
      highestScore = clampedScore;
      accumulatedReasons.length = 0;
      accumulatedReasons.push(...reasons);
    }
  }

  if (highestScore >= 80) {
    bestRating = "HIGH";
  } else if (highestScore >= 45) {
    bestRating = "MEDIUM";
  } else {
    bestRating = "LOW";
  }

  const labelMap: Record<ContactConfidenceRating, string> = {
    HIGH: "High Confidence Contact",
    MEDIUM: "Medium Confidence Contact",
    LOW: "Unverified Public Contact",
  };

  return {
    rating: bestRating,
    score: highestScore,
    label: labelMap[bestRating],
    reasons: accumulatedReasons.length > 0 ? accumulatedReasons : ["Public web discovery"],
  };
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    const parts = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/");
    return parts[0] || "";
  }
}

function extractEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 && parts[1] ? parts[1] : "";
}
