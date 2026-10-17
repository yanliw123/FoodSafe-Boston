import "dotenv/config";
import { randomUUID } from "node:crypto";
import { connectDB, closeDB } from "../db/connection.js";

const RESTAURANT_COUNT = Number(process.argv[2]) || 100;

const AUTHORS = [
  "Maria",
  "James",
  "Priya",
  "Wei",
  "Carlos",
  "Aisha",
  "Tom",
  "Mei",
  "Daniel",
  "Sofia",
  "Anonymous",
];

const REVIEWS = {
  5: [
    "Spotless dining room and the kitchen looked very clean. Food was great.",
    "Staff wore gloves the whole time and the restrooms were clean. Will come back.",
    "One of the cleanest places in the neighborhood. Fresh food every time.",
  ],
  4: [
    "Clean tables and friendly staff. Food was good, a bit slow at lunch.",
    "Mostly clean, the counter could be wiped more often. Tasty food.",
    "Good food and the place looked well kept.",
  ],
  3: [
    "Food was fine but the tables were sticky when we sat down.",
    "Average. The floor near the kitchen door was dirty.",
    "OK for takeout. I would not eat in when it is busy.",
  ],
  2: [
    "Restroom was dirty and there was no soap. Food was just OK.",
    "Saw food left out on the counter for a long time.",
    "The dining area smelled bad and the trash was overflowing.",
  ],
  1: [
    "Saw a mouse near the back door. Not coming back.",
    "Got sick after eating here. The kitchen looked filthy.",
    "Staff handled money and then food without washing hands.",
  ],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Restaurants that failed their latest inspection get lower ratings
function randomRating(latestResult) {
  const ratings = latestResult === "Fail" ? [1, 2, 2, 3, 4] : [3, 4, 4, 5, 5];
  return pick(ratings);
}

function randomDate() {
  const daysAgo = Math.floor(Math.random() * 90);
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

async function main() {
  const db = await connectDB();

  const restaurants = await db
    .collection("inspections")
    .aggregate([
      { $sort: { date: -1 } },
      { $group: { _id: "$licenseNo", result: { $first: "$result" } } },
      { $sample: { size: RESTAURANT_COUNT } },
    ])
    .toArray();

  // A token no browser has, so nobody can edit or delete sample reviews in the app
  const authorToken = randomUUID();
  const reviews = restaurants.flatMap(({ _id: licenseNo, result }) => {
    const count = 1 + Math.floor(Math.random() * 3);
    return Array.from({ length: count }, () => {
      const rating = randomRating(result);
      const date = randomDate();
      return {
        author: pick(AUTHORS),
        rating,
        text: pick(REVIEWS[rating]),
        licenseNo,
        createdAt: date,
        updatedAt: date,
        authorToken,
        sample: true,
      };
    });
  });

  // Re-running replaces the old sample reviews and keeps real ones
  const { deletedCount } = await db
    .collection("reviews")
    .deleteMany({ sample: true });
  console.log(`Removed ${deletedCount} old sample reviews`);

  await db.collection("reviews").insertMany(reviews);
  await db.collection("reviews").createIndex({ licenseNo: 1, createdAt: -1 });

  console.log(
    `Added ${reviews.length} sample reviews for ${restaurants.length} restaurants`,
  );
  await closeDB();
}

main().catch(async (err) => {
  console.error(err);
  await closeDB();
  process.exit(1);
});
