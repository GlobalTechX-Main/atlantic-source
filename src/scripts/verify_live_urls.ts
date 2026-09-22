import { safeFetch } from '../lib/crawler/fetcher';

interface Candidate {
  name: string;
  url: string;
  seedCity: string;
  seedProvince: string;
}

const EXTRA: Candidate[] = [
  { name: "NB Power / Industrial Energy", url: "https://www.nbpower.com", seedCity: "Fredericton", seedProvince: "NB" },
  { name: "Irving Oil Industrial", url: "https://www.irvingoil.com", seedCity: "Saint John", seedProvince: "NB" },
  { name: "McCain Foods Industrial", url: "https://www.mccain.com", seedCity: "Florenceville-Bristol", seedProvince: "NB" },
];

async function verifyAll() {
  for (const c of EXTRA) {
    try {
      const res = await safeFetch(c.url, { timeoutMs: 5000 });
      console.log(`[STATUS] ${c.name} -> ${c.url} (Status: ${res.statusCode}, Len: ${res.content.length})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[ERR] ${c.name} -> ${msg}`);
    }
  }
}

if (require.main === module) {
  verifyAll().catch(console.error);
}
