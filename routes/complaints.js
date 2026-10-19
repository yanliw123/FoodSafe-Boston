import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/connection.js";
import {
  COMPLAINT_STATUSES,
  COMPLAINT_TYPES,
  toAddressKey,
} from "../db/complaints.js";

const router = Router();
const PAGE_SIZE = 20;

// Rough box around Boston, so a complaint can't be placed somewhere else
const BOUNDS = { south: 42.22, north: 42.41, west: -71.2, east: -70.98 };

function complaints() {
  return getDB().collection("complaints");
}

// Same random browser token as reviews and favorites. Only the browser that
// filed a complaint can change it, and 311 complaints can't be changed.
function getToken(req) {
  return req.get("X-Browser-Token") || "";
}

function ownComplaint(req) {
  return {
    _id: new ObjectId(req.params.id),
    source: "user",
    ownerToken: getToken(req),
  };
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Hides the token and tells the page which complaints this browser can change
function toPublic(complaint, token) {
  const { ownerToken, ...rest } = complaint;
  return { ...rest, canEdit: Boolean(token) && ownerToken === token };
}

// Builds the Mongo filter from ?q=&neighborhood=&type=&status=&from=&to=,
// or ?address=&zip= for the complaints at one restaurant
function buildFilter(query) {
  const { q, neighborhood, type, status, from, to, address, zip } = query;
  const filter = {};

  if (q?.trim()) {
    const pattern = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [
      { address: pattern },
      { neighborhood: pattern },
      { restaurantName: pattern },
      { nearbyBusinesses: pattern },
    ];
  }
  if (neighborhood) filter.neighborhood = String(neighborhood);
  if (type) filter.type = String(type);
  if (status) filter.status = String(status);
  if (address) filter.addressKey = toAddressKey(address);
  if (zip) filter.zip = String(zip).trim();
  if (from || to) {
    filter.openedAt = {};
    if (from) filter.openedAt.$gte = new Date(from);
    if (to) filter.openedAt.$lte = new Date(`${to}T23:59:59`);
  }
  return filter;
}

// Returns the cleaned fields, or an error message
function validateComplaint(body) {
  const text = (name) => String(body[name] ?? "").trim();
  const restaurantName = text("restaurantName");
  const address = text("address");
  const zip = text("zip");
  const neighborhood = text("neighborhood");
  const type = text("type");
  const description = text("description");
  const day = text("date");
  // Noon, so the day doesn't change when shown in another time zone
  const openedAt = new Date(`${day}T12:00:00`);
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!restaurantName) return { error: "Restaurant name is required" };
  if (restaurantName.length > 100) {
    return { error: "Restaurant name must be 100 characters or less" };
  }
  if (!address) return { error: "Address is required" };
  if (address.length > 120) {
    return { error: "Address must be 120 characters or less" };
  }
  if (zip && !/^\d{5}$/.test(zip)) {
    return { error: "Zip code must be 5 digits" };
  }
  if (!neighborhood) return { error: "Neighborhood is required" };
  if (neighborhood.length > 60) {
    return { error: "Neighborhood must be 60 characters or less" };
  }
  if (!COMPLAINT_TYPES.includes(type)) {
    return { error: "Pick a complaint type" };
  }
  if (Number.isNaN(openedAt.getTime())) {
    return { error: "Date is required" };
  }
  if (new Date(`${day}T00:00:00`) > new Date()) {
    return { error: "Date can't be in the future" };
  }
  if (!description) return { error: "Description is required" };
  if (description.length > 1000) {
    return { error: "Description must be 1000 characters or less" };
  }
  if (
    !(lat >= BOUNDS.south && lat <= BOUNDS.north) ||
    !(lng >= BOUNDS.west && lng <= BOUNDS.east)
  ) {
    return { error: "Pick the place on the map, inside Boston" };
  }

  return {
    complaint: {
      restaurantName,
      address,
      addressKey: toAddressKey(address),
      zip,
      neighborhood,
      type,
      openedAt,
      description,
      location: { type: "Point", coordinates: [lng, lat] },
    },
  };
}

// GET /api/complaints?q=&neighborhood=&type=&status=&from=&to=&page=
// q matches the address, neighborhood, restaurant name or a business nearby
// One page of complaints, newest first, plus the count of each type
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const [{ items, total, byType }] = await complaints()
    .aggregate([
      { $match: buildFilter(req.query) },
      {
        $facet: {
          items: [
            { $sort: { openedAt: -1, _id: -1 } },
            { $skip: (page - 1) * PAGE_SIZE },
            { $limit: PAGE_SIZE },
          ],
          total: [{ $count: "count" }],
          byType: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
        },
      },
      {
        $project: {
          items: 1,
          byType: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        },
      },
    ])
    .toArray();

  const counts = Object.fromEntries(COMPLAINT_TYPES.map((type) => [type, 0]));
  for (const { _id, count } of byType) counts[_id] = count;

  const token = getToken(req);
  res.json({
    items: items.map((complaint) => toPublic(complaint, token)),
    total,
    counts,
    page,
    pageSize: PAGE_SIZE,
  });
});

// GET /api/complaints/map?<same filters>
// Every matching complaint with just what the map needs
router.get("/map", async (req, res) => {
  const points = await complaints()
    .find(buildFilter(req.query), {
      projection: {
        type: 1,
        status: 1,
        address: 1,
        restaurantName: 1,
        nearbyBusinesses: 1,
        openedAt: 1,
        location: 1,
      },
    })
    .toArray();
  res.json(points);
});

// GET /api/complaints/neighborhoods
router.get("/neighborhoods", async (req, res) => {
  const neighborhoods = await complaints().distinct("neighborhood");
  res.json(neighborhoods.filter(Boolean).sort());
});

// GET /api/complaints/:id
router.get("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Complaint not found" });
  }
  const complaint = await complaints().findOne({
    _id: new ObjectId(req.params.id),
  });
  if (!complaint) return res.status(404).json({ error: "Complaint not found" });

  res.json(toPublic(complaint, getToken(req)));
});

// POST /api/complaints
// { restaurantName, address, zip, neighborhood, type, date, description, lat, lng }
router.post("/", async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(400).json({ error: "Missing browser token" });

  const { complaint, error } = validateComplaint(req.body);
  if (error) return res.status(400).json({ error });

  const now = new Date();
  const doc = {
    ...complaint,
    status: "Open",
    closedAt: null,
    outcome: "",
    response: "",
    source: "user",
    createdAt: now,
    updatedAt: now,
    ownerToken: token,
  };
  const { insertedId } = await complaints().insertOne(doc);

  res.status(201).json(toPublic({ _id: insertedId, ...doc }, token));
});

// PUT /api/complaints/:id  same body as POST
router.put("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Complaint not found" });
  }
  const { complaint, error } = validateComplaint(req.body);
  if (error) return res.status(400).json({ error });

  const updated = await complaints().findOneAndUpdate(
    ownComplaint(req),
    { $set: { ...complaint, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) {
    return res
      .status(403)
      .json({ error: "You can only edit complaints you filed" });
  }

  res.json(toPublic(updated, getToken(req)));
});

// PATCH /api/complaints/:id  { status: "Closed" } marks it resolved,
// { status: "Open" } opens it again
router.patch("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Complaint not found" });
  }
  const { status } = req.body;
  if (!COMPLAINT_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status must be Open or Closed" });
  }

  const closed = status === "Closed";
  const updated = await complaints().findOneAndUpdate(
    ownComplaint(req),
    {
      $set: {
        status,
        closedAt: closed ? new Date() : null,
        outcome: closed ? "Resolved" : "",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    return res
      .status(403)
      .json({ error: "You can only change complaints you filed" });
  }

  res.json(toPublic(updated, getToken(req)));
});

// DELETE /api/complaints/:id
router.delete("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: "Complaint not found" });
  }

  const { deletedCount } = await complaints().deleteOne(ownComplaint(req));
  if (deletedCount === 0) {
    return res
      .status(403)
      .json({ error: "You can only delete complaints you filed" });
  }

  res.status(204).end();
});

export default router;
