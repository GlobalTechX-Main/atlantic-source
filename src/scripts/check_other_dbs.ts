import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function checkPort5432() {
  console.log('=== AUDITING PORT 5432 AND OTHER DATABASES ===\n');

  const urls = [
    { label: 'Port 5432 (atlanticsource_db)', url: 'postgresql://atlanticsource:atlanticsource_secret@127.0.0.1:5432/atlanticsource_db?schema=public' },
    { label: 'Port 5432 (atlanticsource_test_db)', url: 'postgresql://atlanticsource:atlanticsource_secret@127.0.0.1:5432/atlanticsource_test_db?schema=public' },
    { label: 'Port 5432 (postgres default db)', url: 'postgresql://atlanticsource:atlanticsource_secret@127.0.0.1:5432/postgres?schema=public' },
    { label: 'Port 5433 (atlanticsource_test_db)', url: 'postgresql://atlanticsource:atlanticsource_secret@127.0.0.1:5433/atlanticsource_test_db?schema=public' },
    { label: 'Port 5433 (postgres default db)', url: 'postgresql://atlanticsource:atlanticsource_secret@127.0.0.1:5433/postgres?schema=public' },
  ];

  for (const target of urls) {
    console.log(`Checking ${target.label}...`);
    try {
      const db = new PrismaClient({ datasources: { db: { url: target.url } } });
      const count = await db.supplierCompany.count();
      console.log(`  -> SupplierCompany Count: ${count}`);
      if (count > 0) {
        const suppliers = await db.supplierCompany.findMany({ take: 5, select: { canonicalName: true, profileStatus: true, slug: true } });
        suppliers.forEach(s => console.log(`     * ${s.canonicalName} (${s.slug}) [${s.profileStatus}]`));
      }
      await db.$disconnect();
    } catch (e: unknown) {
      console.log(`  -> Connection/Query Error: ${(e as Error).message}`);
    }
  }
}

checkPort5432().catch(console.error);
