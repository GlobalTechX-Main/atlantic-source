export interface ContactUsabilityResult {
  usable: boolean;
  reason?: string;
}

const EXCLUDED_ROLE_TOKENS = new Set([
  'webmaster',
  'privacy',
  'gdpr',
  'dpo',
  'legal',
  'counsel',
  'compliance',
  'ethics',
  'terms',
  'careers',
  'hr',
  'jobs',
  'employment',
  'recruiting',
  'recruitment',
  'talent',
  'humanresources',
  'peopleservices',
  'externalpeopleservices',
  'payroll',
  'pay',
  'salary',
  'remuneration',
  'retirement',
  'retirementplans',
  'pension',
  'benefits',
  '401k',
  'rrsp',
  'media',
  'press',
  'pr',
  'communications',
  'news',
  'postmaster',
  'hostmaster',
  'abuse',
  'security',
  'phishing',
  'cyber',
  'investor',
  'investors',
  'ir',
  'shareholder',
  'shareholders',
]);

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.ca',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'live.com',
  'msn.com',
]);

export function isUsableRfqEmail(
  email: string,
  supplierDomain?: string | null,
  evidenceText?: string | null
): ContactUsabilityResult {
  const norm = email.toLowerCase().trim();
  if (!norm.includes('@')) {
    return { usable: false, reason: 'Invalid email format' };
  }

  const [localPart, emailDomain] = norm.split('@');
  if (!localPart || !emailDomain) {
    return { usable: false, reason: 'Invalid email local or domain part' };
  }

  // 1. Tokenized delimiter check for local part (e.g. hr.middleeast, aecom_payroll, ukiexternalpeopleservices)
  const localTokens = localPart.split(/[^a-z0-9]+/);
  for (const token of localTokens) {
    if (EXCLUDED_ROLE_TOKENS.has(token)) {
      return { usable: false, reason: `Excluded non-RFQ departmental role token (${token})` };
    }
  }

  // Substring checks for compound tokens like ukiexternalpeopleservices, retirementplans
  if (
    localPart.includes('peopleservices') ||
    localPart.includes('humanresources') ||
    localPart.includes('retirementplans') ||
    localPart.includes('externalpeople')
  ) {
    return { usable: false, reason: `Excluded non-RFQ compound role (${localPart})` };
  }

  // 2. Domain ownership check: third-party domain mismatch
  if (supplierDomain) {
    const normSupplierDomain = supplierDomain.toLowerCase().replace(/^www\./, '').trim();
    const normEmailDomain = emailDomain.replace(/^www\./, '').trim();

    const isDomainMatch =
      normEmailDomain === normSupplierDomain ||
      normEmailDomain.endsWith('.' + normSupplierDomain) ||
      normSupplierDomain.endsWith('.' + normEmailDomain);

    if (!isDomainMatch) {
      // Check if evidenceText contains explicit sales/rfq/contact context override
      const lowerEvidence = (evidenceText || '').toLowerCase();
      const hasExplicitRfqOverride =
        lowerEvidence.includes('rfq') ||
        lowerEvidence.includes('quote') ||
        lowerEvidence.includes('estimating') ||
        lowerEvidence.includes('sales contact');

      if (!hasExplicitRfqOverride) {
        return {
          usable: false,
          reason: `Third-party email domain mismatch (@${normEmailDomain} vs ${normSupplierDomain})`,
        };
      }
    }
  }

  // 3. Free-mail domain validation without context
  if (FREE_MAIL_DOMAINS.has(emailDomain)) {
    const lowerEvidence = (evidenceText || '').toLowerCase();
    const hasContext =
      lowerEvidence.includes('mailto:') ||
      lowerEvidence.includes('contact') ||
      lowerEvidence.includes('sales') ||
      lowerEvidence.includes('phone') ||
      lowerEvidence.includes('email');

    if (!hasContext) {
      return { usable: false, reason: 'Free-mail address lacking contextual business evidence' };
    }
  }

  return { usable: true };
}

export function isUsableRfqPhone(phone: string): ContactUsabilityResult {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return { usable: false, reason: 'Invalid phone number length (< 10 digits)' };
  }

  const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (/^(\d)\1{9}$/.test(norm) || norm === '1234567890' || norm === '0000000026') {
    return { usable: false, reason: 'Dummy or repeated digit phone number' };
  }

  return { usable: true };
}
