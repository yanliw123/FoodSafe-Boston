import "dotenv/config";
import fs from "node:fs";
import { parse } from "csv-parse";
import { connectDB, closeDB } from "../db/connection.js";

const CSV_PATH = process.argv[2] || "data/inspections.csv";
const YEAR = process.argv[3] || "2026";
const BATCH_SIZE = 1000;

// The city uses codes like "HE_Pass" and "HE_FailExt"
function normalizeResult(raw) {
  const result = (raw || "").replace(/^HE_/, "");
  if (/^pass/i.test(result)) return "Pass";
  if (/^fail/i.test(result)) return "Fail";
  return result || "Unknown";
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readInspections() {
  const inspections = new Map();
  const parser = fs
    .createReadStream(CSV_PATH)
    .pipe(parse({ columns: true, skip_empty_lines: true, bom: true }));

  let rows = 0;
  for await (const row of parser) {
    if (!row.resultdttm?.startsWith(YEAR)) continue;
    rows++;

    // One CSV row per violation: group them into one inspection
    const key = `${row.licenseno}|${row.resultdttm}`;
    if (!inspections.has(key)) {
      inspections.set(key, {
        restaurantName: row.businessname?.trim(),
        licenseNo: row.licenseno,
        address: row.address?.replace(/\s+/g, " ").trim(),
        city: row.city?.replace(/\/$/, "").trim(),
        zip: row.zip?.trim().padStart(5, "0"),
        result: normalizeResult(row.result),
        date: toDate(row.resultdttm),
        violations: [],
        source: "city",
      });
    }

    if (row.violation) {
      inspections.get(key).violations.push({
        code: row.violation,
        level: (row.viol_level || "").length,
        description: row.violdesc,
        status: row.viol_status,
        comments: row.comments,
      });
    }
  }

  console.log(`Read ${rows} rows from ${YEAR}`);
  return [...inspections.values()];
}

async function main() {
  const inspections = await readInspections();
  console.log(`Grouped into ${inspections.length} inspections`);

  const db = await connectDB();
  const collection = db.collection("inspections");

  // Re-running the import replaces the previously imported data
  const { deletedCount } = await collection.deleteMany({ source: "city" });
  console.log(`Removed ${deletedCount} old imported inspections`);

  for (let i = 0; i < inspections.length; i += BATCH_SIZE) {
    await collection.insertMany(inspections.slice(i, i + BATCH_SIZE));
  }

  await collection.createIndex({ restaurantName: 1 });
  await collection.createIndex({ licenseNo: 1, date: -1 });
  await collection.createIndex({ zip: 1 });
  await collection.createIndex({ date: -1 });

  console.log(`Imported ${inspections.length} inspections`);
  await closeDB();
}

main().catch(async (err) => {
  console.error(err);
  await closeDB();
  process.exit(1);
});
