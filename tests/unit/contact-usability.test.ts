import { describe, it, expect } from 'vitest';
import { isUsableRfqEmail, isUsableRfqPhone } from '../../src/lib/contacts/usability';

describe('RFQ Contact Usability Classifier', () => {
  it('excludes HR and recruiting emails', () => {
    expect(isUsableRfqEmail('hr@company.com').usable).toBe(false);
    expect(isUsableRfqEmail('careers@company.com').usable).toBe(false);
    expect(isUsableRfqEmail('ukiexternalpeopleservices@aecom.com').usable).toBe(false);
    expect(isUsableRfqEmail('hr.middleeast@aecom.com').usable).toBe(false);
  });

  it('excludes payroll emails', () => {
    expect(isUsableRfqEmail('aecom_payroll@aecom.com').usable).toBe(false);
    expect(isUsableRfqEmail('payroll@company.com').usable).toBe(false);
  });

  it('excludes retirement and benefits emails', () => {
    expect(isUsableRfqEmail('retirementplans@aecom.com').usable).toBe(false);
    expect(isUsableRfqEmail('pension@company.com').usable).toBe(false);
    expect(isUsableRfqEmail('benefits@company.com').usable).toBe(false);
  });

  it('excludes third-party support email mismatches', () => {
    const res = isUsableRfqEmail('support@gssdubai.com', 'aecom.com');
    expect(res.usable).toBe(false);
    expect(res.reason).toContain('Third-party email domain mismatch');

    const resQuebec = isUsableRfqEmail('sales@quebechose.com', 'maritimehose.com');
    expect(resQuebec.usable).toBe(false);
    expect(resQuebec.reason).toContain('Third-party email domain mismatch');

    const resOntario = isUsableRfqEmail('webstore@ontariohose.com', 'maritimehose.com');
    expect(resOntario.usable).toBe(false);
    expect(resOntario.reason).toContain('Third-party email domain mismatch');
  });

  it('allows valid sales, estimating, and procurement emails', () => {
    expect(isUsableRfqEmail('sales@atlanticcontrols.ca', 'atlanticcontrols.ca').usable).toBe(true);
    expect(isUsableRfqEmail('info@atlanticmachining.ca', 'atlanticmachining.ca').usable).toBe(true);
    expect(isUsableRfqEmail('estimating@company.com', 'company.com').usable).toBe(true);
    expect(isUsableRfqEmail('procurement@company.com', 'company.com').usable).toBe(true);
  });

  it('validates main company phone numbers', () => {
    expect(isUsableRfqPhone('(800) 728-9230').usable).toBe(true);
    expect(isUsableRfqPhone('506-555-0100').usable).toBe(true);
    expect(isUsableRfqPhone('12345').usable).toBe(false);
    expect(isUsableRfqPhone('0000000000').usable).toBe(false);
  });
});
