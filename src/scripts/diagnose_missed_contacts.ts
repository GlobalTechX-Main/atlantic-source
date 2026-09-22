import 'dotenv/config';
import * as cheerio from 'cheerio';
import { safeFetch } from '../lib/crawler/fetcher';

const MISSED_SUPPLIERS = [
  { name: 'Ocean Steel', url: 'https://oceansteel.com', domain: 'oceansteel.com' },
  { name: 'Apex Industries', url: 'https://www.apexindustries.com', domain: 'apexindustries.com' },
  { name: 'Acadian Construction', url: 'https://acadianconstruction.com', domain: 'acadianconstruction.com' },
  { name: 'Imperial Manufacturing Group', url: 'https://www.imperialgroup.ca', domain: 'imperialgroup.ca' },
  { name: 'Black & McDonald', url: 'https://www.blackandmcdonald.com', domain: 'blackandmcdonald.com' },
  { name: 'Guillevin', url: 'https://www.guillevin.com', domain: 'guillevin.com' },
  { name: 'Brandt', url: 'https://www.brandt.ca', domain: 'brandt.ca' },
  { name: 'Teklor Controls', url: 'https://teklorcontrols.com', domain: 'teklorcontrols.com' },
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g;

async function diagnose() {
  console.log('=== DIAGNOSING MISSED SUPPLIER CONTACTS ===\n');

  for (const s of MISSED_SUPPLIERS) {
    console.log(`\n==================================================`);
    console.log(`SUPPLIER: ${s.name} (${s.domain})`);
    try {
      const res = await safeFetch(s.url, { maxRedirects: 6 });
      console.log(`Fetch Status: ${res.statusCode}, Content Size: ${res.content.length} bytes`);

      const $ = cheerio.load(res.content);

      // 1. Tel links
      const telLinks: string[] = [];
      $('a[href*="tel:"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        const html = $(el).html();
        if (href) telLinks.push(`href="${href}" | text="${text}" | hasSvg=${html?.includes('<svg')}`);
      });
      console.log(`Tel Links (${telLinks.length}):`, telLinks.slice(0, 5));

      // 2. Mailto links
      const mailtoLinks: string[] = [];
      $('a[href*="mailto:"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href) mailtoLinks.push(`href="${href}" | text="${text}"`);
      });
      console.log(`Mailto Links (${mailtoLinks.length}):`, mailtoLinks.slice(0, 5));

      // 3. Header/Nav/Footer text phone/email
      const headerText = $('header, nav, .header, .topbar, #header, #nav, .top-bar').text();
      const footerText = $('footer, .footer, #footer').text();

      const headerEmails = headerText.match(EMAIL_REGEX) || [];
      const headerPhones = headerText.match(PHONE_REGEX) || [];
      const footerEmails = footerText.match(EMAIL_REGEX) || [];
      const footerPhones = footerText.match(PHONE_REGEX) || [];

      console.log(`Header Contacts -> Emails: ${headerEmails.join(', ')} | Phones: ${headerPhones.join(', ')}`);
      console.log(`Footer Contacts -> Emails: ${footerEmails.join(', ')} | Phones: ${footerPhones.join(', ')}`);

      // 4. JSON-LD scripts
      const jsonLdPhones: string[] = [];
      const jsonLdEmails: string[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).html() || '';
        const phones = raw.match(/"telephone"\s*:\s*"([^"]+)"/g) || [];
        const emails = raw.match(/"email"\s*:\s*"([^"]+)"/g) || [];
        jsonLdPhones.push(...phones);
        jsonLdEmails.push(...emails);
      });
      console.log(`JSON-LD Contacts -> Phones: ${jsonLdPhones.join(', ')} | Emails: ${jsonLdEmails.join(', ')}`);

      // 5. Entire raw HTML regex search
      const rawEmails = res.content.match(EMAIL_REGEX) || [];
      const rawPhones = res.content.match(PHONE_REGEX) || [];
      console.log(`Entire HTML Raw Matches -> Emails (${rawEmails.length}): ${Array.from(new Set(rawEmails)).slice(0, 5).join(', ')}`);
      console.log(`Entire HTML Raw Matches -> Phones (${rawPhones.length}): ${Array.from(new Set(rawPhones)).slice(0, 5).join(', ')}`);

    } catch (err: unknown) {
      console.log(`Fetch Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

diagnose().catch(console.error);
