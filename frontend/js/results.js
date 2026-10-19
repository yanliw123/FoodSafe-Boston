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

export function createBadge(result) {
  const badge = document.createElement("span");
  badge.className = `badge badge-${result.toLowerCase()}`;
  badge.textContent = result;
  if (RESULTS[result]) badge.title = RESULTS[result];
  return badge;
}

// Fills a <details> element with a list of every result code
export function fillLegend(legend) {
  const list = document.createElement("dl");
  for (const [result, meaning] of Object.entries(RESULTS)) {
    const term = document.createElement("dt");
    term.append(createBadge(result));
    const description = document.createElement("dd");
    description.textContent = meaning;
    list.append(term, description);
  }

  const note = document.createElement("p");
  note.className = "legend-note";
  note.textContent =
    "Codes come from the City of Boston. Fail and TSOP use the city's wording. The rest are our best reading of the data.";

  legend.append(list, note);
}
