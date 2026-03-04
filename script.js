const STORAGE_KEY = "flashdeck.import.v1";

const state = {
  cards: [],
  studyIndex: 0,
  language: "en",
  translations: {}
};

const els = {
  languageButtons: document.getElementById("languageButtons"),
  fileInput: document.getElementById("fileInput"),
  importFileBtn: document.getElementById("importFileBtn"),
  clearDeckBtn: document.getElementById("clearDeckBtn"),
  importStatus: document.getElementById("importStatus"),
  studyCardWrap: document.getElementById("studyCardWrap"),
  translationInfo: document.getElementById("translationInfo"),
  studyCounter: document.getElementById("studyCounter"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  cardTemplate: document.getElementById("cardTemplate")
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards: state.cards, translations: state.translations }));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    state.translations = parsed.translations && typeof parsed.translations === "object" ? parsed.translations : {};
  } catch {
    state.cards = [];
    state.translations = {};
  }
}

function createLanguageButtons() {
  els.languageButtons.innerHTML = "";
  [
    { key: "en", label: "English" },
    { key: "sk", label: "Slovak" }
  ].forEach((lang) => {
    const btn = document.createElement("button");
    btn.className = `pill-btn ${state.language === lang.key ? "active" : ""}`;
    btn.textContent = lang.label;
    btn.addEventListener("click", () => {
      state.language = lang.key;
      createLanguageButtons();
      renderStudyCard();
    });
    els.languageButtons.appendChild(btn);
  });
}

function parseCardsFromText(text) {
  const lines = text.split(/\r?\n/);
  const cards = [];
  let currentQ = "";
  let currentA = "";

  const pushCard = () => {
    if (!currentQ.trim() || !currentA.trim()) return;
    cards.push({
      id: crypto.randomUUID(),
      question: currentQ.trim(),
      answer: currentA.trim(),
      language: "en"
    });
    currentQ = "";
    currentA = "";
  };

  lines.forEach((line) => {
    if (line.startsWith("Q:")) {
      pushCard();
      currentQ = line.slice(2).trim();
      return;
    }

    if (line.startsWith("A:")) {
      currentA = line.slice(2).trim();
      return;
    }

    if (!line.trim()) {
      pushCard();
      return;
    }

    if (currentA) currentA += ` ${line.trim()}`;
    else if (currentQ) currentQ += ` ${line.trim()}`;
  });

  pushCard();
  return cards;
}

function translationKey(cardId, targetLang, field) {
  return `${cardId}:${targetLang}:${field}`;
}

async function translateText(text, fromLang, toLang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("translation failed");
  const data = await response.json();
  return data?.responseData?.translatedText || text;
}

async function translatedCard(card) {
  if (state.language === card.language) {
    return { question: card.question, answer: card.answer, translated: false, failed: false };
  }

  const qKey = translationKey(card.id, state.language, "q");
  const aKey = translationKey(card.id, state.language, "a");
  if (state.translations[qKey] && state.translations[aKey]) {
    return {
      question: state.translations[qKey],
      answer: state.translations[aKey],
      translated: true,
      failed: false
    };
  }

  try {
    const [q, a] = await Promise.all([
      translateText(card.question, card.language, state.language),
      translateText(card.answer, card.language, state.language)
    ]);
    state.translations[qKey] = q;
    state.translations[aKey] = a;
    saveState();
    return { question: q, answer: a, translated: true, failed: false };
  } catch {
    return { question: card.question, answer: card.answer, translated: false, failed: true };
  }
}

function getCurrentCard() {
  if (!state.cards.length) return null;
  if (state.studyIndex >= state.cards.length) state.studyIndex = state.cards.length - 1;
  return state.cards[state.studyIndex];
}

async function renderStudyCard() {
  els.studyCardWrap.innerHTML = "";
  els.translationInfo.textContent = "";

  const card = getCurrentCard();
  if (!card) {
    els.studyCounter.textContent = "0 / 0";
    els.studyCardWrap.innerHTML = '<p class="status-line">No cards yet. Import a text file to begin.</p>';
    return;
  }

  els.studyCounter.textContent = `${state.studyIndex + 1} / ${state.cards.length}`;
  els.translationInfo.textContent = card.language === state.language ? "" : "Translating card...";

  const translated = await translatedCard(card);
  const stillCurrent = getCurrentCard();
  if (!stillCurrent || stillCurrent.id !== card.id) return;

  if (translated.failed) {
    els.translationInfo.textContent = "Translation unavailable right now. Showing original text.";
  } else if (translated.translated) {
    els.translationInfo.textContent = `Auto-translated to ${state.language === "sk" ? "Slovak" : "English"}.`;
  } else {
    els.translationInfo.textContent = "";
  }

  const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".card-question").textContent = translated.question;
  node.querySelector(".card-answer").textContent = translated.answer;
  const label = state.language === "sk" ? "SK" : "EN";
  node.querySelector(".lang-chip-front").textContent = label;
  node.querySelector(".lang-chip-back").textContent = label;
  node.addEventListener("click", () => node.classList.toggle("flipped"));
  els.studyCardWrap.appendChild(node);
}

function shuffleCards() {
  for (let i = state.cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]];
  }
  state.studyIndex = 0;
  saveState();
}

function bindEvents() {
  els.importFileBtn.addEventListener("click", async () => {
    const file = els.fileInput.files?.[0];
    if (!file) {
      els.importStatus.textContent = "Please choose a .txt file first.";
      return;
    }

    const text = await file.text();
    const parsedCards = parseCardsFromText(text);
    if (!parsedCards.length) {
      els.importStatus.textContent = "No Q:/A: pairs found in file.";
      return;
    }

    state.cards = parsedCards;
    state.studyIndex = 0;
    state.translations = {};
    saveState();
    els.importStatus.textContent = `Imported ${parsedCards.length} cards successfully.`;
    renderStudyCard();
  });

  els.clearDeckBtn.addEventListener("click", () => {
    state.cards = [];
    state.studyIndex = 0;
    state.translations = {};
    saveState();
    els.importStatus.textContent = "Deck cleared.";
    renderStudyCard();
  });

  els.nextBtn.addEventListener("click", () => {
    if (!state.cards.length) return;
    state.studyIndex = (state.studyIndex + 1) % state.cards.length;
    renderStudyCard();
  });

  els.prevBtn.addEventListener("click", () => {
    if (!state.cards.length) return;
    state.studyIndex = (state.studyIndex - 1 + state.cards.length) % state.cards.length;
    renderStudyCard();
  });

  els.shuffleBtn.addEventListener("click", () => {
    if (!state.cards.length) return;
    shuffleCards();
    renderStudyCard();
  });
}

function init() {
  loadState();
  createLanguageButtons();
  bindEvents();
  renderStudyCard();
}

init();
