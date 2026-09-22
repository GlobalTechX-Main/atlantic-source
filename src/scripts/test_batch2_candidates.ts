import { safeFetch } from '../lib/crawler/fetcher';

const CANDIDATES = [
  { companyName: "Armtec Drainage & Infrastructure", websiteUrl: "https://www.armtec.com", seedCity: "Moncton", seedProvince: "NB", domain: "armtec.com" },
  { companyName: "Stantec Industrial Engineering", websiteUrl: "https://www.stantec.com", seedCity: "Fredericton", seedProvince: "NB", domain: "stantec.com" },
  { companyName: "AECOM Industrial Engineering", websiteUrl: "https://www.aecom.com", seedCity: "Fredericton", seedProvince: "NB", domain: "aecom.com" },
  { companyName: "Englobe Corp Engineering", websiteUrl: "https://www.englobecorp.com", seedCity: "Saint John", seedProvince: "NB", domain: "englobecorp.com" },
  { companyName: "Dillon Consulting Ltd", websiteUrl: "https://www.dillon.ca", seedCity: "Fredericton", seedProvince: "NB", domain: "dillon.ca" },
  { companyName: "CBRE Industrial Logistics", websiteUrl: "https://www.cbre.ca", seedCity: "Moncton", seedProvince: "NB", domain: "cbre.ca" },
];

async function testBatch2Candidates() {
  console.log("Testing live response for candidate domains...\n");
  const verified = [];

  for (const cand of CANDIDATES) {
    try {
      const res = await safeFetch(cand.websiteUrl);
      if (res.statusCode >= 200 && res.statusCode < 400 && res.content && res.content.length > 500) {
        console.log(`[OK] ${cand.companyName} (${cand.domain}): HTTP ${res.statusCode}, len: ${res.content.length}`);
        verified.push(cand);
      } else {
        console.log(`[FAIL] ${cand.companyName} (${cand.domain}): HTTP ${res.statusCode}`);
      }
    } catch (err: unknown) {
      console.log(`[ERR] ${cand.companyName} (${cand.domain}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nVerified Live Candidates Count: ${verified.length}`);
  console.log(JSON.stringify(verified, null, 2));
}

testBatch2Candidates().catch(console.error);
