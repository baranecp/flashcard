// FlashDeck: Vanilla JS Flashcard Dashboard

const STORAGE_KEY = "flashdeck.v1";
const CATEGORY_ORDER = ["Linux", "DevOps", "Cloud", "Docker", "Kubernetes"];

const sampleLinuxCards = [
  {
    id: crypto.randomUUID(),
    question: "What does chmod 755 script.sh do?",
    answer: "Sets permissions to rwx for owner, and r-x for group and others. Owner can read/write/execute, others can read/execute.",
    tags: ["Linux", "Permissions", "chmod"],
    learned: false
  },
  {
    id: crypto.randomUUID(),
    question: "How do you list active services managed by systemd?",
    answer: "Use: systemctl list-units --type=service --state=running",
    tags: ["Linux", "systemctl", "Services"],
    learned: false
  },
  {
    id: crypto.randomUUID(),
    question: "Which command is used for secure remote access to a Linux server?",
    answer: "ssh user@hostname. You can specify a key with -i path/to/key.",
    tags: ["Linux", "SSH", "Networking"],
    learned: false
  },
  {
    id: crypto.randomUUID(),
    question: "What does the command ip addr show display?",
    answer: "It displays network interfaces and assigned IP addresses on the system.",
    tags: ["Linux", "Networking", "IP"],
    learned: false
  },
  {
    id: crypto.randomUUID(),
    question: "What does #!/bin/bash at the top of a script mean?",
    answer: "It's a shebang line telling the system to run the script using the Bash interpreter.",
    tags: ["Linux", "Bash", "Scripting"],
    learned: false
  }
];

const state = {
  data: null,
  activeCategory: "Linux",
  search: "",
  selectedTags: new Set(),
  studyMode: false,
  viewedInSession: new Set(),
  currentStudyCardId: null
};

const els = {
  categoryList: document.getElementById("categoryList"),
  toggleCategories: document.getElementById("toggleCategories"),
  activeCategoryTitle: document.getElementById("activeCategoryTitle"),
  totalCardsStat: document.getElementById("totalCardsStat"),
  categoryCardsStat: document.getElementById("categoryCardsStat"),
  viewedCardsStat: document.getElementById("viewedCardsStat"),
  learnedRatio: document.getElementById("learnedRatio"),
  learnedProgress: document.getElementById("learnedProgress"),
  tagStats: document.getElementById("tagStats"),
  studyModeToggle: document.getElementById("studyModeToggle"),
  nextStudyCard: document.getElementById("nextStudyCard"),
  studyPanel: document.getElementById("studyPanel"),
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
  tagsInput: document.getElementById("tagsInput"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle")
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
  for (let i = 0; i < text.length; i += 1) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 78%, 72%)`;
}

function getCurrentCards() {
  return state.data.categories[state.activeCategory] || [];
}

function filteredCards() {
  const search = state.search.toLowerCase();
  return getCurrentCards().filter((card) => {
    const matchesText =
      !search ||
      card.question.toLowerCase().includes(search) ||
      card.answer.toLowerCase().includes(search);

    const matchesTags = [...state.selectedTags].every((tag) => card.tags.includes(tag));
    return matchesText && matchesTags;
  });
}

function createTagPill(tag, interactive = true) {
  const tagEl = document.createElement("button");
  tagEl.className = "tag-pill";
  tagEl.textContent = tag;
  tagEl.style.background = hashColor(tag);
  if (!interactive) {
    tagEl.disabled = true;
    tagEl.style.cursor = "default";
  } else {
    tagEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
      else state.selectedTags.add(tag);
      render();
    });
  }
  return tagEl;
}

function renderCategories() {
  els.categoryList.innerHTML = "";
  CATEGORY_ORDER.forEach((category) => {
    const count = state.data.categories[category].length;
    const button = document.createElement("button");
    button.className = `category-btn ${state.activeCategory === category ? "active" : ""}`;
    button.innerHTML = `<span>${category}</span><strong>${count}</strong>`;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      state.currentStudyCardId = null;
      state.selectedTags.clear();
      render();
      if (window.innerWidth <= 980) els.sidebar.classList.remove("open");
    });
    els.categoryList.appendChild(button);
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
  const allCards = CATEGORY_ORDER.flatMap((category) => state.data.categories[category]);
  const activeCards = getCurrentCards();
  const learnedCount = activeCards.filter((card) => card.learned).length;
  const ratio = activeCards.length ? Math.round((learnedCount / activeCards.length) * 100) : 0;

  els.totalCardsStat.textContent = String(allCards.length);
  els.categoryCardsStat.textContent = String(activeCards.length);
  els.viewedCardsStat.textContent = String(state.viewedInSession.size);
  els.learnedRatio.textContent = `${ratio}%`;
  els.learnedProgress.style.width = `${ratio}%`;

  const tagCounts = {};
  activeCards.forEach((card) => {
    card.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  els.tagStats.innerHTML = "";
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      const chip = document.createElement("span");
      chip.className = "filter-pill";
      chip.textContent = `${tag}: ${count}`;
      els.tagStats.appendChild(chip);
    });
}

function enableInlineEdit(cardEl, card) {
  const front = cardEl.querySelector(".card-front");
  front.innerHTML = `
    <label>Question<textarea class="edit-field edit-question">${card.question}</textarea></label>
    <label>Answer<textarea class="edit-field edit-answer">${card.answer}</textarea></label>
    <label>Tags<input class="edit-field edit-tags" value="${card.tags.join(", ")}" /></label>
    <div class="card-actions">
      <button class="btn save-edit">Save</button>
      <button class="btn btn-ghost cancel-edit">Cancel</button>
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
    render();
  });

  front.querySelector(".cancel-edit").addEventListener("click", (event) => {
    event.stopPropagation();
    render();
  });
}

function createCardElement(card) {
  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  const question = node.querySelector(".card-question");
  const answer = node.querySelector(".card-answer");
  const tagRow = node.querySelector(".tag-row");
  const deleteBtn = node.querySelector(".delete-btn");
  const editBtn = node.querySelector(".edit-btn");
  const learnedCheckbox = node.querySelector(".learned-checkbox");

  question.textContent = card.question;
  answer.textContent = card.answer;
  learnedCheckbox.checked = !!card.learned;

  learnedCheckbox.addEventListener("click", (event) => {
    event.stopPropagation();
    card.learned = learnedCheckbox.checked;
    storageSave();
    renderStats();
  });

  card.tags.forEach((tag) => tagRow.appendChild(createTagPill(tag, true)));

  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const cards = getCurrentCards();
    const idx = cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) cards.splice(idx, 1);
    storageSave();
    render();
  });

  editBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    enableInlineEdit(node, card);
  });

  node.addEventListener("click", () => {
    node.classList.toggle("flipped");
  });

  return node;
}

function renderCardGrid() {
  const cards = filteredCards();
  els.cardsGrid.innerHTML = "";
  cards.forEach((card) => {
    els.cardsGrid.appendChild(createCardElement(card));
  });
  els.emptyState.classList.toggle("hidden", cards.length !== 0);
}

function randomCardFromFiltered() {
  const cards = filteredCards();
  if (!cards.length) return null;
  const pool = cards.filter((card) => card.id !== state.currentStudyCardId);
  const targetPool = pool.length ? pool : cards;
  return targetPool[Math.floor(Math.random() * targetPool.length)];
}

function renderStudyMode() {
  els.studyPanel.classList.toggle("hidden", !state.studyMode);
  els.studyModeToggle.textContent = `Study Mode: ${state.studyMode ? "On" : "Off"}`;

  if (!state.studyMode) return;

  let card = filteredCards().find((c) => c.id === state.currentStudyCardId);
  if (!card) {
    card = randomCardFromFiltered();
    state.currentStudyCardId = card?.id || null;
  }

  els.studyCardWrap.innerHTML = "";
  if (!card) {
    const empty = document.createElement("p");
    empty.textContent = "No card available for study mode with current filters.";
    empty.className = "empty";
    els.studyCardWrap.appendChild(empty);
    return;
  }

  state.viewedInSession.add(card.id);
  els.viewedCardsStat.textContent = String(state.viewedInSession.size);
  const node = createCardElement(card);
  node.style.maxWidth = "360px";
  els.studyCardWrap.appendChild(node);
}

function render() {
  els.activeCategoryTitle.textContent = state.activeCategory;
  renderCategories();
  renderFilters();
  renderCardGrid();
  renderStudyMode();
  renderStats();
}

function bindEvents() {
  els.cardForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const question = els.questionInput.value.trim();
    const answer = els.answerInput.value.trim();
    const tags = normalizeTags(els.tagsInput.value);
    if (!question || !answer) return;

    getCurrentCards().unshift({
      id: crypto.randomUUID(),
      question,
      answer,
      tags,
      learned: false
    });

    storageSave();
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

  els.studyModeToggle.addEventListener("click", () => {
    state.studyMode = !state.studyMode;
    state.currentStudyCardId = null;
    render();
  });

  els.nextStudyCard.addEventListener("click", () => {
    const card = randomCardFromFiltered();
    state.currentStudyCardId = card?.id || null;
    renderStudyMode();
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
  bindEvents();
  render();
}

init();
