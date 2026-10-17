const form = document.getElementById("review-form");
const formTitle = document.getElementById("review-form-title");
const submitBtn = document.getElementById("review-submit");
const cancelBtn = document.getElementById("review-cancel");
const messageEl = document.getElementById("review-message");
const statusEl = document.getElementById("reviews-status");
const listEl = document.getElementById("reviews");

const TOKEN_KEY = "foodsafe-review-token";

let licenseNo;
let editingId = null;

// There is no login, so this browser's random token marks which reviews it wrote
function getToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Review-Token": getToken(),
    },
  });
  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function createReviewItem(review) {
  const li = document.createElement("li");
  li.className = "result-card review";

  const header = document.createElement("div");
  header.className = "review-header";

  const author = document.createElement("strong");
  author.textContent = review.author;

  const stars = document.createElement("span");
  stars.className = "review-stars";
  stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  stars.title = `${review.rating} out of 5`;

  const date = document.createElement("span");
  date.className = "review-date";
  date.textContent = formatDate(review.createdAt);
  if (review.updatedAt !== review.createdAt) date.textContent += " (edited)";

  header.append(author, stars, date);

  const text = document.createElement("p");
  text.className = "review-text";
  text.textContent = review.text;

  li.append(header, text);

  if (review.canEdit) {
    const actions = document.createElement("div");
    actions.className = "review-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(review));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteReview(review));

    actions.append(editBtn, deleteBtn);
    li.append(actions);
  }
  return li;
}

async function loadReviews() {
  try {
    const reviews = await request(
      `/api/reviews?license=${encodeURIComponent(licenseNo)}`,
    );
    statusEl.textContent =
      reviews.length === 0
        ? "No reviews yet. Be the first to write one."
        : `${reviews.length} review${reviews.length === 1 ? "" : "s"}`;
    listEl.replaceChildren(...reviews.map(createReviewItem));
  } catch (err) {
    statusEl.textContent = `Could not load reviews: ${err.message}`;
  }
}

function startEdit(review) {
  editingId = review._id;
  form.elements.author.value = review.author;
  form.elements.rating.value = review.rating;
  form.elements.text.value = review.text;
  formTitle.textContent = "Edit your review";
  submitBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  messageEl.textContent = "";
  form.scrollIntoView({ behavior: "smooth" });
  form.elements.text.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Write a review";
  submitBtn.textContent = "Post review";
  cancelBtn.hidden = true;
}

async function deleteReview(review) {
  if (!confirm("Delete this review? This cannot be undone.")) return;

  try {
    await request(`/api/reviews/${review._id}`, { method: "DELETE" });
    if (editingId === review._id) resetForm();
    await loadReviews();
  } catch (err) {
    alert(`Could not delete review: ${err.message}`);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    licenseNo,
    author: form.elements.author.value,
    rating: Number(form.elements.rating.value),
    text: form.elements.text.value,
  };

  submitBtn.disabled = true;
  try {
    if (editingId) {
      await request(`/api/reviews/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      messageEl.textContent = "Review updated.";
    } else {
      await request("/api/reviews", {
        method: "POST",
        body: JSON.stringify(body),
      });
      messageEl.textContent = "Thanks! Your review is posted.";
    }
    resetForm();
    await loadReviews();
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

export function initReviews(license) {
  licenseNo = license;
  loadReviews();
}
