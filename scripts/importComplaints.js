import "dotenv/config";
import { connectDB, closeDB } from "../db/connection.js";
import { createComplaintIndexes, toAddressKey } from "../db/complaints.js";

// Analyze Boston keeps one 311 file per year. Its datastore API returns only
// the food safety complaints, so there is no large CSV to download.
const API_URL = "https://data.boston.gov/api/3/action/datastore_search";
const RESOURCES = {
  2024: "dff4d804-5031-443a-8409-8344efd0e5c8",
  2025: "9d7c2214-4709-478a-a2e8-fb2020a5bb94",
  2026: "1a0b420d-99f1-4887-9851-990b2a5a6e17",
};
const PAGE_SIZE = 1000;

// The city's public inspection data, used to name the businesses at each
// complaint's location. This reads the API, not our inspections collection.
const SQL_URL = "https://data.boston.gov/api/3/action/datastore_search_sql";
const INSPECTIONS_RESOURCE = "4582bec6-2b4f-4f9e-bc55-cbaa73117f4c";
const NEARBY_METERS = 5;

// The city's case types, grouped into the four types the app shows
const CITY_TYPES = {
  "Unsanitary Conditions - Establishment": "Unsanitary establishment",
  "Unsanitary Conditions - Food": "Unsanitary food",
  "Unsanitary Conditions - Employees": "Employee hygiene",
  "Food Alert - Confirmed": "Food alert",
  "Food Alert - Unconfirmed": "Food alert",
};

const FIELDS = [
  "case_enquiry_id",
  "open_dt",
  "closed_dt",
  "case_status",
  "closure_reason",
  "type",
  "location_street_name",
  "location_zipcode",
  "neighborhood",
  "latitude",
  "longitude",
];

function cleanText(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The city writes "Case Closed. Closed date : Fri Jan 02 14:35:19 EST 2026
// Resolved Conducted full sanitary inspection". Keep the outcome and the note.
function parseClosure(raw) {
  const text = cleanText(raw).replace(
    /^Case Closed\. Closed date : .*? \d{4}\s*/i,
    "",
  );
  const match = text.match(
    /^(?:Case )?(Resolved|Noted|Invalid|Duplicate)\b\s*/i,
  );
  if (!match) return { outcome: "", response: text };
  return {
    outcome: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(),
    response: text.slice(match[0].length),
  };
}

async function fetchYear(year) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      resource_id: RESOURCES[year],
      filters: JSON.stringify({ type: Object.keys(CITY_TYPES) }),
      fields: FIELDS.join(","),
      sort: "_id",
      limit: PAGE_SIZE,
      offset,
    });
    const res = await fetch(`${API_URL}?${params}`);
    if (!res.ok) throw new Error(`Analyze Boston returned ${res.status}`);

    const { result } = await res.json();
    rows.push(...result.records);
    if (result.records.length < PAGE_SIZE) return rows;
  }
}

// Food businesses inspected since 2024, each with its latest name
async function fetchBusinesses() {
  const sql = `SELECT licenseno, businessname, location, max(resultdttm) AS last
    FROM "${INSPECTIONS_RESOURCE}"
    WHERE resultdttm >= '2024-01-01' AND location LIKE '(%'
    GROUP BY licenseno, businessname, location`;
  const res = await fetch(`${SQL_URL}?${new URLSearchParams({ sql })}`);
  if (!res.ok) throw new Error(`Analyze Boston returned ${res.status}`);
  const { result } = await res.json();

  const latest = new Map();
  for (const row of result.records) {
    const seen = latest.get(row.licenseno);
    if (!seen || row.last > seen.last) latest.set(row.licenseno, row);
  }

  // location looks like "(42.35925954972639, -71.05890048027378)"
  return [...latest.values()]
    .map((row) => {
      const [lat, lng] = row.location.slice(1, -1).split(",").map(Number);
      return { name: cleanText(row.businessname), lat, lng };
    })
    .filter((business) => business.name && business.lat && business.lng);
}

function distanceMeters(a, b) {
  const toRad = Math.PI / 180;
  const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  const y = (b.lat - a.lat) * toRad;
  return Math.hypot(x, y) * 6371000;
}

// Boston 311 does not record the business name. The city places both datasets
// with the same address system, so the businesses within a few meters of a
// complaint are the ones at that address.
function findNearby(businesses, point) {
  const names = new Map();
  for (const business of businesses) {
    if (distanceMeters(business, point) > NEARBY_METERS) continue;
    // The same name in different capitals counts once, keeping "Subway"
    // over "SUBWAY"
    const key = business.name.toLowerCase();
    const seen = names.get(key);
    if (!seen || seen === seen.toUpperCase()) names.set(key, business.name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function toComplaint(row, businesses) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!lat || !lng) return null;

  const address = cleanText(row.location_street_name);
  return {
    caseId: String(row.case_enquiry_id),
    type: CITY_TYPES[row.type],
    cityType: row.type,
    status: row.case_status === "Open" ? "Open" : "Closed",
    openedAt: toDate(row.open_dt),
    closedAt: toDate(row.closed_dt),
    ...parseClosure(row.closure_reason),
    restaurantName: "",
    nearbyBusinesses: findNearby(businesses, { lat, lng }),
    description: "",
    address,
    addressKey: toAddressKey(address),
    zip: row.location_zipcode
      ? String(row.location_zipcode).padStart(5, "0")
      : "",
    neighborhood: cleanText(row.neighborhood),
    location: { type: "Point", coordinates: [lng, lat] },
    source: "311",
  };
}

async function main() {
  const businesses = await fetchBusinesses();
  console.log(`Found ${businesses.length} inspected food businesses`);

  const complaints = [];
  for (const year of Object.keys(RESOURCES)) {
    const rows = await fetchYear(year);
    const valid = rows
      .map((row) => toComplaint(row, businesses))
      .filter(Boolean);
    console.log(
      `${year}: ${rows.length} rows, ${valid.length} with a location`,
    );
    complaints.push(...valid);
  }
  const named = complaints.filter((c) => c.nearbyBusinesses.length > 0);
  console.log(`${named.length} complaints matched to a business nearby`);

  const db = await connectDB();
  const collection = db.collection("complaints");

  // Re-running the import replaces the 311 data and keeps complaints filed
  // in the app
  const { deletedCount } = await collection.deleteMany({ source: "311" });
  console.log(`Removed ${deletedCount} old 311 complaints`);

  await collection.insertMany(complaints);
  await createComplaintIndexes(db);

  console.log(`Imported ${complaints.length} complaints`);
  await closeDB();
}

main().catch(async (err) => {
  console.error(err);
  await closeDB();
  process.exit(1);
});
