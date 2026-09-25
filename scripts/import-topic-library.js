// Import topic library from 800claude.xlsx into Supabase
// Run: node scripts/import-topic-library.js
//
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
// Or pass them inline: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/import-topic-library.js

const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const FILE = path.resolve("C:/Users/karla/OneDrive/Desktop/LLG Local/Data/800claude.xlsx");
const SHEET = "800";

function sentenceCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cleanDescription(desc) {
  if (!desc) return null;
  return String(desc).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() || null;
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
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header

  console.log(`Read ${rows.length} rows from sheet "${SHEET}"`);

  // Group by lowercase title
  const byTitle = new Map();
  rows.forEach((row, i) => {
    const rawTitle = String(row[0] || "").trim();
    const desc = cleanDescription(row[1]);
    if (!rawTitle) return;

    const key = rawTitle.toLowerCase();
    if (!byTitle.has(key)) {
      byTitle.set(key, []);
    }
    byTitle.get(key).push({ rawTitle, desc, rowNum: i + 2 });
  });

  // Separate unique vs duplicates
  const toImport = [];
  const duplicates = [];

  for (const [key, entries] of byTitle) {
    // Pick the entry with the longest description
    const best = entries.reduce((a, b) =>
      (a.desc || "").length >= (b.desc || "").length ? a : b
    );

    toImport.push({
      title: sentenceCase(best.rawTitle),
      description: best.desc,
    });

    if (entries.length > 1) {
      duplicates.push({
        title: sentenceCase(entries[0].rawTitle),
        count: entries.length,
        rows: entries.map(e => e.rowNum),
        descLengths: entries.map(e => (e.desc || "").length),
      });
    }
  }

  console.log(`\nUnique titles: ${toImport.length}`);
  console.log(`Duplicate titles: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log(`\n--- DUPLICATES (kept longest description) ---`);
    duplicates.forEach(d => {
      console.log(`  "${d.title}" x${d.count} (rows: ${d.rows.join(", ")}, desc lengths: ${d.descLengths.join(", ")})`);
    });
  }

  // Insert in batches of 50
  let imported = 0;
  let skipped = 0;
  const batchSize = 50;

  for (let i = 0; i < toImport.length; i += batchSize) {
    const batch = toImport.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("topic_library")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
      skipped += batch.length;
    } else {
      imported += data.length;
    }
  }

  console.log(`\n--- RESULT ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Duplicates in source: ${duplicates.length} titles (${duplicates.reduce((s, d) => s + d.count - 1, 0)} extra rows)`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
