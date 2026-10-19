import { formatDate, request } from "./api.js";
import { createBadge, createTypeLabel } from "./results.js";

const statusEl = document.getElementById("status");
const listEl = document.getElementById("favorites");

function showStatus(count) {
  if (count > 0) {
    statusEl.textContent = `${count} saved restaurant${count === 1 ? "" : "s"}`;
    return;
  }
  const link = document.createElement("a");
  link.href = "index.html";
  link.textContent = "Search for a restaurant";
  statusEl.replaceChildren(
    "You have not saved any restaurants yet. ",
    link,
    " and press Save on its page.",
  );
}

function createNote(favorite) {
  const note = document.createElement("p");
  note.className = favorite.note ? "favorite-note" : "favorite-note empty";
  note.textContent = favorite.note || "No note yet.";
  return note;
}

// Swaps the note for a small form, and back again on save or cancel
function startEdit(li, favorite) {
  const form = document.createElement("form");
  form.className = "note-form";

  const label = document.createElement("label");
  label.textContent = "Private note";
  const input = document.createElement("textarea");
  input.name = "note";
  input.rows = 2;
  input.maxLength = 200;
  input.placeholder = "e.g. Kid friendly, ask about peanuts";
  input.value = favorite.note;
  label.append(input);

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.textContent = "Save note";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "secondary";
  cancelBtn.textContent = "Cancel";

  const actions = document.createElement("div");
  actions.className = "favorite-actions";
  actions.append(saveBtn, cancelBtn);

  const message = document.createElement("p");
  message.className = "form-message";
  message.setAttribute("aria-live", "polite");

  form.append(label, actions, message);
  li.querySelector(".favorite-body").replaceChildren(form);
  input.focus();

  cancelBtn.addEventListener("click", () => {
    li.replaceWith(createFavoriteItem(favorite));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;
    try {
      const updated = await request(`/api/favorites/${favorite._id}`, {
        method: "PUT",
        body: JSON.stringify({ note: input.value }),
      });
      li.replaceWith(createFavoriteItem({ ...favorite, ...updated }));
    } catch (err) {
      message.textContent = err.message;
      saveBtn.disabled = false;
    }
  });
}

async function removeFavorite(li, favorite, name) {
  if (!confirm(`Remove ${name} from your favorites?`)) return;

  try {
    await request(`/api/favorites/${favorite._id}`, { method: "DELETE" });
    li.remove();
    showStatus(listEl.children.length);
  } catch (err) {
    alert(`Could not remove favorite: ${err.message}`);
  }
}

function createFavoriteItem(favorite) {
  const { latest } = favorite;
  const name = latest?.restaurantName ?? `License ${favorite.licenseNo}`;

  const li = document.createElement("li");
  li.className = "result-card favorite";

  const header = document.createElement("div");
  header.className = "result-header";
  const link = document.createElement("a");
  link.href = `restaurant.html?license=${encodeURIComponent(favorite.licenseNo)}`;
  link.textContent = name;
  header.append(link);
  if (latest) header.append(createBadge(latest.result));
  li.append(header);

  if (latest) {
    const address = document.createElement("p");
    address.className = "result-address";
    address.textContent = `${latest.address}, ${latest.city}, MA ${latest.zip}`;

    const meta = document.createElement("p");
    meta.className = "result-meta";
    const typeLabel = createTypeLabel(latest.type);
    if (typeLabel) meta.append(typeLabel, document.createElement("br"));
    meta.append(`Last inspected ${formatDate(latest.date)}`);

    li.append(address, meta);
  }

  const body = document.createElement("div");
  body.className = "favorite-body";
  body.append(createNote(favorite));

  const actions = document.createElement("div");
  actions.className = "favorite-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "secondary";
  editBtn.textContent = favorite.note ? "Edit note" : "Add note";
  editBtn.addEventListener("click", () => startEdit(li, favorite));

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "danger";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => removeFavorite(li, favorite, name));

  actions.append(editBtn, removeBtn);
  body.append(actions);
  li.append(body);
  return li;
}

async function loadFavorites() {
  try {
    const favorites = await request("/api/favorites");
    showStatus(favorites.length);
    listEl.replaceChildren(...favorites.map(createFavoriteItem));
  } catch (err) {
    statusEl.textContent = `Could not load favorites: ${err.message}`;
  }
}

loadFavorites();
