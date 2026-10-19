import { formatDate, request } from "./api.js";
import { initComplaintForm } from "./complaintForm.js";
import { createComplaintMap } from "./complaintMap.js";
import {
  businessesText,
  complaintTitle,
  createComplaintDetails,
  createStatusBadge,
  createTypeLabel,
  fillTypeOptions,
} from "./complaintView.js";

const filterForm = document.getElementById("filter-form");
const countsEl = document.getElementById("type-counts");
const mapEl = document.getElementById("complaint-map");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("complaints");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const pageInfo = document.getElementById("page-info");
const dialog = document.getElementById("complaint-dialog");
const dialogTitle = document.getElementById("dialog-title");
const dialogBody = document.getElementById("dialog-body");
const dialogActions = document.getElementById("dialog-actions");

let page = 1;

const complaintMap = createComplaintMap(mapEl, openComplaint);
const complaintForm = initComplaintForm({ onSaved: refresh });

function filterParams() {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(filterForm)) {
    if (value.trim()) params.set(key, value.trim());
  }
  return params;
}

function showCounts(counts) {
  countsEl.replaceChildren(
    ...Object.entries(counts).map(([type, count]) => {
      const li = document.createElement("li");
      li.className = "type-count";
      const number = document.createElement("strong");
      number.textContent = count.toLocaleString();
      li.append(createTypeLabel(type), number);
      return li;
    }),
  );
}

function createButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function createComplaintItem(complaint) {
  const li = document.createElement("li");
  li.className = "result-card";

  const header = document.createElement("div");
  header.className = "complaint-header";
  const title = document.createElement("h3");
  title.textContent = complaintTitle(complaint);
  header.append(title, createStatusBadge(complaint));
  li.append(header);

  const businesses = businessesText(complaint);
  if (businesses) {
    const line = document.createElement("p");
    line.className = "complaint-businesses";
    line.textContent = businesses;
    li.append(line);
  }

  const meta = document.createElement("p");
  meta.className = "complaint-meta";
  meta.append(
    createTypeLabel(complaint.type),
    ` · Reported ${formatDate(complaint.openedAt)}`,
  );
  if (complaint.neighborhood) meta.append(` · ${complaint.neighborhood}`);
  if (complaint.source === "user") meta.append(" · Filed by a diner");

  const actions = document.createElement("div");
  actions.className = "complaint-actions";
  actions.append(
    createButton("Details", "secondary", () => showDialog(complaint)),
    createButton("Show on map", "secondary", () => {
      complaintMap.focus(complaint);
      mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }),
  );

  li.append(meta, actions);
  return li;
}

async function loadComplaints() {
  const params = filterParams();
  params.set("page", page);

  statusEl.textContent = "Loading...";
  listEl.replaceChildren();

  try {
    const { items, total, counts, pageSize } = await request(
      `/api/complaints?${params}`,
    );
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    statusEl.textContent =
      total === 0
        ? "No complaints found. Try a different search."
        : `${total.toLocaleString()} complaint${total === 1 ? "" : "s"} found`;
    showCounts(counts);
    listEl.replaceChildren(...items.map(createComplaintItem));

    pageInfo.textContent = `Page ${page} of ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
  } catch (err) {
    statusEl.textContent = `Could not load complaints: ${err.message}`;
  }
}

async function loadMap() {
  try {
    complaintMap.show(await request(`/api/complaints/map?${filterParams()}`));
  } catch (err) {
    statusEl.textContent = `Could not load the map: ${err.message}`;
  }
}

function search() {
  page = 1;
  loadComplaints();
  loadMap();
}

function refresh() {
  loadComplaints();
  loadMap();
}

async function openComplaint(id) {
  try {
    showDialog(await request(`/api/complaints/${id}`));
  } catch (err) {
    alert(`Could not load complaint: ${err.message}`);
  }
}

async function setStatus(complaint, status) {
  try {
    const updated = await request(`/api/complaints/${complaint._id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    showDialog(updated);
    refresh();
  } catch (err) {
    alert(`Could not update complaint: ${err.message}`);
  }
}

async function deleteComplaint(complaint) {
  if (!confirm("Delete this complaint? This cannot be undone.")) return;
  try {
    await request(`/api/complaints/${complaint._id}`, { method: "DELETE" });
    dialog.close();
    refresh();
  } catch (err) {
    alert(`Could not delete complaint: ${err.message}`);
  }
}

function showDialog(complaint) {
  dialogTitle.textContent = complaintTitle(complaint);
  dialogBody.replaceChildren(createComplaintDetails(complaint));
  dialogActions.replaceChildren();

  if (complaint.canEdit) {
    const open = complaint.status === "Open";
    dialogActions.append(
      createButton("Edit", "secondary", () => {
        dialog.close();
        complaintForm.startEdit(complaint);
      }),
      createButton(open ? "Mark resolved" : "Reopen", "secondary", () =>
        setStatus(complaint, open ? "Closed" : "Open"),
      ),
      createButton("Delete", "danger", () => deleteComplaint(complaint)),
    );
  }
  if (!dialog.open) dialog.showModal();
}

async function loadNeighborhoods() {
  try {
    const neighborhoods = await request("/api/complaints/neighborhoods");
    const select = filterForm.elements.neighborhood;
    const datalist = document.getElementById("neighborhood-list");
    for (const name of neighborhoods) {
      select.append(new Option(name, name));
      datalist.append(new Option(name));
    }
  } catch {
    // The text search still works without the list
  }
}

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  search();
});

filterForm.addEventListener("reset", () => setTimeout(search));

prevBtn.addEventListener("click", () => {
  page--;
  loadComplaints();
});

nextBtn.addEventListener("click", () => {
  page++;
  loadComplaints();
});

document
  .getElementById("dialog-close")
  .addEventListener("click", () => dialog.close());

fillTypeOptions(filterForm.elements.type);
loadNeighborhoods();
search();
