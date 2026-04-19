import xlsx from 'xlsx';
const { readFile, utils } = xlsx;

const files = [
  'C:/Users/abdu8/Downloads/18 أبريل 2026.xlsx',
  'C:/Users/abdu8/Downloads/18 أبريل 2026 (1).xlsx',
];

for (const file of files) {
  console.log('\n══════ FILE:', file.split('/').pop(), '══════');
  const wb = readFile(file);
  for (const sheetName of wb.SheetNames) {
    const rows = utils.sheet_to_json(wb.Sheets[sheetName], { header:1 });
    console.log(`  Sheet: "${sheetName}" — ${rows.length} rows`);
    rows.slice(0, 6).forEach((r, i) => console.log(`    [${i}]`, JSON.stringify(r)));
  }
}
