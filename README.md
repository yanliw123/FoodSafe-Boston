# FoodSafe Boston

Check if a restaurant is clean before you eat there.

## Authors

- Yanli Wang
- Jiaying Guo

## Class

Web Development CS5610

## Project Objective

The City of Boston posts every restaurant health inspection online, but the dataset has more than 900,000 rows and is hard for diners to use. FoodSafe Boston lets people search a restaurant and see its latest inspection result, its past inspections and how serious each violation was, with links to Google Maps and Yelp. Because the city only inspects a restaurant once or twice a year, the app also maps the food safety complaints residents sent to Boston 311 between inspections, and lets diners file their own complaints.

## Screenshot

<!-- TODO: add screenshot -->

## Links

- Deployed app: <!-- TODO -->
- Demo video: <!-- TODO -->
- Design document and mockups: <!-- TODO -->

## Tech Stack

- Frontend: HTML5, CSS3, vanilla JavaScript (ES6 modules, Fetch), client side rendering
- Backend: Node.js + Express (ES modules)
- Database: MongoDB with the native Node.js driver

## Instructions to Build

1. Install Node.js 20 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and set `MONGO_URI` to your MongoDB connection string.
4. Import the inspection data. Download the CSV from [Food Establishment Inspections](https://data.boston.gov/dataset/food-establishment-inspections), save it as `data/inspections.csv`, then run:
   ```bash
   npm run import:inspections
   ```
5. Start the server:
   ```bash
   npm start
   ```
6. Open http://localhost:3000.

## Project Structure

```
server.js        Express app entry point
db/              MongoDB connection module
routes/          API routes (inspections, complaints)
scripts/         Data import scripts
frontend/        Static HTML pages, CSS modules and client JS
design/          Design document and mockups
```

## License

[MIT](LICENSE)
