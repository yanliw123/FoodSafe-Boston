// What each inspection result code means. Fail and TSOP follow the city's
// own wording. The city has no definitions for the others, so those are
// our reading of the data.
const RESULTS = {
  Pass: "Passed the inspection.",
  Fail: "Violations found. A re-inspection is required.",
  // Closures and permit problems
  VolClos: "The restaurant closed on its own, usually to fix a problem.",
  OutBus: "The restaurant is out of business.",
  TSOP: "Permit to operate temporarily suspended.",
  // Administrative records, neither good nor bad
  Filed: "Recorded by the inspector without a pass or fail result.",
  Hearing: "Sent to a hearing with the city over violations.",
  NotReq:
    "A scheduled inspection that was not needed, often a follow-up after a pass.",
  Misc: "Another kind of administrative record.",
};

// The four license types in the city data, each drawn as a 24x24 line icon
const TYPES = {
  "Eating & Drinking": {
    meaning: "Sit-down restaurant.",
    paths: [
      "M6 3v5M8 3v5M10 3v5M6 8a2 2 0 0 0 4 0M8 10v11",
      "M16 21V3c2 1 3 4 3 8h-3",
    ],
  },
  "Eating & Drinking w/ Take Out": {
    meaning: "Restaurant that also sells takeout.",
    paths: ["M5 8h14l-1 13H6L5 8z", "M9 8V6a3 3 0 0 1 6 0v2"],
  },
  "Retail Food": {
    meaning: "Shop that sells food, such as a grocery or convenience store.",
    paths: [
      "M3 10h18l-2 10H5L3 10z",
      "M8 10l3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3",
    ],
  },
  "Mobile Food": {
    meaning: "Food truck or cart.",
    paths: [
      "M2 6h11v10H2z",
      "M13 10h4l4 4v2h-8",
      "M5 9h5",
      "M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
      "M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    ],
  },
};

export function createBadge(result) {
  const badge = document.createElement("span");
  badge.className = `badge badge-${result.toLowerCase()}`;
  badge.textContent = result;
  if (RESULTS[result]) badge.title = RESULTS[result];
  return badge;
}

// Returns an icon for the restaurant type, or null for an unknown type
export function createTypeIcon(type) {
  if (!TYPES[type]) return null;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "type-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of TYPES[type].paths) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  const icon = document.createElement("span");
  icon.className = "type";
  icon.title = type;
  icon.append(svg);
  return icon;
}

function createList(entries, createTerm) {
  const list = document.createElement("dl");
  for (const [key, meaning] of entries) {
    const term = document.createElement("dt");
    term.append(createTerm(key));
    const description = document.createElement("dd");
    description.textContent = meaning;
    list.append(term, description);
  }
  return list;
}

// Fills a <details> element with every result code and restaurant type
export function fillLegend(legend) {
  const resultsTitle = document.createElement("h4");
  resultsTitle.textContent = "Inspection results";
  const results = createList(Object.entries(RESULTS), createBadge);

  const typesTitle = document.createElement("h4");
  typesTitle.textContent = "Restaurant types";
  const types = createList(
    Object.entries(TYPES).map(([type, { meaning }]) => [type, meaning]),
    (type) => {
      const term = createTypeIcon(type);
      term.append(type);
      return term;
    },
  );

  const note = document.createElement("p");
  note.className = "legend-note";
  note.textContent =
    "Codes come from the City of Boston. Fail and TSOP use the city's wording. The rest are our best reading of the data.";

  legend.append(resultsTitle, results, typesTitle, types, note);
}
