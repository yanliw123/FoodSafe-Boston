// Shared by the complaints import script and the complaints routes

// The four complaint types the app shows
export const COMPLAINT_TYPES = [
  "Unsanitary establishment",
  "Unsanitary food",
  "Employee hygiene",
  "Food alert",
];

export const COMPLAINT_STATUSES = ["Open", "Closed"];

// Inspections store addresses like "48  WINTER ST" and 311 like "48 Winter St",
// so both are saved in this form to find the complaints at a restaurant
export function toAddressKey(address) {
  return String(address ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export async function createComplaintIndexes(db) {
  const collection = db.collection("complaints");
  await collection.createIndex({ openedAt: -1 });
  await collection.createIndex({ type: 1, status: 1 });
  await collection.createIndex({ neighborhood: 1 });
  await collection.createIndex({ addressKey: 1, zip: 1 });
  await collection.createIndex({ source: 1 });
}
