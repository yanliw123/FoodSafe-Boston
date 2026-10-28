import { Router } from "express";
import { getDB } from "../db/connection.js";

const router = Router();
const PAGE_SIZE = 20;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns one result per restaurant: its latest inspection plus how many it had.
// GET /api/inspections?q=pizza&zip=02115&result=Fail&from=2026-01-01&to=2026-06-30&sort=name&page=1
// Lists the most recently inspected restaurants first, or A to Z with sort=name
router.get("/", async (req, res) => {
  const { q, zip, result, from, to, sort } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const match = {};

  if (q) {
    const pattern = new RegExp(escapeRegex(q.trim()), "i");
    match.$or = [{ restaurantName: pattern }, { address: pattern }];
  }
  if (zip) match.zip = zip.trim();
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(`${to}T23:59:59`);
  }

  const [{ items, total }] = await getDB()
    .collection("inspections")
    .aggregate([
      { $match: match },
      { $sort: { licenseNo: 1, date: -1 } },
      {
        $group: {
          _id: "$licenseNo",
          latest: { $first: "$$ROOT" },
          inspectionCount: { $sum: 1 },
        },
      },
      { $set: { "latest.inspectionCount": "$inspectionCount" } },
      { $replaceRoot: { newRoot: "$latest" } },
      // Filter on the latest result, so "Pass" means the restaurant passes now
      ...(result ? [{ $match: { result } }] : []),
      {
        $sort:
          sort === "name"
            ? { restaurantName: 1 }
            : { date: -1, restaurantName: 1 },
      },
      {
        $facet: {
          items: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
          total: [{ $count: "count" }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        },
      },
    ])
    .toArray();

  res.json({ items, total, page, pageSize: PAGE_SIZE });
});

// How many restaurants have each result as their latest inspection
// GET /api/inspections/stats?zip=02115
router.get("/stats", async (req, res) => {
  const { zip } = req.query;
  const match = zip ? { zip: zip.trim() } : {};

  const counts = await getDB()
    .collection("inspections")
    .aggregate([
      { $match: match },
      { $sort: { licenseNo: 1, date: -1 } },
      { $group: { _id: "$licenseNo", result: { $first: "$result" } } },
      { $group: { _id: "$result", count: { $sum: 1 } } },
    ])
    .toArray();

  const results = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  res.json({ zip: zip ?? null, total, results });
});

// All inspections for one restaurant, newest first
// GET /api/inspections/restaurant/123456
router.get("/restaurant/:licenseNo", async (req, res) => {
  const inspections = await getDB()
    .collection("inspections")
    .find({ licenseNo: req.params.licenseNo })
    .sort({ date: -1 })
    .toArray();

  if (inspections.length === 0) {
    return res.status(404).json({ error: "Restaurant not found" });
  }
  res.json(inspections);
});

export default router;
