import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";

const router = Router();

// There is no login, so each browser keeps a random token and sends it with
// every request. Only the browser that wrote a review can edit or delete it.
function getToken(req) {
  return req.get("X-Review-Token") || "";
}

// Returns the cleaned fields, or an error message
function validateReview(body) {
  const author = String(body.author ?? "").trim() || "Anonymous";
  const text = String(body.text ?? "").trim();
  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be a whole number from 1 to 5" };
  }
  if (!text) return { error: "Review text is required" };
  if (text.length > 1000) {
    return { error: "Review must be 1000 characters or less" };
  }
  if (author.length > 50) {
    return { error: "Name must be 50 characters or less" };
  }

  return { review: { author, rating, text } };
}

// Hides the token and tells the page which reviews this browser can change
function toPublic(review, token) {
  const { authorToken, ...rest } = review;
  return { ...rest, canEdit: Boolean(token) && authorToken === token };
}

// GET /api/reviews?license=123456
router.get("/", async (req, res) => {
  const { license } = req.query;
  if (!license) return res.status(400).json({ error: "license is required" });

  const reviews = await getDB()
    .collection("reviews")
    .find({ licenseNo: license })
    .sort({ createdAt: -1 })
    .toArray();

  res.json(reviews.map((review) => toPublic(review, getToken(req))));
});

// POST /api/reviews  { licenseNo, author, rating, text }
router.post("/", async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(400).json({ error: "Missing review token" });

  const { review, error } = validateReview(req.body);
  if (error) return res.status(400).json({ error });

  const licenseNo = String(req.body.licenseNo ?? "");
  const restaurant = await getDB()
    .collection("inspections")
    .findOne({ licenseNo });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }

  const now = new Date();
  const doc = {
    ...review,
    licenseNo,
    createdAt: now,
    updatedAt: now,
    authorToken: token,
  };
  const { insertedId } = await getDB().collection("reviews").insertOne(doc);

  res.status(201).json(toPublic({ _id: insertedId, ...doc }, token));
});

// PUT /api/reviews/:id  { author, rating, text }
router.put("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Review not found" });
  }
  const { review, error } = validateReview(req.body);
  if (error) return res.status(400).json({ error });

  const token = getToken(req);
  const updated = await getDB()
    .collection("reviews")
    .findOneAndUpdate(
      { _id: new ObjectId(req.params.id), authorToken: token },
      { $set: { ...review, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  if (!updated) {
    return res
      .status(403)
      .json({ error: "You can only edit reviews you wrote" });
  }

  res.json(toPublic(updated, token));
});

// DELETE /api/reviews/:id
router.delete("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Review not found" });
  }

  const { deletedCount } = await getDB()
    .collection("reviews")
    .deleteOne({
      _id: new ObjectId(req.params.id),
      authorToken: getToken(req),
    });
  if (deletedCount === 0) {
    return res
      .status(403)
      .json({ error: "You can only delete reviews you wrote" });
  }

  res.status(204).end();
});

export default router;
