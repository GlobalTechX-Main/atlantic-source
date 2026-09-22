import 'dotenv/config';
import * as fs from 'fs';
import * as dns from 'dns/promises';
import { db } from '../lib/db';
import { safeFetch } from '../lib/crawler/fetcher';
import { BATCH_2_SUPPLIERS } from './run_batch2_production';

interface FailureReport {
  company: string;
  domain: string;
  seedUrl: string;
  dbStatus: string;
  dbErrorSummary: string;
  dnsResult: string;
  safeFetch: {
    statusCode?: number;
    error?: string;
    finalUrl?: string;
    bytes: number;
  };
  directFetch: {
    status?: number;
    statusText?: string;
    finalUrl?: string;
    bytes?: number;
    error?: string;
  };
  altUrl: string;
  altFetch: {
    status?: number;
    statusText?: string;
    finalUrl?: string;
    bytes?: number;
    error?: string;
  };
}

async function main() {
  const b2Domains = BATCH_2_SUPPLIERS.map((s) => s.domain);
  const dbSuppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: b2Domains } },
    include: { crawlRuns: true, sourceDocuments: true },
  });

  const failureReports: FailureReport[] = [];

  for (const cand of BATCH_2_SUPPLIERS) {
    const supp = dbSuppliers.find((s) => s.normalizedDomain === cand.domain);
    const lastRun = supp?.crawlRuns[supp.crawlRuns.length - 1];
    const pagesFetched = lastRun?.pagesFetched || 0;

    if (pagesFetched >= 1) continue;

    console.log(`Analyzing failure for ${cand.companyName} (${cand.domain})...`);

    let dnsResult = '';
    try {
      const ips = await dns.resolve4(cand.domain);
      dnsResult = `IPv4: ${ips.join(', ')}`;
    } catch (e) {
      try {
        const ips = await dns.resolve6(cand.domain);
        dnsResult = `IPv6: ${ips.join(', ')}`;
      } catch {
        const err = e as Error;
        dnsResult = `FAILED: ${err.message}`;
      }
    }

    let safeRes: { statusCode?: number; error?: string; url?: string; content?: string } | null = null;
    try {
      safeRes = await safeFetch(cand.websiteUrl);
    } catch (e) {
      const err = e as Error;
      safeRes = { error: err.message };
    }

    let directRes: { status?: number; statusText?: string; finalUrl?: string; bytes?: number; error?: string } = {};
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(cand.websiteUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const text = await res.text();
      directRes = { status: res.status, statusText: res.statusText, finalUrl: res.url, bytes: text.length };
    } catch (e) {
      const err = e as Error;
      directRes = { error: err.message };
    }

    const altUrl = cand.websiteUrl.includes('www.')
      ? cand.websiteUrl.replace('www.', '')
      : cand.websiteUrl.replace('https://', 'https://www.').replace('http://', 'http://www.');

    let altRes: { status?: number; statusText?: string; finalUrl?: string; bytes?: number; error?: string } = {};
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(altUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const text = await res.text();
      altRes = { status: res.status, statusText: res.statusText, finalUrl: res.url, bytes: text.length };
    } catch (e) {
      const err = e as Error;
      altRes = { error: err.message };
    }

    failureReports.push({
      company: cand.companyName,
      domain: cand.domain,
      seedUrl: cand.websiteUrl,
      dbStatus: lastRun?.status || 'N/A',
      dbErrorSummary: lastRun?.errorSummary || 'None',
      dnsResult,
      safeFetch: {
        statusCode: safeRes?.statusCode,
        error: safeRes?.error,
        finalUrl: safeRes?.url,
        bytes: safeRes?.content?.length || 0,
      },
      directFetch: directRes,
      altUrl,
      altFetch: altRes,
    });
  }

  fs.writeFileSync('batch2_crawl_failures.json', JSON.stringify(failureReports, null, 2));
  console.log(`Successfully analyzed ${failureReports.length} failed crawl suppliers.`);
  await db.$disconnect();
}

main().catch(console.error);
