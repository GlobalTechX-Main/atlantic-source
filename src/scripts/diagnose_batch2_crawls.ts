import 'dotenv/config';
import * as dns from 'dns/promises';
import { db } from '../lib/db';
import { safeFetch } from '../lib/crawler/fetcher';
import { BATCH_2_SUPPLIERS } from './run_batch2_production';

async function diagnoseDomain(domain: string, seedUrl: string) {
  let dnsResult = '';
  try {
    const ips = await dns.resolve4(domain);
    dnsResult = `SUCCESS: ${ips.join(', ')}`;
  } catch (e: unknown) {
    try {
      const ips = await dns.resolve6(domain);
      dnsResult = `IPv6 SUCCESS: ${ips.join(', ')}`;
    } catch {
      dnsResult = `FAILED: ${e instanceof Error ? e.message : 'Unknown DNS error'}`;
    }
  }

  // SafeFetch (our crawler fetcher with SSRF guards)
  let safeFetchResult = '';
  try {
    const res = await safeFetch(seedUrl);
    safeFetchResult = `Status: ${res.statusCode}, Bytes: ${res.content?.length || 0}, FinalUrl: ${res.url}`;
  } catch (e: unknown) {
    safeFetchResult = `EXCEPTION: ${e instanceof Error ? e.message : 'SafeFetch exception'}`;
  }

  // Direct fetch with User-Agent header (for comparison)
  let directFetchResult = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(seedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AtlanticSourceBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    directFetchResult = `Status: ${res.status} ${res.statusText}, FinalUrl: ${res.url}`;
  } catch (e: unknown) {
    directFetchResult = `FAILED: ${e instanceof Error ? e.message : 'Fetch failed'}`;
  }

  // Check www vs non-www
  const altUrl = seedUrl.includes('www.') ? seedUrl.replace('www.', '') : seedUrl.replace('https://', 'https://www.');
  let altFetchResult = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(altUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AtlanticSourceBot/1.0',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    altFetchResult = `Status: ${res.status} ${res.statusText}, FinalUrl: ${res.url}`;
  } catch (e: unknown) {
    altFetchResult = `FAILED: ${e instanceof Error ? e.message : 'Alt fetch failed'}`;
  }

  return {
    domain,
    seedUrl,
    dnsResult,
    safeFetchResult,
    directFetchResult,
    altUrl,
    altFetchResult,
  };
}

async function main() {
  console.log('=== DIAGNOSING BATCH 2 SUPPLIER CRAWL FAILURES ===\n');

  const b2Domains = BATCH_2_SUPPLIERS.map(s => s.domain);
  const dbSuppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: b2Domains } },
    include: { crawlRuns: true },
  });

  for (let i = 0; i < BATCH_2_SUPPLIERS.length; i++) {
    const cand = BATCH_2_SUPPLIERS[i];
    if (!cand) continue;
    const supp = dbSuppliers.find(s => s.normalizedDomain === cand.domain);
    const lastRun = supp?.crawlRuns[supp.crawlRuns.length - 1];

    console.log(`[${i + 1}/25] ${cand.companyName} (${cand.domain})`);
    console.log(`  Seed URL: ${cand.websiteUrl}`);
    console.log(`  Crawl DB Pages Fetched: ${lastRun?.pagesFetched || 0} | Status: ${lastRun?.status || 'N/A'}`);
    console.log(`  Crawl Error Summary: ${lastRun?.errorSummary || 'None'}`);

    const diag = await diagnoseDomain(cand.domain, cand.websiteUrl);
    console.log(`  DNS Resolution: ${diag.dnsResult}`);
    console.log(`  SafeFetch (Crawler): ${diag.safeFetchResult}`);
    console.log(`  Direct Browser Fetch: ${diag.directFetchResult}`);
    console.log(`  Alt URL (${diag.altUrl}): ${diag.altFetchResult}`);
    console.log('---------------------------------------------------\n');
  }

  await db.$disconnect();
}

main().catch(console.error);
