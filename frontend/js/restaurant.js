import { createBadge, fillLegend } from "./results.js";
import { initReviews } from "./reviews.js";

const statusEl = document.getElementById("status");
const restaurantEl = document.getElementById("restaurant");
const historyEl = document.getElementById("history");

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function createViolationItem(violation) {
  const li = document.createElement("li");
  li.className = "violation";

  const title = document.createElement("p");
  title.className = "violation-title";
  if (violation.level > 0) {
    const level = document.createElement("span");
    level.className = "violation-level";
    level.textContent = "★".repeat(violation.level);
    level.title = `Level ${violation.level} of 3`;
    title.append(level, " ");
  }
  title.append(violation.description);

  const status = document.createElement("p");
  status.className = "violation-status";
  if (violation.status === "Pass") status.textContent = "Resolved";
  if (violation.status === "Fail") status.textContent = "Not resolved";

  li.append(title, status);

  if (violation.comments) {
    const comments = document.createElement("p");
    comments.className = "violation-comments";
    comments.textContent = violation.comments;
    li.append(comments);
  }
  return li;
}

function createInspectionItem(inspection) {
  const li = document.createElement("li");
  li.className = "result-card";

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.className = "inspection-summary";

  const date = document.createElement("span");
  date.className = "inspection-date";
  date.textContent = formatDate(inspection.date);

  const badge = createBadge(inspection.result);

  const count = inspection.violations.length;
  const countEl = document.createElement("span");
  countEl.className = "inspection-count";
  countEl.textContent = `${count} violation${count === 1 ? "" : "s"}`;

  summary.append(date, badge, countEl);
  details.append(summary);

  if (count > 0) {
    const list = document.createElement("ul");
    list.className = "violations";
    list.append(...inspection.violations.map(createViolationItem));
    details.append(list);
  } else {
    const none = document.createElement("p");
    none.className = "panel-note";
    none.textContent = "No violations recorded.";
    details.append(none);
  }

  li.append(details);
  return li;
}

function showRestaurant(inspections) {
  const { restaurantName, address, city, zip } = inspections[0];
  const location = `${address}, ${city}, MA ${zip}`;

  document.title = `${restaurantName} | FoodSafe Boston`;
  document.getElementById("restaurant-name").textContent = restaurantName;
  document.getElementById("restaurant-address").textContent = location;
  document.getElementById("maps-link").href =
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurantName}, ${location}`)}`;
  document.getElementById("yelp-link").href =
    `https://www.yelp.com/search?find_desc=${encodeURIComponent(restaurantName)}&find_loc=${encodeURIComponent(location)}`;

  const n = inspections.length;
  document.getElementById("history-title").textContent =
    `${n} inspection${n === 1 ? "" : "s"} on record, newest first.`;
  historyEl.replaceChildren(...inspections.map(createInspectionItem));
  historyEl.querySelector("details")?.setAttribute("open", "");
  restaurantEl.hidden = false;
}

async function loadRestaurant() {
  const license = new URLSearchParams(window.location.search).get("license");
  if (!license) {
    statusEl.textContent = "No restaurant selected.";
    return;
  }

  try {
    const res = await fetch(
      `/api/inspections/restaurant/${encodeURIComponent(license)}`,
    );
    if (res.status === 404) {
      statusEl.textContent = "Restaurant not found.";
      return;
    }
    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const inspections = await res.json();
    statusEl.hidden = true;
    showRestaurant(inspections);
    initReviews(license);
  } catch (err) {
    statusEl.textContent = `Could not load restaurant: ${err.message}`;
  }
}

function showTab(selected) {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const isSelected = tab === selected;
    tab.setAttribute("aria-selected", isSelected);
    document.getElementById(tab.getAttribute("aria-controls")).hidden =
      !isSelected;
  }
}

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => showTab(tab));
}

fillLegend(document.getElementById("result-legend"));
loadRestaurant();
