import dns from "node:dns";
import { MongoClient } from "mongodb";

const DB_NAME = process.env.DB_NAME || "foodsafe";

let client;
let db;

export async function connectDB() {
  if (db) return db;
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is not set. Copy .env.example to .env and fill it in.",
    );
  }
  // Fixes "querySrv ECONNREFUSED" on some Windows networks
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
  }
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database not connected. Call connectDB() first.");
  return db;
}

export async function closeDB() {
  await client?.close();
  client = undefined;
  db = undefined;
}
