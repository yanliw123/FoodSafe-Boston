import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";

const router = Router();

// Favorites are private: each browser only sees and changes the ones it saved,
// using the same random token as reviews
function getToken(req) {
  return req.get("X-Browser-Token") || "";
}

router.use((req, res, next) => {
  if (!getToken(req)) {
    return res.status(400).json({ error: "Missing browser token" });
  }
  next();
});

// Returns the cleaned note, or an error message
function validateNote(body) {
  const note = String(body.note ?? "").trim();
  if (note.length > 200)
    return { error: "Note must be 200 characters or less" };
  return { note };
}

// GET /api/favorites, or /api/favorites?license=123456 to check one restaurant.
// Each favorite comes with the restaurant's latest inspection.
router.get("/", async (req, res) => {
  const match = { ownerToken: getToken(req) };
  if (req.query.license) match.licenseNo = String(req.query.license);

  const favorites = await getDB()
    .collection("favorites")
    .aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "inspections",
          localField: "licenseNo",
          foreignField: "licenseNo",
          pipeline: [
            { $sort: { date: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                restaurantName: 1,
                address: 1,
                city: 1,
                zip: 1,
                type: 1,
                result: 1,
                date: 1,
              },
            },
          ],
          as: "latest",
        },
      },
      { $set: { latest: { $first: "$latest" } } },
      { $project: { ownerToken: 0 } },
    ])
    .toArray();

  res.json(favorites);
});

// POST /api/favorites  { licenseNo, note }
router.post("/", async (req, res) => {
  const { note, error } = validateNote(req.body);
  if (error) return res.status(400).json({ error });

  const licenseNo = String(req.body.licenseNo ?? "");
  const restaurant = await getDB()
    .collection("inspections")
    .findOne({ licenseNo });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }

  const ownerToken = getToken(req);
  const favorites = getDB().collection("favorites");
  if (await favorites.findOne({ ownerToken, licenseNo })) {
    return res.status(409).json({ error: "Restaurant is already saved" });
  }

  const now = new Date();
  const favorite = { licenseNo, note, createdAt: now, updatedAt: now };
  const { insertedId } = await favorites.insertOne({ ...favorite, ownerToken });

  res.status(201).json({ _id: insertedId, ...favorite });
});

// PUT /api/favorites/:id  { note }
router.put("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Favorite not found" });
  }
  const { note, error } = validateNote(req.body);
  if (error) return res.status(400).json({ error });

  const updated = await getDB()
    .collection("favorites")
    .findOneAndUpdate(
      { _id: new ObjectId(req.params.id), ownerToken: getToken(req) },
      { $set: { note, updatedAt: new Date() } },
      { returnDocument: "after", projection: { ownerToken: 0 } },
    );
  if (!updated) return res.status(404).json({ error: "Favorite not found" });

  res.json(updated);
});

// DELETE /api/favorites/:id
router.delete("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Favorite not found" });
  }

  const { deletedCount } = await getDB()
    .collection("favorites")
    .deleteOne({
      _id: new ObjectId(req.params.id),
      ownerToken: getToken(req),
    });
  if (deletedCount === 0) {
    return res.status(404).json({ error: "Favorite not found" });
  }

  res.status(204).end();
});

export default router;
