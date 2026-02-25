const STORAGE_KEY = "flashdeck.v3";
const CATEGORY_ORDER = ["Linux", "DevOps", "Cloud", "Docker", "Kubernetes"];

const sampleLinuxCards = [
  {
    id: crypto.randomUUID(),
    question: "What does chmod 755 script.sh do?",
    answer:
      "Sets permissions to rwx for owner, and r-x for group and others. Owner can read/write/execute, others can read/execute.",
    tags: ["Linux", "Permissions", "chmod"]
  },
  {
    id: crypto.randomUUID(),
    question: "How do you list active services managed by systemd?",
    answer: "Use: systemctl list-units --type=service --state=running",
    tags: ["Linux", "systemctl", "Services"]
  },
  {
    id: crypto.randomUUID(),
    question: "Which command is used for secure remote access to a Linux server?",
    answer: "ssh user@hostname. You can specify a key with -i path/to/key.",
    tags: ["Linux", "SSH", "Networking"]
  },
  {
    id: crypto.randomUUID(),
    question: "What does ip addr show display?",
    answer: "It displays network interfaces and assigned IP addresses on the system.",
    tags: ["Linux", "Networking", "IP"]
  },
  {
    id: crypto.randomUUID(),
    question: "What does #!/bin/bash at the top of a script mean?",
    answer: "It is a shebang line that tells the system to execute the script with Bash.",
    tags: ["Linux", "Bash", "Scripting"]
  }
];

const state = {
  data: null,
  activeCategory: "Linux",
  view: "edit",
  search: "",
  selectedTags: new Set(),
  viewedInSession: new Set(),
  study: {
    category: "Linux",
    ids: [],
    index: 0
  }
};

const els = {
  appShell: document.getElementById("appShell"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  toggleCategories: document.getElementById("toggleCategories"),
  categoryList: document.getElementById("categoryList"),
  activeCategoryTitle: document.getElementById("activeCategoryTitle"),
  topSubtitle: document.getElementById("topSubtitle"),
  totalCardsStat: document.getElementById("totalCardsStat"),
  categoryCardsStat: document.getElementById("categoryCardsStat"),
  viewedCardsStat: document.getElementById("viewedCardsStat"),
  tagStats: document.getElementById("tagStats"),
  viewEditBtn: document.getElementById("viewEditBtn"),
  viewStudyBtn: document.getElementById("viewStudyBtn"),
  editView: document.getElementById("editView"),
  studyView: document.getElementById("studyView"),
  studyCategoryButtons: document.getElementById("studyCategoryButtons"),
  prevStudyCard: document.getElementById("prevStudyCard"),
  nextStudyCard: document.getElementById("nextStudyCard"),
  shuffleStudyCards: document.getElementById("shuffleStudyCards"),
  studyCounter: document.getElementById("studyCounter"),
  studyCardWrap: document.getElementById("studyCardWrap"),
  searchInput: document.getElementById("searchInput"),
  clearFilters: document.getElementById("clearFilters"),
  activeTagFilters: document.getElementById("activeTagFilters"),
  cardsGrid: document.getElementById("cardsGrid"),
  cardTemplate: document.getElementById("cardTemplate"),
  emptyState: document.getElementById("emptyState"),
  cardForm: document.getElementById("cardForm"),
  questionInput: document.getElementById("questionInput"),
  answerInput: document.getElementById("answerInput"),
  tagsInput: document.getElementById("tagsInput")
};

function storageLoad() {
  const fallback = {
    categories: {
      Linux: sampleLinuxCards,
      DevOps: [],
      Cloud: [],
      Docker: [],
      Kubernetes: []
    }
  };

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.categories) return fallback;
    CATEGORY_ORDER.forEach((name) => {
      if (!Array.isArray(parsed.categories[name])) parsed.categories[name] = [];
    });
    return parsed;
  } catch {
    return fallback;
  }
}

function storageSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function normalizeTags(tagString) {
  return [...new Set(tagString.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function hashColor(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 80%, 74%)`;
}

function getCategoryCards(category) {
  return state.data.categories[category] || [];
}

function getCurrentCards() {
  return getCategoryCards(state.activeCategory);
}

function getStudyPool() {
  if (state.study.category === "ALL") {
    return CATEGORY_ORDER.flatMap((category) => getCategoryCards(category));
  }
  return getCategoryCards(state.study.category);
}

function filteredCards() {
  const search = state.search.toLowerCase();
  return getCurrentCards().filter((card) => {
    const matchesSearch =
      !search ||
      card.question.toLowerCase().includes(search) ||
      card.answer.toLowerCase().includes(search);
    const matchesTags = [...state.selectedTags].every((tag) => card.tags.includes(tag));
    return matchesSearch && matchesTags;
  });
}

function ensureStudyDeck() {
  const pool = getStudyPool();
  const stillValid = state.study.ids.filter((id) => pool.some((card) => card.id === id));
  const missing = pool.filter((card) => !stillValid.includes(card.id)).map((card) => card.id);
  state.study.ids = [...stillValid, ...missing];

  if (!state.study.ids.length) state.study.index = 0;
  else if (state.study.index >= state.study.ids.length) state.study.index = state.study.ids.length - 1;
}

function createTagPill(tag, clickable = true) {
  const el = clickable ? document.createElement("button") : document.createElement("span");
  el.className = "tag-pill";
  el.textContent = tag;
  el.style.background = hashColor(tag);

  if (clickable) {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
      else state.selectedTags.add(tag);
      render();
    });
  }
  return el;
}

function renderCategoryList() {
  els.categoryList.innerHTML = "";
  CATEGORY_ORDER.forEach((category) => {
    const button = document.createElement("button");
    button.className = `category-btn ${state.activeCategory === category ? "active" : ""}`;
    button.innerHTML = `<span>${category}</span><strong>${getCategoryCards(category).length}</strong>`;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      render();
      if (window.innerWidth <= 980) els.sidebar.classList.remove("open");
    });
    els.categoryList.appendChild(button);
  });
}

function renderStudyCategoryButtons() {
  els.studyCategoryButtons.innerHTML = "";
  ["ALL", ...CATEGORY_ORDER].forEach((category) => {
    const button = document.createElement("button");
    button.className = `pill-btn ${state.study.category === category ? "active-view" : ""}`;
    button.textContent = category === "ALL" ? "All" : category;
    button.addEventListener("click", () => {
      state.study.category = category;
      state.study.ids = [];
      state.study.index = 0;
      ensureStudyDeck();
      renderStudyView();
    });
    els.studyCategoryButtons.appendChild(button);
  });
}

function renderFilters() {
  els.activeTagFilters.innerHTML = "";
  if (!state.selectedTags.size) {
    const none = document.createElement("span");
    none.className = "filter-pill";
    none.textContent = "None";
    els.activeTagFilters.appendChild(none);
    return;
  }

  [...state.selectedTags].forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "filter-pill";
    chip.textContent = `${tag} ✕`;
    chip.addEventListener("click", () => {
      state.selectedTags.delete(tag);
      render();
    });
    els.activeTagFilters.appendChild(chip);
  });
}

function renderStats() {
  const allCards = CATEGORY_ORDER.flatMap((category) => getCategoryCards(category));
  const activeCards = getCurrentCards();
  const tagCounts = {};

  activeCards.forEach((card) => {
    card.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  els.totalCardsStat.textContent = String(allCards.length);
  els.categoryCardsStat.textContent = String(activeCards.length);
  els.viewedCardsStat.textContent = String(state.viewedInSession.size);

  els.tagStats.innerHTML = "";
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      const pill = document.createElement("span");
      pill.className = "filter-pill";
      pill.textContent = `${tag}: ${count}`;
      els.tagStats.appendChild(pill);
    });
}

function enableInlineEdit(cardEl, card) {
  const front = cardEl.querySelector(".card-front");
  front.innerHTML = `
    <label>Question<textarea class="edit-field edit-question">${card.question}</textarea></label>
    <label>Answer<textarea class="edit-field edit-answer">${card.answer}</textarea></label>
    <label>Tags<input class="edit-field edit-tags" value="${card.tags.join(", ")}" /></label>
    <div class="card-actions">
      <button class="btn btn-compact save-edit">Save</button>
      <button class="btn btn-ghost btn-compact cancel-edit">Cancel</button>
    </div>
  `;

  front.querySelector(".save-edit").addEventListener("click", (event) => {
    event.stopPropagation();
    const q = front.querySelector(".edit-question").value.trim();
    const a = front.querySelector(".edit-answer").value.trim();
    const tags = normalizeTags(front.querySelector(".edit-tags").value);
    if (!q || !a) return;

    card.question = q;
    card.answer = a;
    card.tags = tags;
    storageSave();
    ensureStudyDeck();
    render();
  });

  front.querySelector(".cancel-edit").addEventListener("click", (event) => {
    event.stopPropagation();
    render();
  });
}

function createCardElement(card, options = {}) {
  const { readOnly = false, large = false } = options;
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);

  if (large) node.classList.add("study-large");

  const question = node.querySelector(".card-question");
  const answer = node.querySelector(".card-answer");
  const frontTags = node.querySelector(".card-front .tag-row");
  const backTags = node.querySelector(".card-back .tag-row");
  const deleteBtn = node.querySelector(".delete-btn");
  const editBtn = node.querySelector(".edit-btn");

  question.textContent = card.question;
  answer.textContent = card.answer;

  card.tags.forEach((tag) => {
    frontTags.appendChild(createTagPill(tag, !readOnly));
    backTags.appendChild(createTagPill(tag, false));
  });

  if (readOnly) {
    deleteBtn.remove();
    editBtn.remove();
  } else {
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const cards = getCurrentCards();
      const idx = cards.findIndex((c) => c.id === card.id);
      if (idx >= 0) cards.splice(idx, 1);
      storageSave();
      ensureStudyDeck();
      render();
    });

    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      enableInlineEdit(node, card);
    });
  }

  node.addEventListener("click", () => node.classList.toggle("flipped"));
  return node;
}

function renderCardGrid() {
  const cards = filteredCards();
  els.cardsGrid.innerHTML = "";
  cards.forEach((card) => els.cardsGrid.appendChild(createCardElement(card)));
  els.emptyState.classList.toggle("hidden", cards.length !== 0);
}

function getStudyCard() {
  if (!state.study.ids.length) return null;
  const id = state.study.ids[state.study.index];
  return getStudyPool().find((card) => card.id === id) || null;
}

function renderStudyView() {
  ensureStudyDeck();
  const card = getStudyCard();
  els.studyCardWrap.innerHTML = "";

  if (!card) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No cards available for this category yet.";
    els.studyCardWrap.appendChild(empty);
    els.studyCounter.textContent = "0 / 0";
    return;
  }

  state.viewedInSession.add(card.id);
  els.viewedCardsStat.textContent = String(state.viewedInSession.size);
  els.studyCounter.textContent = `${state.study.index + 1} / ${state.study.ids.length}`;
  els.studyCardWrap.appendChild(createCardElement(card, { readOnly: true, large: true }));
}

function renderViewMode() {
  const isEdit = state.view === "edit";
  els.editView.classList.toggle("hidden", !isEdit);
  els.studyView.classList.toggle("hidden", isEdit);
  els.sidebar.classList.toggle("hidden-study", !isEdit);
  els.appShell.classList.toggle("study-layout", !isEdit);
  els.viewEditBtn.classList.toggle("active-view", isEdit);
  els.viewStudyBtn.classList.toggle("active-view", !isEdit);
  els.activeCategoryTitle.textContent = isEdit ? state.activeCategory : "Study Mode";
  els.topSubtitle.textContent = isEdit ? "Modern flashcard dashboard" : "Focus mode";
}

function render() {
  renderCategoryList();
  renderStudyCategoryButtons();
  renderFilters();
  renderCardGrid();
  renderStudyView();
  renderViewMode();
  renderStats();
}

function shuffleStudyDeck() {
  ensureStudyDeck();
  for (let i = state.study.ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.study.ids[i], state.study.ids[j]] = [state.study.ids[j], state.study.ids[i]];
  }
  state.study.index = 0;
}

function bindEvents() {
  els.cardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = els.questionInput.value.trim();
    const answer = els.answerInput.value.trim();
    const tags = normalizeTags(els.tagsInput.value);
    if (!question || !answer) return;

    getCurrentCards().unshift({ id: crypto.randomUUID(), question, answer, tags });
    storageSave();
    ensureStudyDeck();
    els.cardForm.reset();
    render();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  els.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.selectedTags.clear();
    els.searchInput.value = "";
    render();
  });

  els.viewEditBtn.addEventListener("click", () => {
    state.view = "edit";
    render();
  });

  els.viewStudyBtn.addEventListener("click", () => {
    state.view = "study";
    ensureStudyDeck();
    render();
  });

  els.nextStudyCard.addEventListener("click", () => {
    ensureStudyDeck();
    if (!state.study.ids.length) return;
    state.study.index = (state.study.index + 1) % state.study.ids.length;
    renderStudyView();
  });

  els.prevStudyCard.addEventListener("click", () => {
    ensureStudyDeck();
    if (!state.study.ids.length) return;
    state.study.index = (state.study.index - 1 + state.study.ids.length) % state.study.ids.length;
    renderStudyView();
  });

  els.shuffleStudyCards.addEventListener("click", () => {
    shuffleStudyDeck();
    renderStudyView();
  });

  els.toggleCategories.addEventListener("click", () => {
    els.categoryList.classList.toggle("collapsed");
  });

  els.sidebarToggle.addEventListener("click", () => {
    els.sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 980) return;
    if (!els.sidebar.classList.contains("open")) return;
    if (els.sidebar.contains(event.target) || els.sidebarToggle.contains(event.target)) return;
    els.sidebar.classList.remove("open");
  });
}

function init() {
  state.data = storageLoad();
  ensureStudyDeck();
  bindEvents();
  render();
}

init();
