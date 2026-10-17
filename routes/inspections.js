import { Router } from "express";
import { getDB } from "../db/connection.js";

const router = Router();
const PAGE_SIZE = 20;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns one result per restaurant: its latest inspection plus how many it had.
// GET /api/inspections?q=pizza&zip=02115&result=Fail&from=2026-01-01&to=2026-06-30&page=1
router.get("/", async (req, res) => {
  const { q, zip, result, from, to } = req.query;
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
      { $sort: { restaurantName: 1 } },
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

export default router;
