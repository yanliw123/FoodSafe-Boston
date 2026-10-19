import { formatDate } from "./api.js";

// Each complaint type with the color used on the map and in the counts
export const TYPE_COLORS = {
  "Unsanitary establishment": "#c62828",
  "Unsanitary food": "#b45309",
  "Employee hygiene": "#6a4c93",
  "Food alert": "#1565c0",
};

// What the city's closing outcomes mean
const OUTCOMES = {
  Resolved: "The city responded and closed the case.",
  Noted: "The city noted the complaint, usually after an inspection.",
  Invalid: "The city found the complaint was not valid.",
  Duplicate: "Another complaint already covered this.",
};

export function fillTypeOptions(select) {
  for (const type of Object.keys(TYPE_COLORS)) {
    select.append(new Option(type, type));
  }
}

export function createTypeLabel(type) {
  const label = document.createElement("span");
  label.className = "complaint-type";

  const dot = document.createElement("span");
  dot.className = "type-dot";
  dot.style.background = TYPE_COLORS[type];

  label.append(dot, type);
  return label;
}

export function createStatusBadge(complaint) {
  const badge = document.createElement("span");
  const open = complaint.status === "Open";
  badge.className = `badge ${open ? "badge-open" : "badge-closed"}`;
  badge.textContent = open ? "Open" : complaint.outcome || "Closed";
  if (!open && OUTCOMES[complaint.outcome]) {
    badge.title = OUTCOMES[complaint.outcome];
  }
  return badge;
}

export function complaintTitle(complaint) {
  return complaint.address || complaint.restaurantName || "Unknown place";
}

// Boston 311 only records the address, so name the businesses found there.
// It says "at this address" because the complaint may be about any of them.
export function businessesText(complaint) {
  if (complaint.restaurantName)
    return `Restaurant: ${complaint.restaurantName}`;

  const names = complaint.nearbyBusinesses ?? [];
  if (names.length === 0) return "";
  if (names.length <= 3) return `At this address: ${names.join(", ")}`;
  return `${names.length} food businesses at this address`;
}

// Full details of one complaint as a description list
export function createComplaintDetails(complaint) {
  const list = document.createElement("dl");
  list.className = "complaint-details";

  function addRow(label, value) {
    if (!value) return;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.append(value);
    list.append(dt, dd);
  }

  const place = [complaint.address, complaint.zip].filter(Boolean).join(", ");
  addRow("Type", createTypeLabel(complaint.type));
  addRow("Status", createStatusBadge(complaint));
  addRow("Reported", formatDate(complaint.openedAt));
  if (complaint.closedAt) addRow("Closed", formatDate(complaint.closedAt));
  addRow("Address", place);
  addRow("Restaurant", complaint.restaurantName);
  if (complaint.nearbyBusinesses?.length) {
    const names = document.createElement("span");
    names.textContent = complaint.nearbyBusinesses.join(", ");
    const note = document.createElement("small");
    note.className = "complaint-note";
    note.textContent =
      "Boston 311 does not record the business name. We matched it by location.";
    addRow("Businesses here", names);
    list.lastChild.append(note);
  }
  addRow("Neighborhood", complaint.neighborhood);
  addRow(
    "Filed by",
    complaint.source === "311"
      ? `Boston 311, case ${complaint.caseId}`
      : "A diner, in this app",
  );
  addRow("Description", complaint.description);
  if (complaint.source === "311") {
    addRow("City response", complaint.response || "No response yet.");
  }
  return list;
}
