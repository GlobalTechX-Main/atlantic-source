import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function forensicAudit() {
  console.log('=== FORENSIC DATABASE & DATA AUDIT ===\n');

  // 1. Connection Audit
  const dbUrl = process.env.DATABASE_URL || '';
  const parsedUrl = new URL(dbUrl);
  console.log('--- 1. DATABASE CONNECTION AUDIT ---');
  console.log(`Database Host: ${parsedUrl.hostname}`);
  console.log(`Database Port: ${parsedUrl.port}`);
  console.log(`Database Name: ${parsedUrl.pathname.replace('/', '')}`);
  console.log(`FULL DATABASE_URL (Sanitized): postgresql://***:***@${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`);

  // Query primary connected DB
  const db = new PrismaClient();

  // 2. Counts for all models/tables
  console.log('\n--- 2. ALL TABLE COUNTS IN CURRENT POSTGRESQL ---');
  const [
    supplierCount,
    locationCount,
    supplierCapabilityCount,
    contactCount,
    claimCount,
    docCount,
    crawlCount,
    buyerOrgCount,
    buyerMembershipCount,
    userCount
  ] = await Promise.all([
    db.supplierCompany.count(),
    db.supplierLocation.count(),
    db.supplierCapability.count(),
    db.contact.count(),
    db.extractedClaim.count(),
    db.sourceDocument.count(),
    db.crawlRun.count(),
    db.buyerOrganization.count(),
    db.buyerMembership.count(),
    db.user.count(),
  ]);

  console.log(`SupplierCompany: ${supplierCount}`);
  console.log(`SupplierLocation: ${locationCount}`);
  console.log(`SupplierCapability: ${supplierCapabilityCount}`);
  console.log(`Contact: ${contactCount}`);
  console.log(`ExtractedClaim: ${claimCount}`);
  console.log(`SourceDocument: ${docCount}`);
  console.log(`CrawlRun: ${crawlCount}`);
  console.log(`BuyerOrganization: ${buyerOrgCount}`);
  console.log(`BuyerMembership: ${buyerMembershipCount}`);
  console.log(`User: ${userCount}`);

  // Group SupplierCompany by profileStatus
  const byProfileStatus = await db.supplierCompany.groupBy({
    by: ['profileStatus'],
    _count: { id: true },
  });
  console.log('\n--- SUPPLIER COMPANY BREAKDOWN BY profileStatus ---');
  byProfileStatus.forEach(g => {
    console.log(`  profileStatus: ${g.profileStatus} -> Count: ${g._count.id}`);
  });

  // Group SupplierCompany by verificationStatus
  const byVerificationStatus = await db.supplierCompany.groupBy({
    by: ['verificationStatus'],
    _count: { id: true },
  });
  console.log('\n--- SUPPLIER COMPANY BREAKDOWN BY verificationStatus ---');
  byVerificationStatus.forEach(g => {
    console.log(`  verificationStatus: ${g.verificationStatus} -> Count: ${g._count.id}`);
  });

  // Group SupplierCompany by claimStatus
  const byClaimStatus = await db.supplierCompany.groupBy({
    by: ['claimStatus'],
    _count: { id: true },
  });
  console.log('\n--- SUPPLIER COMPANY BREAKDOWN BY claimStatus ---');
  byClaimStatus.forEach(g => {
    console.log(`  claimStatus: ${g.claimStatus} -> Count: ${g._count.id}`);
  });

  // 3. Search for Batch 1 and Batch 2 sample suppliers
  console.log('\n--- 3. SAMPLE BATCH 1 & BATCH 2 SUPPLIER SEARCH ---');
  const sampleNames = [
    'Strescon Limited',
    'Eastern Designers & Company Ltd',
    'Lantech Drilling Services',
    'Brennan Contractors & Engineers Ltd',
    'Atlantic Subsea Inc',
    'Atlantic Towing Limited',
    'Ocean Steel',
    'Apex Industries',
    'Sunny Corner Enterprises',
    'Source Atlantic',
  ];

  for (const name of sampleNames) {
    const found = await db.supplierCompany.findFirst({
      where: { canonicalName: { contains: name, mode: 'insensitive' } },
      include: {
        locations: true,
        capabilities: true,
        contacts: true,
        extractedClaims: true,
      },
    });

    if (found) {
      console.log(`[FOUND] ${found.canonicalName}`);
      console.log(`        ID: ${found.id} | Slug: ${found.slug}`);
      console.log(`        profileStatus: ${found.profileStatus} | verificationStatus: ${found.verificationStatus} | claimStatus: ${found.claimStatus}`);
      console.log(`        Locations: ${found.locations.length} | Capabilities: ${found.capabilities.length} | Contacts: ${found.contacts.length} | ExtractedClaims: ${found.extractedClaims.length}`);
      console.log(`        Eligible for /suppliers? ${found.profileStatus === 'PUBLISHED' ? 'YES' : 'NO (profileStatus is ' + found.profileStatus + ')'}`);
    } else {
      console.log(`[NOT FOUND] ${name}`);
    }
  }

  // Count total non-smoke-test suppliers
  const nonSmokeCount = await db.supplierCompany.count({
    where: {
      NOT: {
        slug: { in: ['atlantic-steel-smoke-test', 'maritime-piping-smoke-test'] }
      }
    }
  });
  console.log(`\nTotal Non-Smoke-Test Suppliers in DB: ${nonSmokeCount}`);

  // List all suppliers currently in DB
  const allSuppliers = await db.supplierCompany.findMany({
    select: { id: true, canonicalName: true, slug: true, profileStatus: true, createdAt: true, contacts: true }
  });
  console.log('\n--- ALL SUPPLIERS & CONTACTS IN DB ---');
  allSuppliers.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.canonicalName} (${s.slug}) | Status: ${s.profileStatus} | Created: ${s.createdAt.toISOString()}`);
    s.contacts.forEach(c => console.log(`     -> Contact: ${c.name} | Email: ${c.publicBusinessEmail}`));
  });

  await db.$disconnect();
}

forensicAudit().catch(console.error);
