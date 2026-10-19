import { formatDate, request } from "./api.js";
import {
  createComplaintDetails,
  createStatusBadge,
  createTypeLabel,
} from "./complaintView.js";

const tab = document.getElementById("complaints-tab");
const noteEl = document.getElementById("complaints-note");
const listEl = document.getElementById("complaints-list");
const fileLink = document.getElementById("file-complaint-link");

function createComplaintItem(complaint) {
  const li = document.createElement("li");
  li.className = "result-card";

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.className = "complaint-summary";

  const date = document.createElement("span");
  date.className = "complaint-date";
  date.textContent = formatDate(complaint.openedAt);

  summary.append(
    date,
    createTypeLabel(complaint.type),
    createStatusBadge(complaint),
  );
  details.append(summary, createComplaintDetails(complaint));
  li.append(details);
  return li;
}

// Complaints are matched to the restaurant by its street address and zip
export async function initRestaurantComplaints({
  restaurantName,
  address,
  zip,
}) {
  const fileParams = new URLSearchParams({
    restaurant: restaurantName,
    address,
    zip,
  });
  fileLink.href = `complaints.html?${fileParams}#complaint-form`;

  try {
    const { items, total } = await request(
      `/api/complaints?${new URLSearchParams({ address, zip })}`,
    );
    tab.textContent = `311 Complaints (${total})`;
    noteEl.textContent =
      total === 0
        ? "No complaints reported at this address since 2024."
        : `${total} complaint${total === 1 ? "" : "s"} reported at this address since 2024, newest first. Other businesses at the same address share this list.`;
    if (total > items.length) {
      noteEl.textContent += ` Showing the newest ${items.length}.`;
    }
    listEl.replaceChildren(...items.map(createComplaintItem));
  } catch (err) {
    noteEl.textContent = `Could not load complaints: ${err.message}`;
  }
}
