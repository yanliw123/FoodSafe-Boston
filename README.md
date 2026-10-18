# FoodSafe Boston

Check if a restaurant is clean before you eat there.

## Authors

- Yanli Wang
- Jiaying Guo

## Class

[CS5610 Web Development, Fall 2026](https://johnguerra.co/classes/webDevelopment_online_fall_2026/), Northeastern University

## Project Objective

The City of Boston posts every restaurant health inspection online, but the dataset has more than 900,000 rows and is hard for diners to use. FoodSafe Boston lets people search a restaurant and see its latest inspection result, its past inspections and how serious each violation was, with links to Google Maps and Yelp. Diners can also leave their own reviews of a restaurant. Because the city only inspects a restaurant once or twice a year, the app also maps the food safety complaints residents sent to Boston 311 between inspections, and lets diners file their own complaints.

## Features

### Inspections and reviews (Yanli Wang)

- Search restaurants by name, street or zip code, filter by zip code, latest result (Pass or Fail) and date range, and sort by latest inspection date (default) or name. Each restaurant shows up once, with its latest inspection.
- Open a restaurant to see every inspection on record, each violation, how serious it was (★ to ★★★), whether it was corrected and the inspector's comments.
- Post, edit and delete reviews with a 1 to 5 star rating. There is no login, so each browser keeps a random key and can only change the reviews it wrote.

### 311 complaints (Jiaying Guo)

- See food safety complaints residents reported to Boston 311 at a restaurant's address.
- Browse complaints on a map and file new complaints.

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

## Data

| Collection    | Source                                                                                                             | Who can change it                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `inspections` | [Food Establishment Inspections](https://data.boston.gov/dataset/food-establishment-inspections), 2026 inspections | Read only, loaded by the import   |
| `reviews`     | Written by users in the app                                                                                        | The browser that wrote the review |
| `complaints`  | [311 Service Requests](https://data.boston.gov/dataset/311-service-requests) and users                             | Users                             |

## API

| Method | Path                                                     | Description                                                                                        |
| ------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/api/inspections?q=&zip=&result=&from=&to=&sort=&page=` | Search restaurants, one result per restaurant, newest inspection first, or A to Z with `sort=name` |
| GET    | `/api/inspections/restaurant/:licenseNo`                 | All inspections for one restaurant, newest first                                                   |
| GET    | `/api/reviews?license=`                                  | Reviews for one restaurant                                                                         |
| POST   | `/api/reviews`                                           | Add a review                                                                                       |
| PUT    | `/api/reviews/:id`                                       | Edit your review                                                                                   |
| DELETE | `/api/reviews/:id`                                       | Delete your review                                                                                 |
| GET    | `/api/complaints`                                        | List complaints                                                                                    |

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
   This loads the 2026 inspections. Re-running it replaces the imported data and keeps reviews.
5. (Optional) Add sample reviews to 100 random restaurants:
   ```bash
   npm run seed:reviews
   ```
   Re-running it replaces the old sample reviews and keeps reviews written in the app.
6. Start the server:
   ```bash
   npm start
   ```
7. Open http://localhost:3000.

## Project Structure

```
server.js        Express app entry point
db/              MongoDB connection module
routes/          API routes (inspections, reviews, complaints)
scripts/         Data import scripts
frontend/        Static HTML pages, CSS modules and client JS
design/          Design document and mockups
```

## License

[MIT](LICENSE)
