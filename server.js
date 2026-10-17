import "dotenv/config";
import express from "express";
import { connectDB } from "./db/connection.js";
import inspectionsRouter from "./routes/inspections.js";
import complaintsRouter from "./routes/complaints.js";
import reviewsRouter from "./routes/reviews.js";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static("frontend"));

app.use("/api/inspections", inspectionsRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/reviews", reviewsRouter);

await connectDB();
app.listen(PORT, () => {
  console.log(`FoodSafe Boston running at http://localhost:${PORT}`);
});
