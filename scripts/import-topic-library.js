// Import topic library from 800claude.xlsx into Supabase
// Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/import-topic-library.js
//
// Duplicate rule: only skip if title AND description are exactly
// the same (after trimming whitespace). Different descriptions
// with the same title are separate entries.

const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const FILE = path.resolve("C:/Users/karla/OneDrive/Desktop/LLG Local/Data/800claude.xlsx");
const SHEET = "800";

function sentenceCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function clean(str) {
  if (!str) return "";
  return String(str).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Read spreadsheet
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

  console.log(`Read ${rows.length} rows from sheet "${SHEET}"`);

  // Deduplicate: same title AND same description = duplicate
  const seen = new Map();
  const toImport = [];
  let dupeCount = 0;
  let emptyCount = 0;

  rows.forEach((row, i) => {
    const rawTitle = clean(row[0]);
    if (!rawTitle) { emptyCount++; return; }
    const desc = clean(row[1]) || null;
    const key = rawTitle.toLowerCase() + "|||" + (desc || "").toLowerCase();

    if (seen.has(key)) {
      dupeCount++;
    } else {
      seen.set(key, true);
      toImport.push({
        title: sentenceCase(rawTitle),
        description: desc,
      });
    }
  });

  console.log(`\nUnique entries: ${toImport.length}`);
  console.log(`True duplicates (same title + description): ${dupeCount}`);
  console.log(`Empty rows skipped: ${emptyCount}`);

  // Insert in batches of 50
  let imported = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < toImport.length; i += batchSize) {
    const batch = toImport.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("topic_library")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      imported += data.length;
    }
  }

  console.log(`\n--- RESULT ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Errors: ${errors}`);
  console.log(`True duplicates skipped: ${dupeCount}`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
