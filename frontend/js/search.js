import { createBadge, createTypeIcon, fillLegend } from "./results.js";

const form = document.getElementById("search-form");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const pageInfo = document.getElementById("page-info");

let page = 1;

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function createResultItem(inspection) {
  const li = document.createElement("li");
  li.className = "result-card";

  const header = document.createElement("div");
  header.className = "result-header";

  const name = document.createElement("a");
  name.href = `restaurant.html?license=${encodeURIComponent(inspection.licenseNo)}`;
  name.textContent = inspection.restaurantName;

  const badge = createBadge(inspection.result);

  const title = document.createElement("span");
  title.className = "result-title";
  const icon = createTypeIcon(inspection.type);
  if (icon) title.append(icon);
  title.append(name);

  header.append(title, badge);

  const address = document.createElement("p");
  address.className = "result-address";
  address.textContent = `${inspection.address}, ${inspection.city} ${inspection.zip}`;

  const meta = document.createElement("p");
  meta.className = "result-meta";
  const count = inspection.violations.length;
  const worst = Math.max(0, ...inspection.violations.map((v) => v.level));
  meta.textContent = `Latest inspection ${formatDate(inspection.date)} · ${count} violation${count === 1 ? "" : "s"}`;
  if (worst > 0) meta.textContent += ` · most serious: ${"★".repeat(worst)}`;

  const history = document.createElement("p");
  history.className = "result-meta";
  const n = inspection.inspectionCount;
  history.textContent = `${n} inspection${n === 1 ? "" : "s"} on record`;

  li.append(header, address, meta, history);
  return li;
}

async function search() {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (value.trim()) params.set(key, value.trim());
  }
  params.set("page", page);

  statusEl.textContent = "Loading...";
  resultsEl.replaceChildren();

  try {
    const res = await fetch(`/api/inspections?${params}`);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const { items, total, pageSize } = await res.json();

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    statusEl.textContent =
      total === 0
        ? "No restaurants found. Try a different search."
        : `${total.toLocaleString()} restaurant${total === 1 ? "" : "s"} found`;
    resultsEl.replaceChildren(...items.map(createResultItem));

    pageInfo.textContent = `Page ${page} of ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
  } catch (err) {
    statusEl.textContent = `Could not load restaurants: ${err.message}`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  page = 1;
  search();
});

// Re-sort right away, without pressing Search
form.elements.sort.addEventListener("change", () => {
  page = 1;
  search();
});

form.addEventListener("reset", () => {
  page = 1;
  setTimeout(search);
});

prevBtn.addEventListener("click", () => {
  page--;
  search();
});

nextBtn.addEventListener("click", () => {
  page++;
  search();
});

fillLegend(document.getElementById("result-legend"));
search();
