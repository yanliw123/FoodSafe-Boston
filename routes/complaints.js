import { Router } from "express";
import { getDB } from "../db/connection.js";

const router = Router();
const PAGE_SIZE = 20;

// GET /api/complaints?page=1
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const collection = getDB().collection("complaints");
  const [items, total] = await Promise.all([
    collection
      .find({})
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    collection.countDocuments({}),
  ]);
  res.json({ items, total, page, pageSize: PAGE_SIZE });
});

export default router;
