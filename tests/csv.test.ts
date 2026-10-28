import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRecords } from '../lib/csv';

describe('CSV parsing', () => {
  it('parses quoted commas and escaped quotes', () => {
    const rows = parseCsv('name,reason\n"Rao, S.","Needs ""special"" leave"\n');
    expect(rows).toEqual([
      ['name', 'reason'],
      ['Rao, S.', 'Needs "special" leave'],
    ]);
  });

  it('handles CRLF, a BOM, and lowercase headers', () => {
    const records = parseCsvRecords('\uFEFFRole,Name\r\nstudent,Rahul Reddy\r\n');
    expect(records).toEqual([{ role: 'student', name: 'Rahul Reddy' }]);
  });

  it('drops fully blank rows and fills missing trailing columns', () => {
    const records = parseCsvRecords('role,name,designation\nstudent,Rahul\n\nfaculty,Rao,HOD\n');
    expect(records).toHaveLength(2);
    expect(records[0].designation).toBe('');
    expect(records[1].designation).toBe('HOD');
  });
});
