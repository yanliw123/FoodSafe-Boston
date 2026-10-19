import { request } from "./api.js";
import { createLocationPicker } from "./complaintMap.js";
import { fillTypeOptions } from "./complaintView.js";

const form = document.getElementById("complaint-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("complaint-submit");
const cancelBtn = document.getElementById("complaint-cancel");
const messageEl = document.getElementById("form-message");
const pickedEl = document.getElementById("picked-location");

let editingId = null;
let picked = null;

const picker = createLocationPicker(
  document.getElementById("picker-map"),
  (latLng) => {
    picked = latLng;
    showPicked();
  },
);

// yyyy-mm-dd in the browser's time zone, for date inputs
function toInputDate(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function showPicked() {
  pickedEl.textContent = picked
    ? `Marked at ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}. Click again to move it.`
    : "Click the map to mark where the restaurant is.";
}

function resetForm() {
  editingId = null;
  picked = null;
  form.reset();
  form.elements.date.value = toInputDate(new Date());
  picker.clear();
  showPicked();
  formTitle.textContent = "File a complaint";
  submitBtn.textContent = "File complaint";
  cancelBtn.hidden = true;
}

function startEdit(complaint) {
  editingId = complaint._id;
  for (const name of [
    "restaurantName",
    "address",
    "zip",
    "neighborhood",
    "type",
    "description",
  ]) {
    form.elements[name].value = complaint[name] ?? "";
  }
  form.elements.date.value = toInputDate(complaint.openedAt);

  const [lng, lat] = complaint.location.coordinates;
  picked = { lat, lng };
  picker.set(lat, lng);
  showPicked();

  formTitle.textContent = "Edit your complaint";
  submitBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  messageEl.textContent = "";
  form.scrollIntoView({ behavior: "smooth" });
}

// A restaurant page links here with ?restaurant=&address=&zip= filled in
function prefillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("restaurant")) return;
  form.elements.restaurantName.value = params.get("restaurant");
  form.elements.address.value = params.get("address") ?? "";
  form.elements.zip.value = params.get("zip") ?? "";
  form.scrollIntoView();
}

export function initComplaintForm({ onSaved }) {
  fillTypeOptions(form.elements.type);
  form.elements.date.max = toInputDate(new Date());
  resetForm();
  prefillFromUrl();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!picked) {
      messageEl.textContent = "Click the map to mark where the restaurant is.";
      return;
    }
    const body = {
      ...Object.fromEntries(new FormData(form)),
      lat: picked.lat,
      lng: picked.lng,
    };

    submitBtn.disabled = true;
    try {
      if (editingId) {
        await request(`/api/complaints/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        messageEl.textContent = "Complaint updated.";
      } else {
        await request("/api/complaints", {
          method: "POST",
          body: JSON.stringify(body),
        });
        messageEl.textContent = "Thanks! Your complaint is on the map.";
      }
      resetForm();
      onSaved();
    } catch (err) {
      messageEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener("click", () => {
    resetForm();
    messageEl.textContent = "";
  });

  return { startEdit };
}
