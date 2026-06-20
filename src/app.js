import { knowledge } from "./data/knowledge.js";
import { levels } from "./data/levels.js";
import { handwritingModels } from "./data/handwritingModels.js";
import { questions } from "./data/questions.js";
import { dialogueOptionAudio } from "./data/dialogueOptionAudio.js";
import { audioService } from "./services/audio.js";
import { speechService } from "./services/speech.js";
import { loadSave, resetSave, saveGame } from "./services/storage.js";

const app = document.querySelector("#app");
const HANDWRITING_RETRY_MESSAGE = "差一点，慢慢写一遍哦。";
const AUTO_AUDIO_DELAY_MS = 950;
const AUTO_AUDIO_STUDY_DELAY_MS = 420;
const HANDWRITING_ADVANCE_DELAY_MS = 1050;
const HOME_BACK_MESSAGE = "这里就是首页啦。";
const MAX_QUESTION_RETRIES = 3;
const PETAL_PENALTY_AFTER_RETRIES = 5;
const WORD_REVIEW_ROUNDS = 2;
const AUTHOR_WECHAT_ID = "GL-94520";
const DAILY_GOAL = {
  answered: 8,
  correct: 5,
  cleared: 1,
};
const REVIEW_DIMENSIONS = [
  { id: "listening", label: "听", weaknessLabel: "听不出", hint: "声音、语速和大意" },
  { id: "speaking", label: "说", weaknessLabel: "说不出", hint: "跟读、回应和意图" },
  { id: "reading", label: "读", weaknessLabel: "读不懂", hint: "词句、短文和信息" },
  { id: "writing", label: "写", weaknessLabel: "写不对", hint: "输入、拼词和组句" },
  { id: "usage", label: "用", weaknessLabel: "不会用", hint: "句型、场景和回应" },
];
const REVIEW_DIMENSION_IDS = new Set(REVIEW_DIMENSIONS.map((item) => item.id));
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30];
const KANA_TEXT_PATTERN = /[\u3040-\u30ff]/;
const BASIC_HANDWRITING_KANA_IDS = new Set(Object.keys(handwritingModels));

const initialSave = sanitizeLoadedSave(loadSave());

let state = {
  route: "home",
  selectedLevelId: null,
  playSession: null,
  resetConfirmPending: false,
  backMessage: "",
  contactNotice: "",
  routeHistory: [],
  save: initialSave,
};

let lastRenderedRoute = null;

state.playSession = sanitizeSavedPlaySession(state.save.activeSession, { refreshToken: true, allowCleared: true });
state.selectedLevelId = state.playSession?.levelId || null;

syncAudioSettings();

ensureDailyState();

const tutorialSteps = [
  {
    eyebrow: "第一步",
    title: "日语的第一扇门：元音",
    body: "先记住 a、i、u、e、o。它们会对应平假名 あ、い、う、え、お。",
    focus: ["a", "i", "u", "e", "o"],
    focusType: "romaji-sequence",
    audioKey: "kana.a",
    audioSrc: "assets/audio/kana/a.wav",
  },
  {
    eyebrow: "第二步",
    title: "先听，再认形",
    body: "点击读音按钮，听到短短的 a 音时，把它和 あ 这个形状连起来。",
    focus: "あ",
    audioKey: "kana.a",
    audioSrc: "assets/audio/kana/a.wav",
  },
  {
    eyebrow: "第三步",
    title: "今天只点亮第一个音",
    body: "下一步开始练习 あ：先听、再写、再选择。",
    focus: { kana: "あ", romaji: "a" },
    focusType: "kana-reading",
    audioKey: "kana.a",
    audioSrc: "assets/audio/kana/a.wav",
  },
];

function isLevelCleared(levelId) {
  return state.save.clearedLevels.includes(levelId);
}

function isLevelUnlocked(level) {
  if (!level.requiredLevelId) return true;
  return isLevelCleared(level.requiredLevelId);
}

function getLevelQuestions(levelId) {
  if (levelId === "wrong-review-dynamic") return buildWrongReviewQuestions();
  if (isWeakReviewLevelId(levelId)) return buildDimensionReviewQuestions(getWeakReviewDimensionId(levelId));
  return questions.filter((question) => question.levelId === levelId);
}

function getReviewDimension(dimensionId) {
  return REVIEW_DIMENSIONS.find((item) => item.id === dimensionId) || REVIEW_DIMENSIONS[0];
}

function isWeakReviewLevelId(levelId) {
  return /^weak-review-(listening|speaking|reading|writing|usage)$/.test(levelId || "");
}

function getWeakReviewDimensionId(levelId) {
  const id = String(levelId || "").replace(/^weak-review-/, "");
  return REVIEW_DIMENSION_IDS.has(id) ? id : "listening";
}

function getQuestionKnowledgeItems(question) {
  return (question?.knowledgeIds || []).map((id) => knowledge.find((item) => item.id === id)).filter(Boolean);
}

function levelAllowsHandwriting(level) {
  const levelId = level?.id || "";
  if (/^level(?:-kata)?-[1-5]$/.test(levelId)) return true;
  return /^level-(?:hira|kata)-[a-z]+$/.test(levelId) && level?.newKnowledgeIds?.length === 1 && BASIC_HANDWRITING_KANA_IDS.has(level.newKnowledgeIds[0]);
}

function canUseHandwritingForItem(item) {
  return Boolean(getFrontendHandwritingModel(item?.id));
}

function getFrontendHandwritingModel(knowledgeId) {
  return BASIC_HANDWRITING_KANA_IDS.has(knowledgeId) ? handwritingModels[knowledgeId] : null;
}

function isHandwritingReviewEntry(entry) {
  return entry?.questionType === "handwriting-check";
}

function getReviewWrongQuestions() {
  return (state.save.wrongQuestions || []).filter((entry) => !isHandwritingReviewEntry(entry));
}

function sanitizeLoadedSave(save) {
  return {
    ...save,
    wrongQuestions: (save.wrongQuestions || []).filter((entry) => !isHandwritingReviewEntry(entry)),
  };
}

function getQuestionMasteryDimension(question) {
  const questionType = question?.questionType || "";
  const items = getQuestionKnowledgeItems(question);
  if (isSpeechQuestion(question) || questionType === "shadowing-repeat" || questionType.startsWith("speech")) return "speaking";
  if (["handwriting-check", "romaji-input", "kana-input", "word-spell"].includes(questionType)) return "writing";
  if (questionType.startsWith("audio-to") || questionType === "kana-to-sound") return "listening";
  if (questionType.startsWith("reading") || items.some((item) => item.type === "reading")) return "reading";
  if (questionType.startsWith("dialogue") || questionType === "sentence-scenario" || questionType === "sentence-fill") return "usage";
  if (questionType.startsWith("sentence") || items.some((item) => item.type === "sentence" || item.type === "grammar")) return "usage";
  if (questionType.includes("meaning") || questionType.includes("image") || questionType.includes("word")) return "reading";
  return "usage";
}

function getMasteryDimensionRecord(record = {}, dimensionId) {
  return (
    record.dimensions?.[dimensionId] || {
      level: record.level || 0,
      correctCount: 0,
      wrongCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      reviewIntervalDays: 0,
      reviewStreak: 0,
    }
  );
}

function getReviewIntervalDaysForStreak(streak) {
  return REVIEW_INTERVAL_DAYS[Math.min(Math.max(streak, 1), REVIEW_INTERVAL_DAYS.length) - 1] || REVIEW_INTERVAL_DAYS[0];
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function addReviewDays(reviewedAt, days) {
  return new Date(toTime(reviewedAt) + days * DAY_MS).toISOString();
}

function getReviewSchedule(record = {}, nowMs = Date.now()) {
  const nextMs = toTime(record.nextReviewAt);
  const lastMs = toTime(record.lastReviewedAt);
  const dueMs = nextMs || lastMs || 0;
  const overdueDays = dueMs ? Math.max(0, Math.floor((nowMs - dueMs) / DAY_MS)) : 0;
  return {
    nextReviewAt: record.nextReviewAt || null,
    reviewIntervalDays: Number(record.reviewIntervalDays || 0),
    reviewStreak: Number(record.reviewStreak || 0),
    isDue: !dueMs || dueMs <= nowMs,
    overdueDays,
    dueMs,
  };
}

function updateMasteryDimensionRecord(record = {}, dimensionId, isCorrect, reviewedAt) {
  const current = getMasteryDimensionRecord(record, dimensionId);
  const reviewStreak = isCorrect ? (current.reviewStreak || 0) + 1 : 0;
  const reviewIntervalDays = isCorrect ? getReviewIntervalDaysForStreak(reviewStreak) : 0;
  return {
    ...current,
    level: Math.max(0, Math.min(5, (current.level || 0) + (isCorrect ? 1 : -1))),
    correctCount: (current.correctCount || 0) + (isCorrect ? 1 : 0),
    wrongCount: (current.wrongCount || 0) + (isCorrect ? 0 : 1),
    lastReviewedAt: reviewedAt,
    nextReviewAt: isCorrect ? addReviewDays(reviewedAt, reviewIntervalDays) : reviewedAt,
    reviewIntervalDays,
    reviewStreak,
  };
}

function getDimensionReviewPriority(record = {}, dimensionId, nowMs = Date.now()) {
  const dimensionRecord = getMasteryDimensionRecord(record, dimensionId);
  const schedule = getReviewSchedule(dimensionRecord, nowMs);
  const level = dimensionRecord.level || 0;
  const correctCount = dimensionRecord.correctCount || 0;
  const wrongCount = dimensionRecord.wrongCount || 0;
  return {
    isDue: schedule.isDue,
    overdueDays: schedule.overdueDays,
    score:
      (schedule.isDue ? -24 : 12) -
      schedule.overdueDays * 2 +
      level * 8 +
      correctCount -
      wrongCount * 7 -
      (dimensionRecord.reviewStreak || 0) * 2,
  };
}

function getMeaningOptions(item, types = [item?.type].filter(Boolean), limit = 5) {
  const options = knowledge
    .filter((entry) => types.includes(entry.type) && entry.level === item.level && entry.chinese)
    .map((entry) => entry.chinese)
    .filter((value, index, source) => value && source.indexOf(value) === index);
  return [item.chinese, ...options.filter((value) => value !== item.chinese)].slice(0, limit);
}

function buildWordSpellReviewQuestion(levelId, item, index) {
  const chunks = Array.from(item.kana || item.japanese || "");
  return {
    id: `q-${levelId}-spell-${item.id}-${index}`,
    levelId,
    questionType: "word-spell",
    knowledgeIds: [item.id],
    questionText: "拼出这个词。",
    prompt: item.chinese,
    options: chunks,
    chunks,
    correctAnswer: chunks.join("|"),
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  };
}

function buildSentenceOrderReviewQuestion(levelId, item, index) {
  const source = String(item.kana || item.japanese || "").trim();
  const chunks = source.includes(" ") ? source.split(/\s+/).filter(Boolean) : Array.from(source).filter((char) => char.trim());
  return {
    id: `q-${levelId}-order-${item.id}-${index}`,
    levelId,
    questionType: "sentence-order",
    knowledgeIds: [item.id],
    questionText: "把句子排好。",
    prompt: item.chinese,
    options: chunks,
    chunks,
    correctAnswer: chunks.join("|"),
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  };
}

function buildKanaWritingReviewQuestion(levelId, item, index) {
  return {
    id: `q-${levelId}-type-${item.id}-${index}`,
    levelId,
    questionType: "romaji-input",
    knowledgeIds: [item.id],
    questionText: "输入这个假名的读音。",
    prompt: item.kana,
    options: [],
    correctAnswer: item.romaji,
    acceptedAnswers: [item.romaji],
    difficulty: 4,
    isPreview: false,
  };
}

function buildMeaningReviewQuestion(levelId, item, index, questionType = "word-to-meaning") {
  const types =
    item.type === "kanji"
      ? ["kanji"]
      : item.type === "word"
        ? ["word"]
        : ["sentence", "reading", "dialogue"].includes(item.type)
          ? [item.type]
          : ["sentence", "reading", "dialogue"];
  return {
    id: `q-${levelId}-meaning-${item.id}-${index}`,
    levelId,
    questionType,
    knowledgeIds: [item.id],
    questionText: item.type === "word" ? "看词语，选意思。" : item.type === "kanji" ? "看汉字，选意思。" : "看内容，选意思。",
    prompt: item.japanese || item.kana || item.readingHint || item.chinese,
    audioKey: item.audioKey,
    audioSrc: item.audioSrc || "",
    options: getMeaningOptions(item, types, 4),
    correctAnswer: item.chinese,
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  };
}

function buildListeningReviewQuestion(levelId, item, index) {
  const base = {
    id: `q-${levelId}-listen-${item.id}-${index}`,
    levelId,
    knowledgeIds: [item.id],
    audioKey: item.audioKey,
    audioSrc: item.audioSrc || "",
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  };
  if (item.type === "kana") {
    const options = knowledge
      .filter((entry) => entry.type === "kana" && entry.script === item.script && entry.row === item.row)
      .map((entry) => entry.kana);
    return {
      ...base,
      questionType: "audio-to-kana-review",
      questionText: "听声音，选假名。",
      options: [item.kana, ...options.filter((value) => value !== item.kana)].slice(0, Math.max(3, Math.min(options.length, 5))),
      correctAnswer: item.kana,
    };
  }
  if (item.type === "word") {
    const options = knowledge
      .filter((entry) => entry.type === "word" && !entry.preview)
      .map((entry) => entry.kana)
      .filter((value, optionIndex, source) => source.indexOf(value) === optionIndex);
    return {
      ...base,
      questionType: "audio-to-word",
      questionText: "听声音，选词语。",
      options: [item.kana, ...options.filter((value) => value !== item.kana)].slice(0, 5),
      correctAnswer: item.kana,
    };
  }
  return {
    ...base,
    questionType: item.type === "dialogue" ? "audio-to-dialogue-meaning" : "audio-to-sentence-meaning",
    questionText: item.type === "dialogue" ? "听对话，选大意。" : "听内容，选意思。",
    options: getMeaningOptions(item, ["sentence", "reading", "dialogue"].includes(item.type) ? [item.type] : ["sentence"], 4),
    correctAnswer: item.chinese,
  };
}

function buildSpeakingReviewQuestion(levelId, item, index) {
  const spokenText = item.kana || item.japanese || item.readingHint || "";
  return {
    id: `q-${levelId}-speak-${item.id}-${index}`,
    levelId,
    questionType: item.type === "kana" ? "speech-kana" : item.type === "word" || item.type === "kanji" ? "speech-word" : "speech-sentence",
    knowledgeIds: [item.id],
    questionText: "读一遍。",
    prompt: spokenText,
    audioKey: item.audioKey,
    audioSrc: item.audioSrc || "",
    speechTarget: spokenText,
    speechHint: item.chinese || item.readingHint || "",
    options: [],
    correctAnswer: spokenText,
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  };
}

function buildReviewQuestionsForItem(item, index, levelId = "wrong-review-dynamic", dimensionId = null) {
  if (!item) return [];
  if (dimensionId === "listening") return [buildListeningReviewQuestion(levelId, item, index)];
  if (dimensionId === "speaking") return [buildSpeakingReviewQuestion(levelId, item, index)];
  if (dimensionId === "reading") return [buildMeaningReviewQuestion(levelId, item, index, item.type === "word" || item.type === "kanji" ? "word-to-meaning" : "reading-comprehension")];
  if (dimensionId === "writing") {
    if (item.type === "kana") return [buildKanaWritingReviewQuestion(levelId, item, index)];
    if (item.type === "word") return [buildWordSpellReviewQuestion(levelId, item, index)];
    if (item.type === "sentence") return [buildSentenceOrderReviewQuestion(levelId, item, index)];
    return [buildMeaningReviewQuestion(levelId, item, index)];
  }
  if (dimensionId === "usage") {
    if (item.type === "sentence") return [buildSentenceOrderReviewQuestion(levelId, item, index)];
    return [buildMeaningReviewQuestion(levelId, item, index)];
  }

  if (item.type === "word") return [buildListeningReviewQuestion(levelId, item, index)];
  if (["sentence", "reading", "dialogue"].includes(item.type)) return [buildMeaningReviewQuestion(levelId, item, index, item.type === "sentence" ? "sentence-to-meaning" : "reading-comprehension")];

  const sameScriptItems = knowledge
    .filter((entry) => entry.type === "kana" && entry.script === item.script && entry.row === item.row)
    .map((entry) => [entry.romaji, entry.kana]);
  const pairedScript = item.script === "hiragana" ? "katakana" : "hiragana";
  const pairedItem = knowledge.find((entry) => entry.type === "kana" && entry.script === pairedScript && entry.romaji === item.romaji);
  const options = sameScriptItems.length ? sameScriptItems.map(([, kana]) => kana) : [item.kana];
  const baseQuestions = [
    {
      ...buildListeningReviewQuestion(levelId, item, index),
      id: `q-${levelId}-audio-${item.id}-${index}`,
    },
    {
      id: `q-${levelId}-recall-${item.id}-${index}`,
      levelId,
      questionType: "kana-to-sound",
      knowledgeIds: [item.id],
      questionText: "看假名，选读音。",
      prompt: item.kana,
      options: [item.romaji, ...sameScriptItems.map(([romaji]) => romaji).filter((romaji) => romaji !== item.romaji)].slice(
        0,
        Math.max(3, Math.min(sameScriptItems.length, 5)),
      ),
      correctAnswer: item.romaji,
      difficulty: 4,
      isPreview: false,
    },
  ];
  return baseQuestions;
}

function getWeakReviewKnowledgeIds(excludedIds = new Set(), limit = 12) {
  return Object.entries(state.save.mastery || {})
    .filter(([knowledgeId, record]) => {
      if (excludedIds.has(knowledgeId)) return false;
      if (!knowledge.find((item) => item.id === knowledgeId)) return false;
      const attempts = (record.correctCount || 0) + (record.wrongCount || 0);
      return attempts > 0 && (record.level || 0) <= 1;
    })
    .map(([knowledgeId, record]) => ({
      knowledgeId,
      score: (record.level || 0) * 8 + (record.correctCount || 0) - (record.wrongCount || 0) * 5,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.knowledgeId);
}

function getWrongReviewKnowledgeIds(limit = 12) {
  const wrongKnowledgeIds = [...new Set(getReviewWrongQuestions().flatMap((item) => item.knowledgeIds || []))].slice(0, 12);
  const weakKnowledgeIds = getWeakReviewKnowledgeIds(new Set(wrongKnowledgeIds), Math.max(0, limit - wrongKnowledgeIds.length));
  return [...wrongKnowledgeIds, ...weakKnowledgeIds].slice(0, limit);
}

function getWeakReviewKnowledgeIdsForDimension(dimensionId, excludedIds = new Set(), limit = 12) {
  const nowMs = Date.now();
  return Object.entries(state.save.mastery || {})
    .filter(([knowledgeId, record]) => {
      if (excludedIds.has(knowledgeId)) return false;
      if (!knowledge.find((item) => item.id === knowledgeId)) return false;
      const dimensionRecord = getMasteryDimensionRecord(record, dimensionId);
      const attempts = (dimensionRecord.correctCount || 0) + (dimensionRecord.wrongCount || 0);
      const priority = getDimensionReviewPriority(record, dimensionId, nowMs);
      const isWeak = (dimensionRecord.level || 0) <= 1 || (dimensionRecord.wrongCount || 0) > (dimensionRecord.correctCount || 0);
      return attempts > 0 && (priority.isDue || isWeak);
    })
    .map(([knowledgeId, record]) => {
      const priority = getDimensionReviewPriority(record, dimensionId, nowMs);
      return {
        knowledgeId,
        score: priority.score,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.knowledgeId);
}

function getDimensionReviewKnowledgeIds(dimensionId, limit = 12) {
  const wrongKnowledgeIds = [
    ...new Set(
      getReviewWrongQuestions()
        .filter((entry) => (entry.reviewDimension || getQuestionMasteryDimension(entry)) === dimensionId)
        .flatMap((entry) => entry.knowledgeIds || []),
    ),
  ].slice(0, limit);
  const weakKnowledgeIds = getWeakReviewKnowledgeIdsForDimension(dimensionId, new Set(wrongKnowledgeIds), Math.max(0, limit - wrongKnowledgeIds.length));
  return [...wrongKnowledgeIds, ...weakKnowledgeIds].slice(0, limit);
}

function buildWrongReviewQuestions() {
  return getWrongReviewKnowledgeIds()
    .map((knowledgeId, index) => knowledge.find((item) => item.id === knowledgeId))
    .filter(Boolean)
    .flatMap((item, index) => buildReviewQuestionsForItem(item, index));
}

function buildDimensionReviewQuestions(dimensionId) {
  const levelId = `weak-review-${dimensionId}`;
  return getDimensionReviewKnowledgeIds(dimensionId)
    .map((knowledgeId) => knowledge.find((item) => item.id === knowledgeId))
    .filter(Boolean)
    .flatMap((item, index) => buildReviewQuestionsForItem(item, index, levelId, dimensionId));
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isSameOrder(first, second) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

function shuffleItemsAvoidingOrder(items, blockedOrders = []) {
  const source = [...items];
  if (source.length <= 2) {
    const reversed = [...source].reverse();
    return isSameOrder(reversed, source) ? source : reversed;
  }

  let bestItems = shuffleItems(source);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nextItems = shuffleItems(source);
    if (!blockedOrders.some((blocked) => isSameOrder(nextItems, blocked))) return nextItems;
    bestItems = nextItems;
  }

  const rotated = source.slice(1).concat(source[0]);
  return blockedOrders.some((blocked) => isSameOrder(rotated, blocked)) ? bestItems : rotated;
}

function shuffleQuestionIds(questionIds) {
  return shuffleItemsAvoidingOrder(questionIds, [questionIds]);
}

function buildPairOptionOrder(pairs) {
  const leftSource = pairs.map((pair) => pair.left);
  const rightSource = pairs.map((pair) => pair.right);
  const rightByLeft = new Map(pairs.map((pair) => [pair.left, pair.right]));
  const left = shuffleItemsAvoidingOrder(leftSource, [leftSource]);
  const isSolvedByPosition = (rightItems) => rightItems.some((right, index) => rightByLeft.get(left[index]) === right);

  let bestRight = shuffleItemsAvoidingOrder(rightSource, [rightSource]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const nextRight = shuffleItemsAvoidingOrder(rightSource, [rightSource, bestRight]);
    if (!isSolvedByPosition(nextRight)) {
      return { left, right: nextRight };
    }
    bestRight = nextRight;
  }

  for (let shift = 1; shift < rightSource.length; shift += 1) {
    const rotated = rightSource.slice(shift).concat(rightSource.slice(0, shift));
    if (!isSolvedByPosition(rotated)) return { left, right: rotated };
  }

  return { left, right: bestRight };
}

function getEffectiveReviewRounds(level) {
  if (level?.puzzleMode === "final-review-gate" && /^(vowel-a-row-review|row-[a-z]+-review)$/.test(level.memoryRule?.groupId || "")) return 1;
  if (level?.puzzleMode === "final-review-gate") return 3;
  if (level?.puzzleMode === "memory-review-gate" && /^(hira|kata)-/.test(level.memoryRule?.groupId || "")) return 4;
  return 1;
}

function getWeakKnowledgeIdsForLevel(level, limit = 10) {
  if (!level?.allowedKnowledgeIds?.length) return [];
  const allowed = new Set(level.allowedKnowledgeIds);
  const wrongItems = getReviewWrongQuestions()
    .filter((entry) => (entry.knowledgeIds || []).some((knowledgeId) => allowed.has(knowledgeId)))
    .flatMap((entry) =>
      (entry.knowledgeIds || []).map((knowledgeId) => ({
        knowledgeId,
        score: -30 - (entry.wrongCount || 0) * 6 + (entry.correctStreak || 0) * 5,
      })),
    );
  const weakMasteryItems = Object.entries(state.save.mastery || {})
    .filter(([knowledgeId]) => allowed.has(knowledgeId))
    .map(([knowledgeId, record]) => ({
      knowledgeId,
      score: (record.level || 0) * 6 + (record.correctCount || 0) - (record.wrongCount || 0) * 5,
    }))
    .filter((entry) => entry.score <= 16);
  const bestByKnowledge = new Map();
  for (const entry of [...wrongItems, ...weakMasteryItems]) {
    if (!bestByKnowledge.has(entry.knowledgeId) || entry.score < bestByKnowledge.get(entry.knowledgeId)) {
      bestByKnowledge.set(entry.knowledgeId, entry.score);
    }
  }
  return [...bestByKnowledge.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([knowledgeId]) => knowledgeId);
}

function buildQuestionQueue(levelId) {
  const level = levels.find((item) => item.id === levelId);
  const questionIds = getLevelQuestions(levelId).map((question) => question.id);
  if (levelId === "wrong-review-dynamic") return questionIds;
  const rounds = getEffectiveReviewRounds(level);
  if (rounds <= 1) return shuffleQuestionIds(questionIds);

  return Array.from({ length: rounds }).flatMap(() => shuffleQuestionIds(questionIds));
}

function getQuestionQueueCounts(questionIds) {
  const counts = new Map();
  for (const id of questionIds || []) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

function getExpectedQuestionQueueCounts(levelId) {
  const level = getLevelById(levelId);
  const questionIds = getLevelQuestions(levelId).map((question) => question.id);
  const rounds = levelId === "wrong-review-dynamic" ? 1 : getEffectiveReviewRounds(level);
  const counts = new Map();
  for (const id of questionIds) counts.set(id, Math.max(1, rounds));
  return counts;
}

function hasCurrentQuestionQueueShape(levelId, questionQueue) {
  if (!Array.isArray(questionQueue) || !questionQueue.length) return false;
  const expectedCounts = getExpectedQuestionQueueCounts(levelId);
  const actualCounts = getQuestionQueueCounts(questionQueue);
  if (actualCounts.size !== expectedCounts.size) return false;
  for (const [id, expectedCount] of expectedCounts.entries()) {
    if (actualCounts.get(id) !== expectedCount) return false;
  }
  return true;
}

function sanitizeQuestionQueueForLevel(levelId, savedQuestionQueue = []) {
  const currentQuestionIds = new Set(getLevelQuestions(levelId).map((question) => question.id));
  const filteredQueue = Array.isArray(savedQuestionQueue) ? savedQuestionQueue.filter((id) => currentQuestionIds.has(id)) : [];
  if (hasCurrentQuestionQueueShape(levelId, filteredQueue)) return filteredQueue;
  return buildQuestionQueue(levelId);
}

function levelUsesHandwriting(level) {
  return Boolean(levelAllowsHandwriting(level) && level?.newKnowledgeIds.some((id) => canUseHandwritingForItem(knowledge.find((item) => item.id === id))));
}

function sessionUsesHandwriting(level, session, focusKnowledge) {
  if (session?.remedialMode === "kana") {
    return Boolean(levelAllowsHandwriting(level) && canUseHandwritingForItem(focusKnowledge));
  }
  return levelUsesHandwriting(level);
}

function getRemedialFocusKnowledge(session) {
  if (!session?.remedialKnowledgeId) return null;
  return knowledge.find((item) => item.id === session.remedialKnowledgeId) || null;
}

function getRestartedQuizSession(session, levelId) {
  const questionQueue = buildQuestionQueue(levelId);
  return {
    ...session,
    levelId,
    remedialMode: null,
    remedialKnowledgeId: null,
    studySeen: true,
    practiceSeen: true,
    handwritingDemoSeen: true,
    handwritingTraceDone: true,
    handwritingDone: true,
    wordReviewSeen: true,
    wordReviewRound: 0,
    wordReviewIndex: 0,
    readyForQuiz: true,
    questionIndex: 0,
    correctCount: 0,
    answered: false,
    failed: false,
    autoPlayedQuestionId: null,
    selectedAnswer: null,
    selectedPairLeft: null,
    pairWrong: null,
    pairMatches: [],
    sentenceOrder: [],
    typedAnswer: "",
    speechRecording: false,
    speechRecorded: false,
    speechPassed: false,
    speechDurationMs: 0,
    speechTranscript: "",
    speechEngine: "",
    questionWrongAttempts: 0,
    levelWrongAttempts: 0,
    feedback: "",
    celebration: null,
    autoAdvance: false,
    questionQueue,
    optionQueue: buildOptionQueue(levelId, questionQueue),
  };
}

function getSessionFocusKnowledge(level, session, currentQuestion = null) {
  return (
    getRemedialFocusKnowledge(session) ||
    knowledge.find((item) => item.id === currentQuestion?.knowledgeIds?.[0]) ||
    knowledge.find((item) => item.id === level?.newKnowledgeIds?.[0]) ||
    null
  );
}

function shuffleOptionsForQuestion(question, previousCorrectIndex = -1) {
  const sourceOptions = [...new Set(question.options || [])];
  if (sourceOptions.length <= 1) return sourceOptions;

  let bestOptions = shuffleItemsAvoidingOrder(sourceOptions, [sourceOptions]);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const nextOptions = shuffleItemsAvoidingOrder(sourceOptions, [sourceOptions, bestOptions]);
    const correctIndex = nextOptions.indexOf(question.correctAnswer);
    if (correctIndex !== previousCorrectIndex && !isSameOrder(nextOptions, sourceOptions)) return nextOptions;
    bestOptions = nextOptions;
  }

  return bestOptions;
}

function buildOptionQueue(levelId, questionQueue = null) {
  const level = levels.find((item) => item.id === levelId);
  const queue = questionQueue || buildQuestionQueue(levelId);
  if (getEffectiveReviewRounds(level) > 1) {
    return Object.fromEntries(
      queue.map((questionId, index) => {
        const question = questions.find((item) => item.id === questionId);
        const queueKey = `${questionId}#${index}`;
        if (!question) return [queueKey, []];
        if (question.questionType === "pair-match") {
          const pairs = question.pairs || [];
          return [queueKey, buildPairOptionOrder(pairs)];
        }
        if (question.questionType === "handwriting-check") return [queueKey, []];
        return [queueKey, shuffleOptionsForQuestion(question)];
      }),
    );
  }

  let previousCorrectIndex = -1;
  return Object.fromEntries(
    getLevelQuestions(levelId).map((question) => {
      if (question.questionType === "pair-match") {
        const pairs = question.pairs || [];
        return [question.id, buildPairOptionOrder(pairs)];
      }
      if (question.questionType === "handwriting-check") return [question.id, []];

      const options = shuffleOptionsForQuestion(question, previousCorrectIndex);
      previousCorrectIndex = options.indexOf(question.correctAnswer);
      return [question.id, options];
    }),
  );
}

function getSessionQuestions(session) {
  const baseQuestions = getLevelQuestions(session?.levelId);
  if (!session?.questionQueue?.length) return baseQuestions;

  const questionById = new Map(baseQuestions.map((question) => [question.id, question]));
  const queuedQuestions = session.questionQueue.map((id) => questionById.get(id)).filter(Boolean);
  return queuedQuestions.length ? queuedQuestions : baseQuestions;
}

function getLevelById(levelId) {
  if (levelId === "wrong-review-dynamic") {
    return {
      id: "wrong-review-dynamic",
      title: "错题专练",
      subtitle: "只练容易错的内容",
      type: "review",
      statusLabel: "错题",
      requiredLevelId: null,
      allowedKnowledgeIds: getWrongReviewKnowledgeIds(),
      newKnowledgeIds: [],
      puzzleMode: "memory-review-gate",
      reward: { coins: 0, exp: 0, cards: [] },
    };
  }
  if (isWeakReviewLevelId(levelId)) {
    const dimension = getReviewDimension(getWeakReviewDimensionId(levelId));
    return {
      id: levelId,
      title: `${dimension.weaknessLabel}专练`,
      subtitle: dimension.hint,
      type: "review",
      statusLabel: dimension.label,
      requiredLevelId: null,
      allowedKnowledgeIds: getDimensionReviewKnowledgeIds(dimension.id),
      newKnowledgeIds: [],
      puzzleMode: "memory-review-gate",
      reward: { coins: 0, exp: 0, cards: [] },
    };
  }
  return levels.find((item) => item.id === levelId);
}

function startWrongReview() {
  const levelId = "wrong-review-dynamic";
  const questionQueue = buildQuestionQueue(levelId);
  state = {
    ...state,
    route: "puzzle",
    selectedLevelId: levelId,
    playSession: {
      ...createPlaySession(levelId),
      levelId,
      studySeen: true,
      practiceSeen: true,
      handwritingDemoSeen: true,
      handwritingTraceDone: true,
      handwritingDone: true,
      readyForQuiz: true,
      wordReviewSeen: true,
      questionQueue,
      optionQueue: buildOptionQueue(levelId, questionQueue),
    },
    backMessage: "",
    routeHistory: [...state.routeHistory, { route: state.route, selectedLevelId: state.selectedLevelId }],
  };
  render();
}

function startDimensionReview(dimensionId) {
  const levelId = `weak-review-${dimensionId}`;
  if (!isWeakReviewLevelId(levelId)) return;
  const questionQueue = buildQuestionQueue(levelId);
  if (!questionQueue.length) return;
  state = {
    ...state,
    route: "puzzle",
    selectedLevelId: levelId,
    playSession: {
      ...createPlaySession(levelId),
      levelId,
      studySeen: true,
      practiceSeen: true,
      handwritingDemoSeen: true,
      handwritingTraceDone: true,
      handwritingDone: true,
      readyForQuiz: true,
      wordReviewSeen: true,
      questionQueue,
      optionQueue: buildOptionQueue(levelId, questionQueue),
    },
    backMessage: "",
    routeHistory: [...state.routeHistory, { route: state.route, selectedLevelId: state.selectedLevelId }],
  };
  render();
}

function getSessionQuestionKey(session, question) {
  if (!question) return "";
  const queuedId = session?.questionQueue?.[session.questionIndex];
  if (queuedId === question.id) return `${question.id}#${session.questionIndex}`;
  return question.id;
}

function getSessionOptions(session, question) {
  if (!question) return [];
  const queuedOptions = session?.optionQueue?.[getSessionQuestionKey(session, question)] || session?.optionQueue?.[question.id];
  if (Array.isArray(queuedOptions) && queuedOptions.length === question.options.length) return queuedOptions;
  return question.options || [];
}

function levelNeedsWordReview(level) {
  if (!level?.id || level.id === "wrong-review-dynamic") return false;
  return (
    level.puzzleMode === "word-review-gate" &&
    getReviewWordItems(level).length > 0 &&
    getLevelQuestions(level.id).some((question) => isWordChoiceQuestion(question))
  );
}

function levelUsesMistakeChances(level) {
  if (!level?.id) return false;
  if (level.id === "wrong-review-dynamic") return true;
  return (
    level.newKnowledgeIds.length === 0 &&
    ["memory-review-gate", "word-review-gate", "vowel-boss", "final-review-gate", "cumulative-review-gate"].includes(level.puzzleMode)
  );
}

function getSessionPairOptions(session, question) {
  const pairs = question?.pairs || [];
  const queuedOptions = session?.optionQueue?.[getSessionQuestionKey(session, question)] || session?.optionQueue?.[question.id];
  if (queuedOptions?.left?.length === pairs.length && queuedOptions?.right?.length === pairs.length) return queuedOptions;
  return buildPairOptionOrder(pairs);
}

function arePairOptionsSafe(question, options) {
  const pairs = question?.pairs || [];
  if (question?.questionType !== "pair-match") return true;
  if (!options?.left || !options?.right || options.left.length !== pairs.length || options.right.length !== pairs.length) return false;
  const rightByLeft = new Map(pairs.map((pair) => [pair.left, pair.right]));
  return !options.right.some((right, index) => rightByLeft.get(options.left[index]) === right);
}

function sanitizeOptionQueue(session, questionQueue) {
  const existing = session.optionQueue && typeof session.optionQueue === "object" ? session.optionQueue : null;
  const rebuilt = () => buildOptionQueue(session.levelId, questionQueue.length ? questionQueue : null);
  if (!existing || !Object.keys(existing).length) return rebuilt();

  const sessionQuestions = getSessionQuestions({ levelId: session.levelId, questionQueue });
  for (const [index, question] of sessionQuestions.entries()) {
    if (question.questionType !== "pair-match") continue;
    const queueKey = questionQueue[index] === question.id ? `${question.id}#${index}` : question.id;
    const options = existing[queueKey] || existing[question.id];
    if (!arePairOptionsSafe(question, options)) return rebuilt();
  }

  return existing;
}

function createPlaySession(levelId) {
  const level = getLevelById(levelId);
  const startsWithStudy = Boolean(level?.newKnowledgeIds.length);
  const startsWithHandwriting = startsWithStudy && levelUsesHandwriting(level);
  const startsWithWordReview = !startsWithStudy && levelNeedsWordReview(level);

  const questionQueue = startsWithStudy ? [] : buildQuestionQueue(levelId);

  return {
    levelId,
    sessionToken: `${levelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tutorialStep: 0,
    questionIndex: 0,
    correctCount: 0,
    answered: false,
    failed: false,
    studySeen: false,
    practiceSeen: !startsWithStudy,
    handwritingDemoSeen: !startsWithHandwriting,
    handwritingTraceDone: !startsWithHandwriting,
    handwritingDone: !startsWithHandwriting,
    readyForQuiz: !startsWithStudy && !startsWithWordReview,
    wordReviewSeen: !startsWithWordReview,
    wordReviewRound: 0,
    wordReviewIndex: 0,
    autoPlayedQuestionId: null,
    autoPlayedStudyKey: null,
    selectedAnswer: null,
    selectedPairLeft: null,
    pairWrong: null,
    pairMatches: [],
    sentenceOrder: [],
    typedAnswer: "",
    questionWrongAttempts: 0,
    levelWrongAttempts: 0,
    feedback: "",
    autoAdvance: false,
    questionQueue,
    optionQueue: startsWithStudy ? {} : buildOptionQueue(levelId, questionQueue),
  };
}

function sanitizeSavedPlaySession(session, options = {}) {
  if (!session?.levelId) return null;
  const level = getLevelById(session.levelId);
  if (!level || (!options.allowCleared && session.levelId !== "wrong-review-dynamic" && isLevelCleared(session.levelId))) return null;
  const levelQuestions = getLevelQuestions(session.levelId);
  const savedQuestionQueue = Array.isArray(session.questionQueue) ? session.questionQueue : [];
  const shouldHaveQuestionQueue =
    savedQuestionQueue.length > 0 ||
    session.readyForQuiz ||
    (!level.newKnowledgeIds.length && !levelNeedsWordReview(level));
  const questionQueue = shouldHaveQuestionQueue ? sanitizeQuestionQueueForLevel(session.levelId, savedQuestionQueue) : [];
  const maxQuestionIndex = Math.max((questionQueue.length || levelQuestions.length) - 1, 0);
  const sessionToken =
    options.refreshToken || !session.sessionToken
      ? `${session.levelId}-saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : session.sessionToken;
  return {
    ...createPlaySession(session.levelId),
    ...session,
    sessionToken,
    questionIndex: Math.max(0, Math.min(Number(session.questionIndex || 0), maxQuestionIndex)),
    correctCount: Math.max(0, Number(session.correctCount || 0)),
    answered: false,
    failed: false,
    selectedAnswer: null,
    selectedPairLeft: null,
    pairWrong: null,
    sentenceOrder: [],
    typedAnswer: "",
    speechRecording: false,
    speechRecorded: false,
    speechPassed: false,
    speechDurationMs: 0,
    speechTranscript: "",
    speechEngine: "",
    autoPlayedQuestionId: null,
    autoPlayedStudyKey: null,
    wordReviewRound: Math.max(0, Number(session.wordReviewRound || 0)),
    wordReviewIndex: Math.max(0, Number(session.wordReviewIndex || 0)),
    feedback: "",
    celebration: null,
    autoAdvance: false,
    questionQueue,
    optionQueue: sanitizeOptionQueue(session, questionQueue),
    pairMatches: Array.isArray(session.pairMatches) ? session.pairMatches : [],
    questionWrongAttempts: Math.max(0, Number(session.questionWrongAttempts || 0)),
    levelWrongAttempts: Math.max(0, Number(session.levelWrongAttempts ?? session.questionWrongAttempts ?? 0)),
  };
}

function getStorablePlaySession(session = state.playSession) {
  if (!session?.levelId) return null;
  return sanitizeSavedPlaySession(session, { allowCleared: true });
}

function syncActiveSessionToSave() {
  const activeSession = getStorablePlaySession();
  const previous = state.save.activeSession || null;
  const previousJson = previous ? JSON.stringify(previous) : "";
  const nextJson = activeSession ? JSON.stringify(activeSession) : "";
  if (previousJson === nextJson) return;
  state.save = {
    ...state.save,
    activeSession,
  };
  saveGame(state.save);
}

function clearActiveSessionInSave() {
  if (!state.save.activeSession) return;
  state.save = {
    ...state.save,
    activeSession: null,
  };
  saveGame(state.save);
}

function getPausedPlaySession(session = state.playSession) {
  if (!session) return null;
  return {
    ...session,
    sessionToken: `${session.levelId}-paused-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    answered: false,
    failed: false,
    selectedAnswer: null,
    selectedPairLeft: null,
    pairWrong: null,
    sentenceOrder: [],
    typedAnswer: "",
    speechRecording: false,
    speechRecorded: false,
    speechPassed: false,
    speechDurationMs: 0,
    speechTranscript: "",
    speechEngine: "",
    autoPlayedQuestionId: null,
    autoPlayedStudyKey: null,
    feedback: "",
    celebration: null,
    autoAdvance: false,
  };
}

function getResumedPlaySession(session) {
  if (!session) return null;
  return {
    ...session,
    sessionToken: `${session.levelId}-resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    autoPlayedQuestionId: null,
    autoPlayedStudyKey: null,
    feedback: "",
    celebration: null,
    autoAdvance: false,
  };
}

function pausePlaySessionForNavigation(route) {
  if (!state.playSession || route === "puzzle") return state.playSession;
  return getPausedPlaySession(state.playSession);
}

function navigate(route, selectedLevelId = state.selectedLevelId, options = {}) {
  const nextHistory = options.replace ? state.routeHistory : [...state.routeHistory, { route: state.route, selectedLevelId: state.selectedLevelId }];
  state = {
    ...state,
    route,
    selectedLevelId,
    playSession: pausePlaySessionForNavigation(route),
    resetConfirmPending: false,
    backMessage: "",
    contactNotice: "",
    routeHistory: nextHistory,
  };
  render();
}

function startLevel(levelId) {
  clearActiveSessionInSave();
  state = {
    ...state,
    route: "puzzle",
    selectedLevelId: levelId,
    playSession: createPlaySession(levelId),
    backMessage: "",
    routeHistory: [...state.routeHistory, { route: state.route, selectedLevelId: state.selectedLevelId }],
  };
  render();
}

function resumeOrStartLevel(levelId) {
  const canResume = state.playSession?.levelId === levelId;
  if (!canResume) {
    startLevel(levelId);
    return;
  }

  state = {
    ...state,
    route: "puzzle",
    selectedLevelId: levelId,
    playSession: getResumedPlaySession(state.playSession),
    backMessage: "",
    routeHistory: [...state.routeHistory, { route: state.route, selectedLevelId: state.selectedLevelId }],
  };
  render();
}

function goBack() {
  if (state.route === "home") {
    state = { ...state, playSession: getPausedPlaySession(), backMessage: HOME_BACK_MESSAGE, contactNotice: "" };
    audioService.playUiCue("click");
    render();
    return;
  }

  if (state.route === "puzzle") {
    navigate("levels", state.selectedLevelId, { replace: true });
    return;
  }

  const previous = state.routeHistory[state.routeHistory.length - 1];
  if (previous) {
    state = {
      ...state,
      route: previous.route,
      selectedLevelId: previous.selectedLevelId,
      playSession: pausePlaySessionForNavigation(previous.route),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: state.routeHistory.slice(0, -1),
    };
    render();
    return;
  }

  navigate("home", null, { replace: true });
}

function completeLevel(levelId, stars = 1) {
  if (levelId === "wrong-review-dynamic" || isWeakReviewLevelId(levelId)) {
    recordLearningActivity({ actionType: isWeakReviewLevelId(levelId) ? "dimension-review-clear" : "wrong-review-clear", levelCleared: true });
    state = {
      ...state,
      playSession: null,
      selectedLevelId: null,
      save: {
        ...state.save,
        wrongQuestions: getReviewWrongQuestions().filter((entry) =>
          (entry.knowledgeIds || []).some((knowledgeId) => (state.save.mastery?.[knowledgeId]?.level || 0) < 3),
        ),
      },
    };
    clearActiveSessionInSave();
    saveGame(state.save);
    navigate("review", null, { replace: true });
    return;
  }

  const level = getLevelById(levelId);
  if (!level) return;
  const wasCleared = isLevelCleared(levelId);
  const clearedLevels = new Set(state.save.clearedLevels);
  clearedLevels.add(levelId);

  const unlockedCards = new Set(state.save.unlockedCards);
  level.reward.cards.forEach((card) => unlockedCards.add(card));

  state.save = {
    ...state.save,
    coins: state.save.coins + (wasCleared ? 0 : level.reward.coins),
    exp: state.save.exp + (wasCleared ? 0 : level.reward.exp),
    playerLevel: getPlayerLevel(state.save.exp + (wasCleared ? 0 : level.reward.exp)),
    pet: {
      ...state.save.pet,
      exp: (state.save.pet?.exp || 0) + (wasCleared ? 0 : Math.ceil(level.reward.exp / 2)),
      level: getPetLevel((state.save.pet?.exp || 0) + (wasCleared ? 0 : Math.ceil(level.reward.exp / 2))),
    },
    clearedLevels: [...clearedLevels],
    unlockedCards: [...unlockedCards],
    starRecords: {
      ...state.save.starRecords,
      [levelId]: Math.max(stars, state.save.starRecords[levelId] || 0),
    },
  };
  if (!wasCleared) {
    recordDailyClear();
    recordLearningActivity({ actionType: "level-clear", levelCleared: true });
  }

  state = {
    ...state,
    playSession: null,
    selectedLevelId: null,
  };
  saveGame(state.save);
  clearActiveSessionInSave();
  advanceAfterLevelCompletion(levelId);
}

function getNextMainLevel(levelId) {
  const currentLevel = levels.find((item) => item.id === levelId);
  if (!currentLevel) return null;

  return levels
    .filter((item) => item.type !== "review" && item.order > currentLevel.order)
    .sort((a, b) => a.order - b.order)
    .find((item) => isLevelUnlocked(item));
}

function advanceAfterLevelCompletion(levelId) {
  const nextLevel = getNextMainLevel(levelId);

  if (nextLevel && (nextLevel.type === "tutorial" || getLevelQuestions(nextLevel.id).length > 0)) {
    startLevel(nextLevel.id);
    return;
  }

  state = {
    ...state,
    playSession: null,
  };
  clearActiveSessionInSave();
  navigate("levels", nextLevel?.id || levelId);
}

function getMasteryRecord(knowledgeId) {
  return (
    state.save.mastery?.[knowledgeId] || {
      level: 0,
      correctCount: 0,
      wrongCount: 0,
      lastReviewedAt: null,
    }
  );
}

function updateLearningRecord(question, isCorrect) {
  if (!question?.knowledgeIds?.length) return;
  recordDailyQuestion(isCorrect);
  recordLearningActivity({ isCorrect, actionType: question.questionType || "question" });
  const now = new Date().toISOString();
  const reviewDimension = getQuestionMasteryDimension(question);
  const mastery = { ...(state.save.mastery || {}) };
  const wrongQuestions = getReviewWrongQuestions();

  question.knowledgeIds.forEach((knowledgeId) => {
    const current = getMasteryRecord(knowledgeId);
    const dimensions = { ...(current.dimensions || {}) };
    dimensions[reviewDimension] = updateMasteryDimensionRecord(current, reviewDimension, isCorrect, now);
    mastery[knowledgeId] = {
      ...current,
      level: Math.max(0, Math.min(5, current.level + (isCorrect ? 1 : -1))),
      correctCount: current.correctCount + (isCorrect ? 1 : 0),
      wrongCount: current.wrongCount + (isCorrect ? 0 : 1),
      lastReviewedAt: now,
      dimensions,
    };
  });

  const questionKnowledgeKey = [...question.knowledgeIds].sort().join("|");
  let nextWrongQuestions = wrongQuestions;
  if (!isCorrect && !isHandwritingReviewEntry(question)) {
    const existingIndex = wrongQuestions.findIndex((entry) => [...(entry.knowledgeIds || [])].sort().join("|") === questionKnowledgeKey);
    const existing = existingIndex >= 0 ? wrongQuestions[existingIndex] : null;
    nextWrongQuestions = [
      {
        id: existing?.id || `${question.id}-${Date.now()}`,
        questionId: question.id,
        levelId: question.levelId,
        questionType: question.questionType,
        reviewDimension,
        knowledgeIds: question.knowledgeIds,
        wrongAt: now,
        wrongCount: (existing?.wrongCount || 0) + 1,
        correctStreak: 0,
      },
      ...wrongQuestions.filter((_, index) => index !== existingIndex),
    ];
  } else {
    nextWrongQuestions = wrongQuestions
      .map((entry) => {
        const hasRecoveredKnowledge = (entry.knowledgeIds || []).some((knowledgeId) => question.knowledgeIds.includes(knowledgeId));
        if (!hasRecoveredKnowledge) return entry;
        return { ...entry, correctStreak: (entry.correctStreak || 0) + 1 };
      })
      .filter((entry) => (entry.correctStreak || 0) < 2);
  }

  state.save = {
    ...state.save,
    mastery,
    wrongQuestions: nextWrongQuestions.slice(0, 50),
  };
  saveGame(state.save);
}

function getStrokePoints(stroke) {
  return Array.isArray(stroke) ? stroke : stroke.points || [];
}

function flattenModelPoints(model) {
  return model?.strokes.flatMap((stroke) => getStrokePoints(stroke)) || [];
}

function getBounds(points) {
  if (!points.length) return { width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function getCenter(bounds) {
  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
}

function getShapeSkew(points) {
  const bounds = getBounds(points);
  if (bounds.width <= 0 || bounds.height <= 0) return 0;
  const topLimit = bounds.minY + bounds.height * 0.42;
  const bottomLimit = bounds.minY + bounds.height * 0.58;
  const topPoints = points.filter((point) => point.y <= topLimit);
  const bottomPoints = points.filter((point) => point.y >= bottomLimit);
  if (!topPoints.length || !bottomPoints.length) return 0;
  const averageX = (items) => items.reduce((total, point) => total + point.x, 0) / items.length;
  return (averageX(bottomPoints) - averageX(topPoints)) / bounds.height;
}

function getStrokeLength(points) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function getStrokeDirectnessRatio(points) {
  if (points.length < 2) return 1;
  const directDistance = Math.hypot(points.at(-1).x - points[0].x, points.at(-1).y - points[0].y);
  return getStrokeLength(points) / Math.max(directDistance, 0.001);
}

function interpolatePoint(start, end, ratio) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function resampleStroke(points, targetCount = 24) {
  if (points.length < 2) return points;
  const totalLength = getStrokeLength(points);
  if (totalLength <= 0) return Array.from({ length: targetCount }, () => ({ ...points[0] }));

  const interval = totalLength / (targetCount - 1);
  const resampled = [{ ...points[0] }];
  let distanceFromLast = 0;
  let previous = points[0];

  for (let index = 1; index < points.length; index += 1) {
    let current = points[index];
    let segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);

    while (distanceFromLast + segmentLength >= interval && resampled.length < targetCount - 1) {
      const ratio = (interval - distanceFromLast) / Math.max(segmentLength, 0.0001);
      const nextPoint = interpolatePoint(previous, current, ratio);
      resampled.push(nextPoint);
      previous = nextPoint;
      segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);
      distanceFromLast = 0;
    }

    distanceFromLast += segmentLength;
    previous = current;
  }

  while (resampled.length < targetCount) {
    resampled.push({ ...points[points.length - 1] });
  }

  return resampled;
}

function getStrokeTurnAmount(points) {
  const sampled = resampleStroke(points, 24);
  let total = 0;
  for (let index = 1; index < sampled.length - 1; index += 1) {
    const previous = sampled[index - 1];
    const current = sampled[index];
    const next = sampled[index + 1];
    const first = { x: current.x - previous.x, y: current.y - previous.y };
    const second = { x: next.x - current.x, y: next.y - current.y };
    const firstLength = Math.hypot(first.x, first.y);
    const secondLength = Math.hypot(second.x, second.y);
    if (firstLength <= 0.0001 || secondLength <= 0.0001) continue;
    const dot = Math.max(-1, Math.min(1, (first.x * second.x + first.y * second.y) / (firstLength * secondLength)));
    total += Math.acos(dot);
  }
  return total / Math.PI;
}

function smoothStrokeForValidation(stroke) {
  if (stroke.length < 3) return stroke;
  return stroke.map((point, index) => {
    if (index === 0 || index === stroke.length - 1) return point;
    const previous = stroke[index - 1];
    const next = stroke[index + 1];
    return {
      x: (previous.x + point.x * 2 + next.x) / 4,
      y: (previous.y + point.y * 2 + next.y) / 4,
    };
  });
}

function simplifyStrokeForValidation(stroke, minDistance = 0.01) {
  if (stroke.length <= 2) return stroke;
  const simplified = [stroke[0]];
  for (const point of stroke.slice(1, -1)) {
    const previous = simplified[simplified.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance) {
      simplified.push(point);
    }
  }
  const last = stroke[stroke.length - 1];
  const previous = simplified[simplified.length - 1];
  if (!previous || Math.hypot(last.x - previous.x, last.y - previous.y) > 0.0001) {
    simplified.push(last);
  }
  return simplified.length >= 2 ? simplified : stroke;
}

function stabilizeStrokeForValidation(stroke) {
  return simplifyStrokeForValidation(smoothStrokeForValidation(stroke));
}

function getHandwritingStrokeCountMessage(knowledgeId, model) {
  return "看着示范，再写一遍。";
}

function getHandwritingStrokeOrderMessage(knowledgeId) {
  return "看着示范，再写一遍。";
}

function getHandwritingDirectionMessage(knowledgeId) {
  return "看着示范，再写一遍。";
}

function getHandwritingSamplingMessage() {
  return "看着示范，再写一遍。";
}

function getRequiredStrokePointCount(modelStrokePoints, thresholds) {
  const isCurved =
    getStrokeDirectnessRatio(modelStrokePoints) >= thresholds.curvedStrokeDirectness &&
    getStrokeTurnAmount(modelStrokePoints) >= thresholds.curvedStrokeTurnAmount;
  return isCurved ? 5 : 2;
}

function hasEnoughStrokeSamples(strokes, model, thresholds) {
  return strokes.every((stroke, index) => {
    const modelStrokePoints = getStrokePoints(model.strokes[index] || []).map(([x, y]) => ({ x, y }));
    return stroke.length >= getRequiredStrokePointCount(modelStrokePoints, thresholds);
  });
}

function getAveragePairedDistance(userPoints, modelPoints) {
  const count = Math.min(userPoints.length, modelPoints.length);
  if (!count) return 1;
  return (
    Array.from({ length: count }).reduce((total, _, index) => {
      const userPoint = userPoints[index];
      const modelPoint = modelPoints[index];
      return total + Math.hypot(userPoint.x - modelPoint.x, userPoint.y - modelPoint.y);
    }, 0) / count
  );
}

function getStrokeShapeMetrics(userStroke, modelStrokePoints, thresholds) {
  const userStart = userStroke[0];
  const userEnd = userStroke[userStroke.length - 1];
  const modelStart = modelStrokePoints[0];
  const modelEnd = modelStrokePoints[modelStrokePoints.length - 1];
  const startDistance = Math.hypot(userStart.x - modelStart.x, userStart.y - modelStart.y);
  const endDistance = Math.hypot(userEnd.x - modelEnd.x, userEnd.y - modelEnd.y);
  const strokeAverageDistance = userStroke.reduce((total, point) => total + distanceToModel(point, modelStrokePoints), 0) / Math.max(userStroke.length, 1);
  const coverageRatio =
    modelStrokePoints.filter((point) => getMinimumDistance(point, userStroke) <= thresholds.coverageDistance).length / Math.max(modelStrokePoints.length, 1);
  const directionSimilarity = getDirectionSimilarity(userStroke, modelStrokePoints);
  const resampledUser = resampleStroke(userStroke);
  const resampledModel = resampleStroke(modelStrokePoints);
  const shapeDistance = getAveragePairedDistance(resampledUser, resampledModel);
  const userCoverageRatio =
    userStroke.filter((point) => distanceToModel(point, modelStrokePoints) <= thresholds.userCoverageDistance).length / Math.max(userStroke.length, 1);
  return {
    startDistance,
    endDistance,
    strokeAverageDistance,
    coverageRatio,
    userCoverageRatio,
    directionSimilarity,
    shapeDistance,
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function distanceToModel(point, modelPoints) {
  if (modelPoints.length < 2) return 1;
  return modelPoints.slice(1).reduce((best, current, index) => {
    const previous = modelPoints[index];
    return Math.min(best, distanceToSegment(point, previous, current));
  }, 1);
}

function normalizeStrokes(strokes, canvas) {
  return strokes.map((stroke) =>
    stroke.map((point) => ({
      x: point.x / canvas.width,
      y: point.y / canvas.height,
    })),
  );
}

function fitStrokesToModel(strokes, model) {
  const userPoints = strokes.flat();
  const modelPoints = flattenModelPoints(model).map(([x, y]) => ({ x, y }));
  if (!userPoints.length || !modelPoints.length) return strokes;

  const userBounds = getBounds(userPoints);
  const modelBounds = getBounds(modelPoints);
  if (userBounds.width <= 0 || userBounds.height <= 0 || modelBounds.width <= 0 || modelBounds.height <= 0) {
    return strokes;
  }

  const userCenter = getCenter(userBounds);
  const modelCenter = getCenter(modelBounds);
  const scale = Math.min(modelBounds.width / userBounds.width, modelBounds.height / userBounds.height);

  return strokes.map((stroke) =>
    stroke.map((point) => ({
      x: modelCenter.x + (point.x - userCenter.x) * scale,
      y: modelCenter.y + (point.y - userCenter.y) * scale,
    })),
  );
}

function getMinimumDistance(point, points) {
  if (!points.length) return 1;
  return points.reduce((best, current) => Math.min(best, Math.hypot(point.x - current.x, point.y - current.y)), 1);
}

function getDirectionSimilarity(userStroke, modelStrokePoints) {
  if (userStroke.length < 2 || modelStrokePoints.length < 2) return 0;
  const userStart = userStroke[0];
  const userEnd = userStroke[userStroke.length - 1];
  const modelStart = modelStrokePoints[0];
  const modelEnd = modelStrokePoints[modelStrokePoints.length - 1];
  const userDx = userEnd.x - userStart.x;
  const userDy = userEnd.y - userStart.y;
  const modelDx = modelEnd.x - modelStart.x;
  const modelDy = modelEnd.y - modelStart.y;
  const userLength = Math.hypot(userDx, userDy);
  const modelLength = Math.hypot(modelDx, modelDy);
  if (userLength === 0 || modelLength === 0) return 0;
  return (userDx * modelDx + userDy * modelDy) / (userLength * modelLength);
}

function getLocalDirectionStats(userStroke, modelStrokePoints) {
  const userPoints = resampleStroke(userStroke, 20);
  const modelPoints = resampleStroke(modelStrokePoints, 20);
  const segmentCount = Math.min(userPoints.length, modelPoints.length) - 1;
  if (segmentCount <= 0) return { average: 0, lowerQuartile: 0 };

  const similarities = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const userDx = userPoints[index + 1].x - userPoints[index].x;
    const userDy = userPoints[index + 1].y - userPoints[index].y;
    const modelDx = modelPoints[index + 1].x - modelPoints[index].x;
    const modelDy = modelPoints[index + 1].y - modelPoints[index].y;
    const userLength = Math.hypot(userDx, userDy);
    const modelLength = Math.hypot(modelDx, modelDy);
    if (userLength <= 0.0001 || modelLength <= 0.0001) continue;
    similarities.push((userDx * modelDx + userDy * modelDy) / (userLength * modelLength));
  }

  if (!similarities.length) return { average: 0, lowerQuartile: 0 };
  const sorted = [...similarities].sort((left, right) => left - right);
  return {
    average: similarities.reduce((total, value) => total + value, 0) / similarities.length,
    lowerQuartile: sorted[Math.floor(sorted.length * 0.25)],
  };
}

function getHandwritingThresholds(knowledgeId) {
  const item = knowledge.find((entry) => entry.id === knowledgeId);
  if (item?.category === "katakana-vowel") {
    return {
      minPoints: 10,
      minWidth: 0.12,
      minHeight: 0.12,
      maxAspectDelta: 0.82,
      minLengthRatio: 0.48,
      maxLengthRatio: 2.25,
      strokeLengthRatioMin: 0.34,
      strokeLengthRatioMax: 2.7,
      startDistance: knowledgeId === "kana-kata-u" ? 0.46 : 0.4,
      endDistance: knowledgeId === "kana-kata-u" ? 0.46 : 0.4,
      strokeAverageDistance: knowledgeId === "kana-kata-u" ? 0.34 : 0.3,
      coverageDistance: 0.24,
      userCoverageDistance: 0.22,
      coverageRatio: knowledgeId === "kana-kata-u" ? 0.34 : 0.38,
      userCoverageRatio: knowledgeId === "kana-kata-u" ? 0.42 : 0.48,
      directionSimilarity: 0.22,
      localDirectionSimilarity: 0.24,
      singleStrokeLocalDirectionQuartile: 0.42,
      shapeDistance: knowledgeId === "kana-kata-u" ? 0.38 : 0.34,
      criticalStrokeLengthRatioMin: 0.24,
      criticalStrokeLengthRatioMax: 3.2,
      criticalCoverageRatio: 0.24,
      criticalUserCoverageRatio: 0.28,
      criticalDirectionSimilarity: -0.12,
      criticalLocalDirectionSimilarity: 0.02,
      criticalSingleStrokeLocalDirectionQuartile: 0.18,
      criticalShapeDistance: knowledgeId === "kana-kata-u" ? 0.58 : 0.52,
      criticalStrokeAverageDistance: knowledgeId === "kana-kata-u" ? 0.52 : 0.46,
      criticalAspectDelta: 1.04,
      maxSkewDelta: 0.36,
      criticalSkewDelta: 0.62,
      curvedStrokeDirectness: 1.16,
      curvedStrokeTurnAmount: 0.45,
      curvedStrokeDirectnessRatio: 0.72,
      curvedStrokeTurnRatio: 0.42,
      finalHandwritingScore: 0.64,
      minimumStrokeScore: 0.54,
      averageStrokeScore: 0.66,
    };
  }

  return {
    minPoints: 14,
    minWidth: 0.15,
    minHeight: 0.15,
    maxAspectDelta: 0.72,
    minLengthRatio: 0.56,
    maxLengthRatio: 2.15,
    strokeLengthRatioMin: 0.38,
    strokeLengthRatioMax: 2.45,
    startDistance: 0.34,
    endDistance: 0.34,
    strokeAverageDistance: 0.26,
    coverageDistance: 0.2,
    userCoverageDistance: 0.2,
    coverageRatio: 0.44,
    userCoverageRatio: 0.5,
    directionSimilarity: 0.32,
    localDirectionSimilarity: 0.28,
    singleStrokeLocalDirectionQuartile: 0.45,
    shapeDistance: 0.3,
    criticalStrokeLengthRatioMin: 0.28,
    criticalStrokeLengthRatioMax: 3.0,
    criticalCoverageRatio: 0.3,
    criticalUserCoverageRatio: 0.34,
    criticalDirectionSimilarity: -0.06,
    criticalLocalDirectionSimilarity: 0.06,
    criticalSingleStrokeLocalDirectionQuartile: 0.22,
    criticalShapeDistance: 0.48,
    criticalStrokeAverageDistance: 0.42,
    criticalAspectDelta: 0.92,
    maxSkewDelta: 0.3,
    criticalSkewDelta: 0.52,
    curvedStrokeDirectness: 1.16,
    curvedStrokeTurnAmount: 0.45,
    curvedStrokeDirectnessRatio: 0.72,
    curvedStrokeTurnRatio: 0.42,
    finalHandwritingScore: 0.66,
    minimumStrokeScore: 0.56,
    averageStrokeScore: 0.68,
  };
}

function getStrokeOrderMatchCost(stroke, modelStrokePoints, thresholds) {
  const metrics = getStrokeShapeMetrics(stroke, modelStrokePoints, thresholds);
  return (
    metrics.startDistance * 0.9 +
    metrics.endDistance * 0.9 +
    metrics.shapeDistance * 1.2 +
    metrics.strokeAverageDistance * 0.8 +
    (1 - Math.max(-1, metrics.directionSimilarity)) * 0.08
  );
}

function hasStrokeOrderMismatch(fittedStrokes, model, thresholds) {
  if (fittedStrokes.length !== model.strokes.length || model.strokes.length < 2) return false;
  return fittedStrokes.some((stroke, strokeIndex) => {
    const costs = model.strokes.map((modelStroke) =>
      getStrokeOrderMatchCost(
        stroke,
        getStrokePoints(modelStroke).map(([x, y]) => ({ x, y })),
        thresholds,
      ),
    );
    const ownCost = costs[strokeIndex];
    const bestCost = Math.min(...costs);
    const bestIndex = costs.indexOf(bestCost);
    return bestIndex !== strokeIndex && ownCost > 0.22 && ownCost > bestCost + 0.18;
  });
}

function isCurveShortcut(stroke, modelStrokePoints, thresholds) {
  if (stroke.length < 3 || modelStrokePoints.length < 5) return false;
  const modelDirectness = getStrokeDirectnessRatio(modelStrokePoints);
  const modelTurnAmount = getStrokeTurnAmount(modelStrokePoints);
  if (modelDirectness < thresholds.curvedStrokeDirectness || modelTurnAmount < thresholds.curvedStrokeTurnAmount) return false;
  const strokeDirectness = getStrokeDirectnessRatio(stroke);
  const strokeTurnAmount = getStrokeTurnAmount(stroke);
  const metrics = getStrokeShapeMetrics(stroke, modelStrokePoints, thresholds);
  if (
    metrics.coverageRatio >= thresholds.coverageRatio &&
    metrics.userCoverageRatio >= thresholds.userCoverageRatio &&
    metrics.shapeDistance <= thresholds.shapeDistance * 0.55 &&
    metrics.strokeAverageDistance <= thresholds.strokeAverageDistance * 0.5 &&
    strokeTurnAmount >= modelTurnAmount * 0.3
  ) {
    return false;
  }
  return (
    strokeDirectness < modelDirectness * thresholds.curvedStrokeDirectnessRatio ||
    strokeTurnAmount < modelTurnAmount * thresholds.curvedStrokeTurnRatio
  );
}

function validateHandwriting(knowledgeId, strokes, canvas) {
  if (!canvas) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };
  const model = getFrontendHandwritingModel(knowledgeId);
  if (!model) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };
  const thresholds = getHandwritingThresholds(knowledgeId);

  const normalizedStrokes = normalizeStrokes(strokes, canvas)
    .filter((stroke) => stroke.length >= 2)
    .map(stabilizeStrokeForValidation);
  const points = normalizedStrokes.flat();
  if (normalizedStrokes.length !== model.strokes.length || model.minStrokes !== model.maxStrokes || model.minStrokes !== model.strokes.length) {
    return { passed: false, message: getHandwritingStrokeCountMessage(knowledgeId, model) };
  }
  if (!hasEnoughStrokeSamples(normalizedStrokes, model, thresholds)) return { passed: false, message: getHandwritingSamplingMessage() };

  const validationStrokes = normalizedStrokes.map((stroke) => resampleStroke(stroke, 24));
  const validationPoints = validationStrokes.flat();
  const bounds = getBounds(validationPoints);
  if (bounds.width < thresholds.minWidth || bounds.height < thresholds.minHeight) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };

  const modelPoints = flattenModelPoints(model).map(([x, y]) => ({ x, y }));
  const modelBounds = getBounds(modelPoints);
  const userAspect = bounds.width / Math.max(bounds.height, 0.001);
  const modelAspect = modelBounds.width / Math.max(modelBounds.height, 0.001);
  const aspectDelta = Math.abs(userAspect - modelAspect);
  if (aspectDelta > thresholds.criticalAspectDelta) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };
  const skewDelta = Math.abs(getShapeSkew(validationPoints) - getShapeSkew(modelPoints));
  if (skewDelta > thresholds.criticalSkewDelta) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };

  const fittedStrokes = fitStrokesToModel(validationStrokes, model);
  const modelLength = model.strokes.reduce((total, stroke) => {
    const normalized = getStrokePoints(stroke).map(([x, y]) => ({ x, y }));
    return total + getStrokeLength(normalized);
  }, 0);
  const userLength = fittedStrokes.reduce((total, stroke) => total + getStrokeLength(stroke), 0);
  if (userLength < modelLength * thresholds.minLengthRatio) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };
  if (userLength > modelLength * thresholds.maxLengthRatio) return { passed: false, message: HANDWRITING_RETRY_MESSAGE };
  if (hasStrokeOrderMismatch(fittedStrokes, model, thresholds)) return { passed: false, message: getHandwritingStrokeOrderMessage(knowledgeId) };

  let strokeFailureMessage = "";
  const strokeScores = fittedStrokes.map((stroke, index) => {
    const modelStrokePoints = getStrokePoints(model.strokes[index] || []).map(([x, y]) => ({ x, y }));
    if (modelStrokePoints.length < 2 || stroke.length < 2) return 0;
    const metrics = getStrokeShapeMetrics(stroke, modelStrokePoints, thresholds);
    const reversedMetrics = getStrokeShapeMetrics([...stroke].reverse(), modelStrokePoints, thresholds);
    const clearlyReversed =
      reversedMetrics.shapeDistance + 0.08 < metrics.shapeDistance && reversedMetrics.directionSimilarity > metrics.directionSimilarity + 0.28;
    if (clearlyReversed) {
      strokeFailureMessage ||= getHandwritingDirectionMessage(knowledgeId);
      return 0;
    }
    const modelStrokeLength = getStrokeLength(modelStrokePoints);
    const strokeLengthRatio = getStrokeLength(stroke) / Math.max(modelStrokeLength, 0.001);
    const localDirectionStats = getLocalDirectionStats(stroke, modelStrokePoints);
    const coverageBelowTarget = metrics.coverageRatio < thresholds.coverageRatio || metrics.userCoverageRatio < thresholds.userCoverageRatio;
    const directionBelowTarget = metrics.directionSimilarity < thresholds.directionSimilarity;
    const localDirectionBelowTarget = localDirectionStats.average < thresholds.localDirectionSimilarity;
    const shapeBelowTarget = metrics.shapeDistance > thresholds.shapeDistance;
    const distanceBelowTarget = metrics.strokeAverageDistance > thresholds.strokeAverageDistance;
    const oneStrokeLocalBelowTarget =
      model.strokes.length === 1 &&
      modelStrokePoints.length >= 5 &&
      localDirectionStats.lowerQuartile < thresholds.singleStrokeLocalDirectionQuartile;
    const targetMissCount = [
      coverageBelowTarget,
      directionBelowTarget,
      localDirectionBelowTarget,
      shapeBelowTarget,
      distanceBelowTarget,
      oneStrokeLocalBelowTarget,
    ].filter(Boolean).length;
    if (knowledgeId === "kana-kata-i" && index === 0 && (directionBelowTarget || localDirectionBelowTarget)) {
      strokeFailureMessage ||= getHandwritingDirectionMessage(knowledgeId);
    }

    if (strokeLengthRatio < thresholds.criticalStrokeLengthRatioMin || strokeLengthRatio > thresholds.criticalStrokeLengthRatioMax) return 0;
    if (metrics.coverageRatio < thresholds.criticalCoverageRatio && metrics.userCoverageRatio < thresholds.criticalUserCoverageRatio) return 0;
    if (metrics.directionSimilarity < thresholds.criticalDirectionSimilarity) return 0;
    if (localDirectionStats.average < thresholds.criticalLocalDirectionSimilarity) return 0;
    if (isCurveShortcut(stroke, modelStrokePoints, thresholds)) return 0;
    if (
      model.strokes.length === 1 &&
      modelStrokePoints.length >= 5 &&
      localDirectionStats.lowerQuartile < thresholds.criticalSingleStrokeLocalDirectionQuartile
    ) {
      return 0;
    }
    if (metrics.shapeDistance > thresholds.criticalShapeDistance && metrics.strokeAverageDistance > thresholds.criticalStrokeAverageDistance) return 0;
    if (targetMissCount >= 4) return 0;
    if (shapeBelowTarget && distanceBelowTarget && (directionBelowTarget || localDirectionBelowTarget || coverageBelowTarget)) return 0;

    const startScore = Math.max(0, 1 - metrics.startDistance / thresholds.startDistance);
    const endScore = Math.max(0, 1 - metrics.endDistance / thresholds.endDistance);
    const distanceScore = Math.max(0, 1 - metrics.strokeAverageDistance / thresholds.strokeAverageDistance);
    const shapeScore = Math.max(0, 1 - metrics.shapeDistance / thresholds.shapeDistance);
    const coverageScore = Math.min(1, metrics.coverageRatio / thresholds.coverageRatio);
    const userCoverageScore = Math.min(1, metrics.userCoverageRatio / thresholds.userCoverageRatio);
    const directionScore = Math.max(0, Math.min(1, (metrics.directionSimilarity - thresholds.directionSimilarity) / (1 - thresholds.directionSimilarity)));
    const localDirectionScore = Math.max(0, Math.min(1, (localDirectionStats.average - thresholds.localDirectionSimilarity) / (1 - thresholds.localDirectionSimilarity)));
    const targetMissPenalty = targetMissCount * 0.035;
    return Math.max(
      0,
      startScore * 0.05 +
        endScore * 0.05 +
        distanceScore * 0.17 +
        shapeScore * 0.24 +
        coverageScore * 0.18 +
        userCoverageScore * 0.13 +
      directionScore * 0.08 +
        localDirectionScore * 0.1 -
        targetMissPenalty,
    );
  });
  const averageStrokeScore = strokeScores.reduce((total, score) => total + score, 0) / Math.max(strokeScores.length, 1);
  const aspectScore = Math.max(0, 1 - aspectDelta / thresholds.maxAspectDelta);
  const skewScore = Math.max(0, 1 - skewDelta / thresholds.maxSkewDelta);
  const finalScore = averageStrokeScore * 0.82 + aspectScore * 0.1 + skewScore * 0.08;
  if (
    Math.min(...strokeScores) < thresholds.minimumStrokeScore ||
    averageStrokeScore < thresholds.averageStrokeScore ||
    finalScore < thresholds.finalHandwritingScore
  ) {
    return { passed: false, message: strokeFailureMessage || HANDWRITING_RETRY_MESSAGE };
  }

  return { passed: true, message: "写得不错，继续。" };
}

function getStars(correctCount, totalQuestions) {
  if (totalQuestions <= 0) return 1;
  if (correctCount >= totalQuestions) return 3;
  if (correctCount >= Math.ceil(totalQuestions / 2)) return 2;
  return 1;
}

function getQuestionFocusKana(question, focusKnowledge) {
  if (question?.prompt && /[\u3040-\u30ff\u4e00-\u9fff]/.test(question.prompt)) return question.prompt;
  if (focusKnowledge?.type === "kanji") return focusKnowledge.japanese || focusKnowledge.kana;
  if (focusKnowledge?.kana) return focusKnowledge.kana;
  const firstKnowledgeId = question?.knowledgeIds?.[0];
  const item = knowledge.find((entry) => entry.id === firstKnowledgeId);
  if (item?.type === "kanji") return item.japanese || item.kana || "?";
  return item?.kana || item?.japanese || "?";
}

function getKnowledgeWrittenForm(item) {
  if (!item) return "";
  if (item.type === "kanji") return item.japanese || item.kana || item.readingHint || "";
  return item.kana || item.japanese || item.title || "";
}

function getKnowledgeReadingText(item) {
  if (!item) return "";
  if (item.type === "kanji") return item.kana || item.readingHint || item.romaji || "";
  return item.romaji || item.kana || item.readingHint || "";
}

function renderQuestionFocus(question, focusKnowledge) {
  if (isSpeechQuestion(question)) {
    return renderSpeechTarget(question, focusKnowledge);
  }

  if (question?.questionType === "handwriting-check") {
    const promptText = question.prompt || getKnowledgeReadingText(focusKnowledge);
    return `
      <div class="romaji-writing-prompt" aria-label="罗马音提示">
        <span>${promptText}</span>
      </div>
    `;
  }

  if (question?.questionType === "romaji-input" || question?.questionType === "kana-input") {
    return `<div class="kana-focus">${getQuestionFocusKana(question, focusKnowledge)}</div>`;
  }

  if (question?.questionType === "kana-to-sound") {
    return `<div class="kana-focus">${getQuestionFocusKana(question, focusKnowledge)}</div>`;
  }

  if (question?.questionType === "katakana-to-hiragana") {
    return `<div class="kana-focus">${getQuestionFocusKana(question, focusKnowledge)}</div>`;
  }

  if (question?.questionType === "pair-match") {
    return `
      <div class="pair-focus" aria-label="配对练习">
        <span>${question.pairLabel || "配对"}</span>
      </div>
    `;
  }

  if (question?.questionType === "image-to-word" || question?.questionType === "image-to-meaning") {
    const targetWord = knowledge.find((item) => item.id === question.knowledgeIds?.[0]);
    return `
      <div class="image-word-focus" aria-label="看图选词">
        ${renderWordVisual(targetWord, "word-focus-visual")}
        ${question.questionType === "image-to-word" ? renderImageMeaningLabel(targetWord) : ""}
      </div>
    `;
  }

  if (question?.questionType === "word-to-image") {
    return `
      <div class="word-image-prompt" aria-label="看词选图">
        <strong>${question.prompt || getKnowledgeWrittenForm(focusKnowledge)}</strong>
      </div>
    `;
  }

  if (question?.questionType === "word-to-meaning") {
    return `
      <div class="word-image-prompt" aria-label="看词选义">
        <strong>${question.prompt || getKnowledgeWrittenForm(focusKnowledge)}</strong>
      </div>
    `;
  }

  if (question?.questionType === "word-spell") {
    return `
      <div class="word-spell-prompt" aria-label="拼词练习">
        <small>拼出这个词</small>
        <strong>${question.prompt || focusKnowledge?.chinese || ""}</strong>
      </div>
    `;
  }

  if (isReadingOrDialogueQuestion(question) && !question.questionType?.includes("audio-to")) {
    return `
      <div class="passage-focus ${isDialogueQuestion(question) ? "is-dialogue" : ""}" aria-label="短文或对话练习">
        <strong>${renderMultilinePrompt(question.prompt || getKnowledgeWrittenForm(focusKnowledge))}</strong>
        <small>${question.questionText || ""}</small>
      </div>
    `;
  }

  if (question?.questionType === "audio-to-dialogue-meaning") {
    return `
      <div class="passage-focus is-dialogue" aria-label="听对话练习">
        <strong>听对话，选大意。</strong>
        <small>${focusKnowledge?.readingHint || "看下方选项"}</small>
      </div>
    `;
  }

  if (isSentenceQuestion(question) && !question.questionType?.includes("audio-to")) {
    const showSentenceReadingHint = !["sentence-order", "sentence-scenario"].includes(question.questionType) && focusKnowledge?.readingHint;
    return `
      <div class="sentence-focus" aria-label="句子练习">
        <strong>${question.prompt || getKnowledgeWrittenForm(focusKnowledge)}</strong>
        ${showSentenceReadingHint ? `<small>${focusKnowledge.readingHint}</small>` : ""}
      </div>
    `;
  }

  if (
    question?.noRomaji ||
    question?.questionType?.includes("audio-to-kana") ||
    question?.questionType?.includes("audio-to-word")
  ) {
    return `
      <div class="listen-focus" aria-label="听音练习">
        <b>▶</b>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  }

  if (!question || !focusKnowledge) return `<div class="kana-focus">芽</div>`;
  if (question.questionType === "romaji-to-kana") return `<div class="kana-focus">${focusKnowledge.romaji}</div>`;
  return `<div class="kana-focus">${getKnowledgeWrittenForm(focusKnowledge)}</div>`;
}

function renderMultilinePrompt(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("<br>");
}

function getOptionKnowledge(question, option) {
  if (isImageMeaningQuestion(question)) return null;
  if (!isWordChoiceQuestion(question)) return null;
  return knowledge.find((item) => item.type === "word" && item.kana === option);
}

const imageMeaningEnglishByRomaji = {
  aa: "ah / yes",
  ai: "love",
  ao: "blue",
  are: "that over there",
  asa: "morning",
  asoko: "over there",
  ame: "rain",
  basu: "bus",
  denwa: "phone",
  e: "picture",
  eki: "station",
  fune: "boat",
  gakkou: "school",
  gakusei: "student",
  gohan: "rice / meal",
  hako: "box",
  hana: "flower / nose",
  haru: "spring",
  heya: "room",
  hito: "person",
  hon: "book",
  hiru: "noon",
  hoshi: "star",
  ii: "good",
  iie: "no",
  ie: "home",
  ikimasu: "go",
  inu: "dog",
  iro: "color",
  iu: "say",
  kaban: "bag",
  kake: "hang",
  kaki: "persimmon / oyster",
  kawa: "river / skin",
  kika: "sound pattern",
  kiku: "listen / ask",
  koko: "here",
  kore: "this",
  kouen: "park",
  kutsu: "shoes",
  kyoushitsu: "classroom",
  machi: "town",
  mado: "window",
  mainichi: "every day",
  mame: "beans",
  matsu: "pine / wait",
  mimasu: "see / watch",
  mimi: "ear",
  mizu: "water",
  momo: "peach",
  naka: "inside",
  namae: "name",
  nani: "what",
  natsu: "summer",
  neko: "cat",
  nihon: "Japan",
  nomimasu: "drink",
  ocha: "tea",
  oi: "hey",
  oya: "parents",
  ringo: "apple",
  sake: "sake / salmon",
  sakana: "fish",
  sasa: "bamboo grass",
  sensei: "teacher",
  soko: "there",
  sora: "sky",
  sore: "that",
  soto: "outside",
  suki: "like",
  sushi: "sushi",
  tabemasu: "eat",
  taki: "waterfall",
  tako: "octopus / kite",
  ten: "dot / heaven",
  tegami: "letter",
  tokei: "clock",
  tori: "bird",
  tsuki: "moon",
  ue: "above",
  wan: "bowl",
  watashi: "I / me",
  yama: "mountain",
  yoko: "side",
  yomimasu: "read",
  yoru: "night",
  yasumi: "day off",
  yuki: "snow",
  yume: "dream",
};

function renderImageMeaningLabel(item) {
  const chinese = getImageMeaningLabel(item);
  const english = getImageEnglishMeaning(item);
  if (!chinese && !english) return "";
  return `
    <small class="image-meaning-label">
      ${chinese ? `<span>${chinese}</span>` : ""}
      ${english ? `<em>${english}</em>` : ""}
    </small>
  `;
}

function getImageMeaningLabel(item) {
  const text = String(item?.chinese || "").trim();
  if (!text) return "";
  return text.split(/[，,、]/)[0].trim() || text;
}

function getImageEnglishMeaning(item) {
  return imageMeaningEnglishByRomaji[item?.romaji] || "";
}

function isWordChoiceQuestion(question) {
  return (
    question?.questionType?.includes("audio-to-word") ||
    question?.questionType === "image-to-word" ||
    question?.questionType === "audio-to-image" ||
    question?.questionType === "word-to-image" ||
    question?.questionType === "image-to-meaning" ||
    question?.questionType === "word-to-meaning" ||
    question?.questionType === "word-spell"
  );
}

function isWordImageOptionQuestion(question) {
  return question?.questionType === "audio-to-image" || question?.questionType === "word-to-image";
}

function isImageMeaningQuestion(question) {
  return question?.questionType === "image-to-meaning";
}

function isSentenceQuestion(question) {
  return Boolean(question?.questionType?.includes("sentence") || isReadingOrDialogueQuestion(question));
}

function isReadingQuestion(question) {
  return Boolean(question?.questionType?.startsWith("reading-"));
}

function isDialogueQuestion(question) {
  return Boolean(question?.questionType?.includes("dialogue"));
}

function normalizeDialogueOptionText(value) {
  return String(value || "").replace(/[\s、。！？?！,.，・]/g, "");
}

function getDialogueOptionAudio(option) {
  const direct = dialogueOptionAudio[option];
  if (direct) return direct;
  const normalized = normalizeDialogueOptionText(option);
  return Object.entries(dialogueOptionAudio).find(([key]) => normalizeDialogueOptionText(key) === normalized)?.[1] || null;
}

function shouldRenderOptionAudio(question, option) {
  return question?.questionType === "dialogue-response" && KANA_TEXT_PATTERN.test(String(option || "")) && Boolean(getDialogueOptionAudio(option));
}

function isReadingOrDialogueQuestion(question) {
  return isReadingQuestion(question) || isDialogueQuestion(question);
}

function getQuestionUiFamily(question) {
  const questionType = question?.questionType || "";
  if (questionType === "handwriting-check") return "handwriting";
  if (isSpeechQuestion(question)) return "speaking";
  if (questionType === "sentence-order" || questionType === "word-spell") return "builder";
  if (questionType === "romaji-input" || questionType === "kana-input") return "input";
  if (questionType === "pair-match") return "matching";
  if (isReadingQuestion(question)) return "reading";
  if (questionType === "dialogue-response") return "dialogue";
  if (questionType.startsWith("audio-to") || questionType === "kana-to-sound") return "listening";
  if (isDialogueQuestion(question)) return "listening";
  if (questionType === "image-to-word" || questionType === "image-to-meaning" || questionType === "audio-to-image" || questionType === "word-to-image") {
    return "visual";
  }
  if (isSentenceQuestion(question)) return "usage";
  if (isWordChoiceQuestion(question)) return "vocabulary";
  return "choice";
}

function getQuestionUiFamilyFromScreen(screen) {
  const className = screen?.className || "";
  const match = String(className).match(/\bquestion-ui-([a-z-]+)/);
  return match?.[1] || null;
}

function shouldShowWordOptionHint(question) {
  return (
    isWordChoiceQuestion(question) &&
    question?.questionType !== "image-to-word" &&
    question?.questionType !== "image-to-meaning" &&
    question?.questionType !== "word-to-meaning" &&
    question?.questionType !== "word-spell"
  );
}

function getReadingCardTitle(question, focusKnowledge) {
  if (!question || !focusKnowledge) return "先听一遍";
  if (isDialogueQuestion(question)) return "先听对话";
  if (isReadingQuestion(question)) return "先听短文";
  if (question.questionType?.startsWith("speech")) return "听范例";
  if (question.questionType?.includes("audio-to")) return "先听一遍";
  if (isSentenceQuestion(question)) return "先听句子";
  if (isWordChoiceQuestion(question)) return "先听词语";
  if (
    question.questionType === "romaji-input" ||
    question.questionType === "kana-input" ||
    question.questionType === "katakana-to-hiragana" ||
    question.noRomaji
  ) {
    return "听发音";
  }
  return "先听一遍";
}

function getReadingCardDescription(question, focusKnowledge) {
  return "";
}

function getPuzzleHeader(level, question) {
  if (question?.questionType === "handwriting-check") {
    return { title: "写法抽查", subtitle: "" };
  }

  if (isWordChoiceQuestion(question)) {
    return { title: "词语巩固", subtitle: "" };
  }

  if (isReadingQuestion(question)) {
    return { title: "短文阅读", subtitle: "" };
  }

  if (isDialogueQuestion(question)) {
    return { title: "短对话", subtitle: "" };
  }

  if (isSentenceQuestion(question)) {
    return { title: "句型练习", subtitle: "" };
  }

  if (question?.questionType?.includes("audio-to-kana")) {
    return { title: "听音练习", subtitle: "" };
  }

  if (question?.questionType === "katakana-to-hiragana") {
    return { title: "同音练习", subtitle: "" };
  }

  if (question?.questionType === "romaji-input") {
    return { title: "读音练习", subtitle: "" };
  }

  if (question?.questionType === "kana-input") {
    return { title: "假名输入", subtitle: "" };
  }

  if (question?.questionType === "kana-to-sound") {
    return { title: "规则练习", subtitle: "" };
  }

  if (question?.questionType === "pair-match") {
    return { title: "连线练习", subtitle: "" };
  }

  return { title: level.title, subtitle: level.subtitle };
}

function getPuzzleModeLabel(mode) {
  const labels = {
    intro: "入门引导",
    "single-vowel-tile": "单音花砖",
    "vowel-chain-tile": "元音花径",
    "kana-chain-tile": "假名花径",
    "memory-review-gate": "元音花篮",
    "word-review-gate": "词语巩固",
    "same-sound-new-shape": "同音新形",
    "final-review-gate": "总复习",
    "cumulative-review-gate": "花园回顾",
    "sentence-review-gate": "句型练习",
    "conversation-mission-gate": "会话任务",
    "sound-rule-tile": "规则练习",
  };
  return labels[mode] || "花园挑战";
}

function getQuestionCelebration(question, isCorrect) {
  return getQuestionFeedbackCopy(question, isCorrect);
}

function getQuestionTargetKnowledge(question) {
  return knowledge.find((item) => item.id === question?.knowledgeIds?.[0]) || null;
}

function getRemedialSession(session, question, nextQuestionWrongAttempts, nextLevelWrongAttempts) {
  const target = getQuestionTargetKnowledge(question);
  const level = getLevelById(session.levelId);
  const remedialMode = target?.type === "word" ? "word" : target?.type === "sentence" ? "sentence" : "kana";
  const needsHandwriting = remedialMode === "kana" && levelAllowsHandwriting(level) && canUseHandwritingForItem(target);
  return {
    ...session,
    remedialMode,
    remedialKnowledgeId: target?.id || question?.knowledgeIds?.[0] || null,
    studySeen: remedialMode !== "kana" ? session.studySeen : false,
    practiceSeen: remedialMode !== "kana" ? session.practiceSeen : false,
    handwritingDemoSeen: remedialMode !== "kana" ? session.handwritingDemoSeen : !needsHandwriting,
    handwritingTraceDone: remedialMode !== "kana" ? session.handwritingTraceDone : !needsHandwriting,
    handwritingDone: remedialMode !== "kana" ? session.handwritingDone : !needsHandwriting,
    readyForQuiz: remedialMode === "sentence",
    wordReviewSeen: remedialMode !== "word",
    wordReviewRound: 0,
    wordReviewIndex: 0,
    answered: false,
    failed: false,
    selectedAnswer: null,
    selectedPairLeft: null,
    pairWrong: null,
    pairMatches: [],
    sentenceOrder: [],
    typedAnswer: "",
    speechRecording: false,
    speechRecorded: false,
    speechPassed: false,
    speechDurationMs: 0,
    speechTranscript: "",
    speechEngine: "",
    questionWrongAttempts: nextQuestionWrongAttempts,
    levelWrongAttempts: nextLevelWrongAttempts,
    autoPlayedQuestionId: null,
    autoPlayedStudyKey: null,
    feedback: "",
    celebration: null,
    autoAdvance: false,
  };
}

function applyQuestionResult(session, currentQuestion, answer, isCorrect) {
  updateLearningRecord(currentQuestion, isCorrect);
  const level = getLevelById(session.levelId);
  const usesMistakeChances = levelUsesMistakeChances(level);
  const levelQuestions = getSessionQuestions(session);
  const isLastQuestion = session.questionIndex >= levelQuestions.length - 1;
  const nextQuestionWrongAttempts = isCorrect ? 0 : (session.questionWrongAttempts || 0) + 1;
  const nextLevelWrongAttempts = isCorrect
    ? session.levelWrongAttempts || 0
    : usesMistakeChances
      ? (session.levelWrongAttempts || 0) + 1
      : session.levelWrongAttempts || 0;
  const hasRetriesLeft = !isCorrect && (!usesMistakeChances || nextLevelWrongAttempts < MAX_QUESTION_RETRIES);

  if (hasRetriesLeft) {
    audioService.playUiCue("wrong");
    state = {
      ...state,
      playSession: {
        ...session,
        answered: false,
        failed: false,
        selectedAnswer: answer,
        pairWrong: session.pairWrong,
        questionWrongAttempts: nextQuestionWrongAttempts,
        levelWrongAttempts: nextLevelWrongAttempts,
        autoPlayedQuestionId: null,
        feedback: getRetryFeedbackTextForQuestion(currentQuestion),
        celebration: getQuestionCelebration(currentQuestion, false),
        autoAdvance: false,
      },
    };
    render();
    return;
  }

  if (!isCorrect && usesMistakeChances) {
    audioService.playUiCue("wrong");
    state = {
      ...state,
      playSession: getRemedialSession(session, currentQuestion, nextQuestionWrongAttempts, nextLevelWrongAttempts),
    };
    render();
    return;
  }

  audioService.playUiCue(isCorrect && isLastQuestion ? "complete" : isCorrect ? "correct" : "wrong");
  const penalizedCorrectCount = session.correctCount + 1;

  state = {
    ...state,
    playSession: {
      ...session,
      answered: true,
      failed: !isCorrect,
      selectedAnswer: answer,
      correctCount: penalizedCorrectCount,
      autoPlayedQuestionId: null,
      questionWrongAttempts: nextQuestionWrongAttempts,
      levelWrongAttempts: nextLevelWrongAttempts,
      celebration: getQuestionCelebration(currentQuestion, isCorrect),
      autoAdvance: isCorrect,
      feedback: isCorrect
        ? isLastQuestion
          ? "很棒，继续摘下一朵。"
          : "很稳，继续。"
        : "差一点，这关再来一遍哦。",
    },
  };
  render();

  if (isCorrect) {
    const sessionToken = state.playSession?.sessionToken;
    window.setTimeout(() => {
      const latestSession = state.playSession;
      if (
        state.route !== "puzzle" ||
        !latestSession ||
        latestSession.sessionToken !== sessionToken ||
        latestSession.levelId !== session.levelId ||
        latestSession.questionIndex !== session.questionIndex
      ) {
        return;
      }
      moveToNextQuestion({
        ...latestSession,
        answered: true,
        failed: false,
        correctCount: penalizedCorrectCount,
      });
    }, HANDWRITING_ADVANCE_DELAY_MS);
  }
}

function moveToNextQuestion(session) {
  const levelQuestions = getSessionQuestions(session);

  if (session.questionIndex >= levelQuestions.length - 1) {
    completeLevel(session.levelId, getStars(session.correctCount, levelQuestions.length));
    return;
  }

  audioService.playUiCue("click");
  state = {
    ...state,
    playSession: {
      ...session,
      questionIndex: session.questionIndex + 1,
      answered: false,
      failed: false,
      autoPlayedQuestionId: null,
      selectedAnswer: null,
      selectedPairLeft: null,
      pairWrong: null,
      pairMatches: [],
      sentenceOrder: [],
      typedAnswer: "",
      speechRecording: false,
      speechRecorded: false,
      speechPassed: false,
      speechDurationMs: 0,
      speechTranscript: "",
      speechEngine: "",
      questionWrongAttempts: 0,
      levelWrongAttempts: session.levelWrongAttempts || 0,
      feedback: "",
      celebration: null,
      autoAdvance: false,
    },
  };
  render();
}

function advanceCorrectQuestion(session, currentQuestion, options = {}) {
  const shouldDelay = options.delay === true;
  updateLearningRecord(currentQuestion, true);
  const levelQuestions = getSessionQuestions(session);
  const nextCorrectCount = session.correctCount + 1;
  const isLastQuestion = session.questionIndex >= levelQuestions.length - 1;

  audioService.playUiCue(isLastQuestion ? "complete" : "correct");

  if (isLastQuestion) {
    state = {
      ...state,
      playSession: {
        ...session,
        correctCount: nextCorrectCount,
        answered: shouldDelay,
        failed: false,
        feedback: "",
        celebration: getQuestionCelebration(currentQuestion, true),
        autoAdvance: shouldDelay,
      },
    };
    if (shouldDelay) {
      const sessionToken = state.playSession?.sessionToken;
      window.setTimeout(() => {
        if (state.route !== "puzzle" || state.playSession?.sessionToken !== sessionToken) return;
        completeLevel(session.levelId, getStars(nextCorrectCount, levelQuestions.length));
      }, HANDWRITING_ADVANCE_DELAY_MS);
      render();
      return;
    }
    completeLevel(session.levelId, getStars(nextCorrectCount, levelQuestions.length));
    return;
  }

  state = {
    ...state,
    playSession: {
      ...session,
      correctCount: nextCorrectCount,
      answered: shouldDelay,
      failed: false,
      autoPlayedQuestionId: null,
      questionWrongAttempts: 0,
      levelWrongAttempts: session.levelWrongAttempts || 0,
      feedback: "",
      celebration: shouldDelay ? getQuestionCelebration(currentQuestion, true) : null,
      autoAdvance: shouldDelay,
    },
  };
  if (shouldDelay) {
    render();
    const sessionToken = state.playSession?.sessionToken;
    window.setTimeout(() => {
      if (
        state.route !== "puzzle" ||
        state.playSession?.sessionToken !== sessionToken ||
        state.playSession?.levelId !== session.levelId ||
        state.playSession?.questionIndex !== session.questionIndex
      ) {
        return;
      }
      moveToNextQuestion({
        ...state.playSession,
        answered: true,
        failed: false,
        correctCount: nextCorrectCount,
      });
    }, HANDWRITING_ADVANCE_DELAY_MS);
    return;
  }
  state = {
    ...state,
    playSession: {
      ...state.playSession,
      questionIndex: session.questionIndex + 1,
      answered: false,
      failed: false,
      autoPlayedQuestionId: null,
      selectedAnswer: null,
      selectedPairLeft: null,
      pairWrong: null,
      pairMatches: [],
      sentenceOrder: [],
      typedAnswer: "",
      speechRecording: false,
      speechRecorded: false,
      speechPassed: false,
      speechDurationMs: 0,
      speechTranscript: "",
      speechEngine: "",
      feedback: "",
      celebration: null,
      autoAdvance: false,
    },
  };
  render();
}

function getPairRightByLeft(question, left) {
  return question.pairs?.find((pair) => pair.left === left)?.right;
}

function shouldAutoPlayQuestionAudio(question) {
  if (!question?.audioKey) return false;
  return (
    question.questionType?.includes("audio-to") ||
    question.questionType === "katakana-to-hiragana" ||
    /听声音|听音|听读|听到|听句子/.test(question.questionText || "")
  );
}

function getQuestionReplayInfo(question, session = {}) {
  const limit = Number(question?.replayLimit || 0);
  if (!Number.isFinite(limit) || limit <= 0 || !question?.id) {
    return { limited: false, limit: 0, used: 0, remaining: Infinity };
  }
  const counts = session.replayCounts && typeof session.replayCounts === "object" ? session.replayCounts : {};
  const used = Math.max(0, Number(counts[question.id] || 0));
  return { limited: true, limit, used, remaining: Math.max(0, limit - used) };
}

function renderReplayLimitNote(question, session) {
  const replay = getQuestionReplayInfo(question, session);
  if (!replay.limited) return "";
  return `<small class="replay-limit-note">可重听 ${replay.remaining} 次</small>`;
}

function renderPetalMeter(correctCount, totalQuestions) {
  const total = Math.max(totalQuestions, 1);
  const visibleTotal = Math.min(total, 12);
  const activeCount = Math.round((Math.min(correctCount, total) / total) * visibleTotal);
  return `
    <div class="petal-meter" aria-label="花瓣进度 ${correctCount}/${total}">
      ${Array.from({ length: visibleTotal })
        .map((_, index) => `<span class="${index < activeCount ? "active" : ""}"></span>`)
        .join("")}
    </div>
  `;
}

function getLevelWordItems(level) {
  if (!level?.id) return [];
  const wordsByKana = new Map();
  knowledge
    .filter((item) => item.type === "word" && item.introducedAt === level.id)
    .sort((a, b) => a.unlockOrder - b.unlockOrder)
    .forEach((item) => {
      const existing = wordsByKana.get(item.kana);
      if (!existing || (existing.preview && !item.preview)) {
        wordsByKana.set(item.kana, item);
      }
    });
  const words = [...wordsByKana.values()].sort((a, b) => a.unlockOrder - b.unlockOrder);

  if (level.id === "level-1") return words.slice(0, 5);
  return words.filter((item) => !item.preview).slice(0, 4);
}

function getReviewWordItems(level) {
  if (!level?.id) return [];
  const allowed = new Set(level.allowedKnowledgeIds || []);
  return knowledge
    .filter((item) => item.type === "word" && allowed.has(item.id) && !item.preview)
    .sort((a, b) => a.unlockOrder - b.unlockOrder);
}

function renderWordVisual(item, className = "word-visual") {
  if (!item) return "";
  if (!item.imageSrc) {
    return `
      <span class="${className} is-empty" aria-hidden="true">
        <b>${item.kana?.slice(0, 1) || "詞"}</b>
      </span>
    `;
  }
  return `
    <span class="${className} ${item.visualType ? `visual-${item.visualType}` : ""}" aria-hidden="true">
      <img src="${item.imageSrc}" alt="${item.visualAlt || item.chinese || item.kana}" loading="lazy">
    </span>
  `;
}

function renderWordCardContent(item) {
  return `
    ${renderWordVisual(item)}
    <span class="word-card-copy">
      <strong>${item.kana}</strong>
      <span>${item.readingHint}</span>
      <small>${item.chinese}</small>
    </span>
  `;
}

function renderWordSeeds(level) {
  const wordItems = getLevelWordItems(level);
  if (!wordItems.length) return "";

  return `
    <section class="word-seed-panel" aria-label="本关词语">
      <div class="word-seed-heading">
        <span class="badge">能读的词</span>
        <small>点一下听读音</small>
      </div>
      <div class="word-seed-list">
        ${wordItems
          .map(
            (item) => `
              <button class="word-seed ${item.preview ? "is-preview" : ""}" data-audio-key="${item.audioKey}" ${item.audioSrc ? `data-audio-src="${item.audioSrc}"` : ""} aria-label="播放 ${item.kana}">
                ${renderWordCardContent(item)}
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderWordReview(level, session = {}) {
  const wordItems = getWordReviewItemsForSession(level, session);
  if (!wordItems.length) return "";
  const safeIndex = Math.min(Math.max(Number(session.wordReviewIndex || 0), 0), wordItems.length - 1);
  const safeRound = Math.min(Math.max(Number(session.wordReviewRound || 0), 0), WORD_REVIEW_ROUNDS - 1);
  const currentWord = wordItems[safeIndex];
  const stepNumber = safeRound * wordItems.length + safeIndex + 1;
  const totalSteps = wordItems.length * WORD_REVIEW_ROUNDS;
  const isSingleWordReview = wordItems.length === 1;
  const roundTitle = safeRound === 0
    ? isSingleWordReview
      ? "先把这个词认熟"
      : `先认熟这 ${wordItems.length} 个词`
    : isSingleWordReview
      ? "再看一遍这个词"
      : "再记一遍";
  const roundHint = safeRound === 0 ? "先看图、听读音，等会儿再抽查。" : "看图想词，再听一遍确认。";

  return `
    <section class="word-review-panel" aria-label="词语复现">
      <div class="word-review-heading">
        <span class="badge">词语 ${stepNumber}/${totalSteps}</span>
        <h2>${roundTitle}</h2>
        <p>${roundHint}</p>
      </div>
      <article class="word-review-focus">
        ${renderWordVisual(currentWord, "word-focus-visual")}
        <button class="sound-button large" data-audio-key="${currentWord.audioKey}" ${currentWord.audioSrc ? `data-audio-src="${currentWord.audioSrc}"` : ""} aria-label="播放 ${currentWord.kana}">▶</button>
        <div class="word-review-focus-copy">
          <strong>${currentWord.kana}</strong>
          <span>${currentWord.readingHint}</span>
          <small>${currentWord.chinese}</small>
        </div>
      </article>
      <div class="word-review-list">
        ${wordItems
          .map(
            (item) => `
              <button class="word-review-card ${item.id === currentWord.id ? "is-active" : ""}" data-audio-key="${item.audioKey}" ${item.audioSrc ? `data-audio-src="${item.audioSrc}"` : ""} aria-label="播放 ${item.kana}">
                ${renderWordCardContent(item)}
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderQuestionControls(question, session) {
  if (question.questionType === "handwriting-check") return renderHandwritingQuestion(question, session);
  if (isSpeechQuestion(question)) return renderSpeechQuestion(question, session);
  if (question.questionType === "romaji-input") return renderRomajiInputQuestion(question, session);
  if (question.questionType === "kana-input") return renderKanaInputQuestion(question, session);
  if (question.questionType === "pair-match") return renderPairMatchQuestion(question, session);
  if (question.questionType === "sentence-order" || question.questionType === "word-spell") return renderSentenceOrderQuestion(question, session);
  return renderOptionQuestion(question, session);
}

function renderQuestionBottomAction(question, session) {
  if (!question || session.answered) return "";
  if (question.questionType === "handwriting-check") {
    return `<button class="primary-button full" data-submit-handwriting-question="${question.id}" disabled>OK</button>`;
  }
  if (question.questionType === "romaji-input") {
    return `<button class="primary-button full" data-submit-romaji="${question.id}">OK</button>`;
  }
  if (question.questionType === "kana-input") {
    return `<button class="primary-button full" data-submit-kana="${question.id}">OK</button>`;
  }
  if (question.questionType === "sentence-order" || question.questionType === "word-spell") {
    const selected = Array.isArray(session.sentenceOrder) ? session.sentenceOrder : [];
    const isReady = selected.length === (question.chunks?.length || getSessionOptions(session, question).length);
    return `<button class="primary-button full" data-submit-sentence-order="${question.id}" ${isReady ? "" : "disabled"}>OK</button>`;
  }
  if (isSpeechQuestion(question)) {
    return `<button class="primary-button full" data-submit-speech="${question.id}" ${session.speechPassed ? "" : "disabled"}>OK</button>`;
  }
  return "";
}

function isSpeechQuestion(question) {
  return ["speech-kana", "speech-word", "speech-sentence", "speech-response", "speech-intent", "shadowing-repeat"].includes(question?.questionType);
}

function canRenderHandwritingQuestion(question) {
  const level = getLevelById(question?.levelId);
  const focusKnowledge = getQuestionTargetKnowledge(question);
  return Boolean(question?.questionType === "handwriting-check" && levelAllowsHandwriting(level) && canUseHandwritingForItem(focusKnowledge));
}

function getWordReviewItemsForSession(level, session = {}) {
  if (session?.remedialMode === "word" && session.remedialKnowledgeId) {
    const target = knowledge.find((item) => item.id === session.remedialKnowledgeId && item.type === "word");
    return target ? [target] : [];
  }
  return getReviewWordItems(level);
}

function renderHandwritingQuestion(question, session) {
  const focusKnowledge = knowledge.find((item) => item.id === question.knowledgeIds?.[0]);
  if (!focusKnowledge || !canRenderHandwritingQuestion(question)) return `<section class="empty-panel"><strong>这一题暂时无法显示</strong></section>`;
  return `
    <section class="inline-handwriting-panel">
      ${renderWritingPad(focusKnowledge, "review")}
      <div class="handwriting-reset-row">
        <button class="secondary-button full" data-clear-handwriting ${session.answered ? "disabled" : ""}>重写</button>
      </div>
    </section>
  `;
}

function renderOptionQuestion(question, session) {
  const options = getSessionOptions(session, question);
  const denseImageGrid = isWordImageOptionQuestion(question) && options.length > 4;
  return `
    <section class="option-grid ${denseImageGrid ? "is-dense-image-grid" : ""}">
      ${options
        .map((option) => {
          const optionKnowledge = getOptionKnowledge(question, option);
          const showWordOptionHint = shouldShowWordOptionHint(question) && optionKnowledge;
          const showImageOption = isWordImageOptionQuestion(question) && optionKnowledge;
          const isSelected = session.selectedAnswer === option;
          const isCorrect = session.answered && option === question.correctAnswer;
          const isWrong = session.answered && isSelected && option !== question.correctAnswer;
          const hasLongOption = !showImageOption && [...String(option || "")].length >= 12;
          const isJapaneseOption = /[\u3040-\u30ff]/.test(String(option || ""));
          const optionAudio = shouldRenderOptionAudio(question, option) ? getDialogueOptionAudio(option) : null;
          const className = [
            isCorrect ? "is-correct" : "",
            isWrong ? "is-wrong" : "",
            hasLongOption ? "has-long-option" : "",
            isJapaneseOption ? "is-japanese-option" : "",
            optionAudio ? "has-option-audio" : "",
          ].filter(Boolean).join(" ");
          return `
            <button
              class="${className} ${showWordOptionHint ? "has-option-note" : ""} ${showImageOption ? "has-image-option" : ""}"
              data-answer="${option}"
              ${showImageOption ? `aria-label="${optionKnowledge.chinese || option}"` : ""}
              ${session.answered ? "disabled" : ""}
            >
              ${showWordOptionHint ? renderWordVisual(optionKnowledge, "option-word-visual") : ""}
              ${showImageOption ? "" : `<strong>${option}</strong>`}
              ${showImageOption ? renderImageMeaningLabel(optionKnowledge) : showWordOptionHint ? `<small>${optionKnowledge.chinese}</small>` : ""}
              ${
                optionAudio
                  ? `<span
                      class="option-audio-button"
                      role="button"
                      tabindex="0"
                      aria-label="播放回应"
                      data-option-audio-key="${optionAudio.audioKey}"
                      data-option-audio-src="${resolveAudioSrc(optionAudio.audioSrc, optionAudio.audioKey)}"
                    >▶</span>`
                  : ""
              }
            </button>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderRomajiInputQuestion(question, session) {
  const placeholder = getRomajiInputPlaceholder(question);
  const maxLength = getRomajiInputMaxLength(question, placeholder);
  return `
    <section class="romaji-input-panel">
      <input
        type="text"
        inputmode="latin"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="done"
        maxlength="${maxLength}"
        data-romaji-input
        value="${session.typedAnswer || ""}"
        placeholder="${placeholder}"
        ${session.answered ? "disabled" : ""}
      >
    </section>
  `;
}

function renderKanaInputQuestion(question, session) {
  const placeholder = getKanaInputPlaceholder(question);
  const maxLength = getKanaInputMaxLength(question);
  return `
    <section class="romaji-input-panel kana-input-panel">
      <input
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="done"
        maxlength="${maxLength}"
        data-kana-input
        value="${session.typedAnswer || ""}"
        placeholder="${placeholder}"
        ${session.answered ? "disabled" : ""}
      >
    </section>
  `;
}

function renderSpeechQuestion(question, session) {
  const focusKnowledge = knowledge.find((item) => item.id === question.knowledgeIds?.[0]);
  const durationText = session.speechDurationMs ? `${Math.round(session.speechDurationMs / 100) / 10}s` : "";
  const isResponseSpeech = question.questionType === "speech-response";
  const isIntentSpeech = question.questionType === "speech-intent";
  const startLabel = isResponseSpeech ? "回应" : isIntentSpeech ? "说一句" : "跟读";
  return `
    <div class="speech-practice-stack">
      <section class="speech-practice-panel" data-speech-question="${question.id}">
        <div class="speech-actions">
          ${
            question.contextAudioKey
              ? `<button class="secondary-button" data-speech-play-target="${question.id}" data-audio-key="${question.contextAudioKey}" data-audio-src="${resolveAudioSrc(question.contextAudioSrc, question.contextAudioKey)}">听对话</button>`
              : ""
          }
          ${
            question.audioKey
              ? `<button class="secondary-button" data-speech-play-target="${question.id}" data-audio-key="${question.audioKey}" data-audio-src="${resolveAudioSrc(question.audioSrc, question.audioKey)}">${isResponseSpeech ? "听回应" : "听范例"}</button>`
              : ""
          }
          ${
            session.speechRecording
              ? `<button class="primary-button" data-speech-stop="${question.id}">停止录音</button>`
              : `<button class="primary-button" data-speech-start="${question.id}" ${session.answered ? "disabled" : ""}>${startLabel}</button>`
          }
          <button class="secondary-button" data-speech-play-recording="${question.id}" ${session.speechRecorded ? "" : "disabled"}>回放我的声音</button>
        </div>
        <div class="speech-status">
          <span>${session.speechRecording ? "正在录音" : session.speechRecorded ? "已录音" : "未录音"}</span>
          ${durationText ? `<strong>${durationText}</strong>` : ""}
          ${session.speechEngine ? `<small>已完成</small>` : ""}
        </div>
        ${
          session.speechTranscript
            ? `<p class="speech-transcript">听到：${session.speechTranscript}</p>`
            : `<p class="speech-transcript">录音后显示结果。</p>`
        }
      </section>
    </div>
  `;
}

function renderSpeechTarget(question, focusKnowledge) {
  const display = getSpeechTargetDisplay(question, focusKnowledge);
  return `
    <div class="speech-target">
      <span>${getSpeechQuestionLabel(question)}</span>
      ${display.contextText ? `<small class="speech-context">${display.contextText}</small>` : ""}
      <strong>${display.targetText}</strong>
      ${display.targetHint ? `<small>${display.targetHint}</small>` : ""}
    </div>
  `;
}

function getSpeechTargetDisplay(question, focusKnowledge) {
  const targetText = question.speechTarget || focusKnowledge?.kana || focusKnowledge?.japanese || question.correctAnswer || "";
  const targetHint = question.speechHint || focusKnowledge?.chinese || "";
  const isIntentSpeech = question.questionType === "speech-intent";
  return {
    contextText: question.contextText || "",
    targetText: isIntentSpeech ? question.intentText || targetHint || "说出这句话" : targetText,
    targetHint: isIntentSpeech ? question.intentHint || "" : targetHint,
  };
}

function getSpeechQuestionLabel(question) {
  if (question?.questionType === "speech-kana") return "读这个假名";
  if (question?.questionType === "speech-word") return "读这个词";
  if (question?.questionType === "speech-sentence") return "读这句话";
  if (question?.questionType === "speech-response") return "听后回应";
  if (question?.questionType === "speech-intent") return "按意图说";
  return "跟读一遍";
}

function renderSentenceOrderQuestion(question, session) {
  const selected = Array.isArray(session.sentenceOrder) ? session.sentenceOrder : [];
  const options = getSessionOptions(session, question);
  const tokens = getOrderTokens(options);
  return `
    <section class="sentence-order-panel">
      <div class="sentence-order-target" aria-label="已选择的词块">
        ${
          selected.length
            ? selected
                .map(
                  (chunk, index) => `
                    <button type="button" data-order-remove="${index}" ${session.answered ? "disabled" : ""}>
                      ${getOrderSelectionLabel(chunk, tokens)}
                    </button>
                  `,
                )
                .join("")
            : `<span>${question.questionType === "word-spell" ? "先点下面的假名" : "先点下面的词"}</span>`
        }
      </div>
      <div class="sentence-order-options" aria-label="可选择的词块">
        ${tokens
          .map((token) => {
            const used = selected.includes(token.key) || selected.includes(token.chunk);
            return `
              <button type="button" data-order-token="${token.key}" ${session.answered || used ? "disabled" : ""}>
                ${token.chunk}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function getOrderTokens(options) {
  return (options || []).map((chunk, index) => ({
    chunk,
    key: `${index}:${chunk}`,
  }));
}

function getOrderSelectionLabel(entry, tokens) {
  const value = String(entry || "");
  const separatorIndex = value.indexOf(":");
  if (separatorIndex > 0) {
    const tokenIndex = Number(value.slice(0, separatorIndex));
    if (Number.isInteger(tokenIndex) && tokens[tokenIndex]?.key === value) return tokens[tokenIndex].chunk;
    return value.slice(separatorIndex + 1);
  }
  return value;
}

function getRomajiInputMaxLength(question, placeholder) {
  const answerLength = String(question.correctAnswer || "").length;
  const hintLength = Math.max(...placeholder.split(" / ").map((item) => item.length), 3);
  return Math.max(answerLength, hintLength, 3);
}

function getRomajiInputPlaceholder(question) {
  const target = knowledge.find((item) => item.id === question.knowledgeIds?.[0]);
  const answer = String(question.correctAnswer || target?.romaji || "").trim();
  const level = getLevelById(question.levelId);
  if (isMixedRomajiInputLevel(level, target)) return "输入读音";
  const candidates = getRomajiPlaceholderCandidates(target, answer);
  if (candidates.length) return candidates.join(" / ");
  if (answer.includes("-")) return "small-tsu";
  if (answer.length >= 3) return "kya / kyu / kyo";
  if (answer.length === 2) return "ka / ki / ku / ke / ko";
  return "输入读音";
}

function getKanaInputMaxLength(question) {
  return Math.max(Array.from(String(question.correctAnswer || "")).length + 2, 3);
}

function getKanaInputPlaceholder(question) {
  if (question.inputScript === "katakana") return "输入片假名";
  if (question.inputScript === "hiragana") return "输入平假名";
  return "输入假名";
}

function normalizeKanaInputAnswer(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function isMixedRomajiInputLevel(level, target) {
  if (!level || !target) return true;
  if (level.puzzleMode === "cumulative-review-gate" || level.puzzleMode === "final-review-gate") return true;
  const rowMatch = level.id.match(/^level-row-([a-z]+)-review$/);
  if (!rowMatch) return true;
  return rowMatch[1] !== target.row;
}

function getRomajiPlaceholderCandidates(target, answer) {
  if (!target) return [];
  const sameScope = knowledge
    .filter((item) => {
      if (item.type !== "kana" || !item.romaji) return false;
      if (target.row && item.row !== target.row) return false;
      if (target.level && item.level !== target.level) return false;
      if (target.script && item.script !== target.script) return false;
      if (target.category && item.category !== target.category) return false;
      return true;
    })
    .sort((a, b) => (a.unlockOrder || 0) - (b.unlockOrder || 0))
    .map((item) => item.romaji);
  const scoped = uniqueRomaji(sameScope);
  if (scoped.length > 0 && scoped.length <= 5) return scoped;
  if (answer.includes("-")) return uniqueRomaji(scoped.filter((item) => item.includes("-"))).slice(0, 5);
  if (answer.length >= 3) {
    const familyPrefix = answer.replace(/[auo]$/, "");
    const family = scoped.filter((item) => item.replace(/[auo]$/, "") === familyPrefix);
    if (family.length >= 2 && family.length <= 5) return family;
  }
  if (answer.length === 2) {
    const consonant = answer.replace(/[aiueo]$/, "");
    const family = scoped.filter((item) => item.replace(/[aiueo]$/, "") === consonant);
    if (family.length >= 2 && family.length <= 5) return family;
  }
  return scoped.slice(0, 5);
}

function uniqueRomaji(items) {
  return [...new Set(items.filter(Boolean))];
}

function shouldShowReadingCard(question, focusKnowledge) {
  return (
    Boolean(focusKnowledge) &&
    !isSpeechQuestion(question) &&
    question?.questionType !== "image-to-word" &&
    question?.questionType !== "pair-match" &&
    question?.questionType !== "kana-to-sound" &&
    question?.questionType !== "handwriting-check"
  );
}

function shouldShowQuestionHeading(question, focusKnowledge) {
  if (!question?.questionText) return false;
  if (isWordChoiceQuestion(question)) return false;
  if (isSentenceQuestion(question)) return false;
  if (isSpeechQuestion(question)) return false;
  if (question.questionType?.includes("audio-to-kana")) return false;
  if (
    [
      "romaji-input",
      "kana-input",
      "katakana-to-hiragana",
      "kana-to-sound",
      "pair-match",
      "handwriting-check",
    ].includes(question.questionType)
  ) {
    return false;
  }
  if (!shouldShowReadingCard(question, focusKnowledge)) return true;
  return false;
}

function isMaterialChoiceQuestion(question) {
  return Boolean(isReadingOrDialogueQuestion(question) && !question?.questionType?.includes("audio-to"));
}

function isAudioPairQuestion(question) {
  return question?.questionType === "pair-match" && /读音|声音/.test(question.pairLabel || "");
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLearningStats() {
  return state.save.learningStats || {
    totalActiveSeconds: 0,
    totalActions: 0,
    totalCorrect: 0,
    totalWrong: 0,
    currentStreak: 0,
    bestStreak: 0,
    completedLevels: 0,
    lastActionAt: null,
    daily: {},
    recentResults: [],
  };
}

function recordLearningActivity({ isCorrect = null, actionType = "practice", levelCleared = false } = {}) {
  const now = Date.now();
  const today = getTodayKey();
  const stats = getLearningStats();
  const previousTime = stats.lastActionAt ? Date.parse(stats.lastActionAt) : null;
  const activeSeconds = previousTime ? Math.max(4, Math.min(45, Math.round((now - previousTime) / 1000))) : 8;
  const todayStats = stats.daily?.[today] || {
    activeSeconds: 0,
    actions: 0,
    correct: 0,
    wrong: 0,
    cleared: 0,
  };
  const isAnswer = typeof isCorrect === "boolean";
  const nextCurrentStreak = isAnswer ? (isCorrect ? (stats.currentStreak || 0) + 1 : 0) : stats.currentStreak || 0;

  const nextStats = {
    ...stats,
    totalActiveSeconds: (stats.totalActiveSeconds || 0) + activeSeconds,
    totalActions: (stats.totalActions || 0) + 1,
    totalCorrect: (stats.totalCorrect || 0) + (isCorrect === true ? 1 : 0),
    totalWrong: (stats.totalWrong || 0) + (isCorrect === false ? 1 : 0),
    currentStreak: nextCurrentStreak,
    bestStreak: Math.max(stats.bestStreak || 0, nextCurrentStreak),
    completedLevels: (stats.completedLevels || 0) + (levelCleared ? 1 : 0),
    lastActionAt: new Date(now).toISOString(),
    daily: {
      ...(stats.daily || {}),
      [today]: {
        ...todayStats,
        activeSeconds: (todayStats.activeSeconds || 0) + activeSeconds,
        actions: (todayStats.actions || 0) + 1,
        correct: (todayStats.correct || 0) + (isCorrect === true ? 1 : 0),
        wrong: (todayStats.wrong || 0) + (isCorrect === false ? 1 : 0),
        cleared: (todayStats.cleared || 0) + (levelCleared ? 1 : 0),
      },
    },
    recentResults: [
      {
        at: new Date(now).toISOString(),
        actionType,
        isCorrect,
        activeSeconds,
      },
      ...(stats.recentResults || []),
    ].slice(0, 30),
  };

  state.save = {
    ...state.save,
    learningStats: nextStats,
  };
  return nextStats;
}

function getRecentPerformance(stats = getLearningStats(), windowSize = 10) {
  const recentAnswers = (stats.recentResults || []).filter((item) => typeof item.isCorrect === "boolean").slice(0, windowSize);
  const attempts = recentAnswers.length;
  const correct = recentAnswers.filter((item) => item.isCorrect).length;
  const wrong = attempts - correct;
  return {
    attempts,
    correct,
    wrong,
    accuracy: attempts ? correct / attempts : 1,
    currentStreak: stats.currentStreak || 0,
  };
}

function pickEncouragement(lines, seedParts = []) {
  if (!lines.length) return "";
  const seed = seedParts.join("|");
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return lines[hash % lines.length];
}

function getEncouragementLines(question, isCorrect, stats = getLearningStats()) {
  const performance = getRecentPerformance(stats);
  const doingWell = performance.attempts >= 5 && performance.accuracy >= 0.85;
  const needsWarmth = performance.attempts >= 4 && performance.accuracy < 0.55;
  const streak = performance.currentStreak;

  if (!isCorrect) {
    if (question?.questionType === "handwriting-check") {
      return needsWarmth
        ? ["别急，慢慢写就会顺。", "这一笔放慢一点，很快能稳住。", "先稳住笔顺，再来一次。"]
        : ["慢一点，再稳一笔。", "差一点点，重新来。", "这笔还可以更顺。"];
    }
    if (isWordChoiceQuestion(question)) {
      return needsWarmth
        ? ["没关系，再听一遍就会更熟。", "耳朵还在找感觉，慢慢来。", "这个词多听几次就稳了。"]
        : question.questionType === "image-to-word"
          ? ["差一点，再看一眼。", "很接近了，看清楚再选。", "这张图再认一次。"]
          : ["差一点，再听一遍。", "很接近了，重新听一下。", "这次先听完整再选。"];
    }
    if (question?.questionType?.includes("audio-to-kana")) {
      return needsWarmth
        ? ["没关系，这个音多听几次就熟。", "耳朵正在记住它，再来。", "慢慢听，声音会越来越清楚。"]
        : ["差一点，再听一次。", "很接近了，重新听一下。", "先听清楚，再点假名。"];
    }
    if (question?.questionType === "katakana-to-hiragana") {
      return needsWarmth
        ? ["读音是一样的，多对几次就熟。", "先听一下这个音，再找平假名。", "形状不同，声音是同一个。"]
        : ["差一点，读音相同，再试一次。", "很接近了，再找对应的平假名。", "先听这个音，再选平假名。"];
    }
    if (question?.questionType === "kana-input") {
      return needsWarmth
        ? ["看清楚平片假名的对应形状，再打一遍。", "声音相同，形状换一下就对上了。", "别急，先想同音的另一个假名。"]
        : ["差一点，再输入对应假名。", "很接近了，平片假名再换一次。", "先看形状，再打一遍。"];
    }
    if (question?.questionType === "pair-match" && isAudioPairQuestion(question)) {
      return needsWarmth
        ? ["先点一下假名听声音，再慢慢连。", "这个音再听几遍，就会对上。", "别急，声音和形状正在连起来。"]
        : ["差一点，再听一下。", "声音很接近，重新连一次。", "先听清楚，再选右边。"];
    }
    if (question?.questionType === "sentence-order") {
      return needsWarmth
        ? ["先找开头，再把动作放到后面。", "词块慢慢排，句子就顺了。", "先看意思，再排日语词块。"]
        : ["差一点，词块顺序再调一下。", "很接近了，先找句子开头。", "再排一次，注意助词位置。"];
    }
    return needsWarmth
      ? ["没关系，慢慢就熟了。", "差一点点，先看一眼再来。", "别急，这个音快记住了。"]
      : ["差一点，再来一次哦。", "差一点点，再看一眼。", "没关系，再来一遍。"];
  }

  const strongLines = streak >= 5 || doingWell ? ["OK", "很好", "继续"] : [];
  if (question?.questionType === "handwriting-check") return [...strongLines, "OK"];
  if (isSpeechQuestion(question)) return [...strongLines, "OK"];
  if (question?.questionType === "pair-match") return [...strongLines, "OK"];
  if (question?.questionType === "sentence-order") return [...strongLines, "OK"];
  if (question?.questionType === "romaji-input") return [...strongLines, "OK"];
  if (question?.questionType === "kana-input") return [...strongLines, "OK"];
  if (question?.questionType === "image-to-word") return [...strongLines, "OK"];
  if (question?.questionType?.includes("audio-to")) return [...strongLines, "OK"];
  return [...strongLines, "OK"];
}

function getQuestionFeedbackCopy(question, isCorrect) {
  const stats = getLearningStats();
  const title = pickEncouragement(getEncouragementLines(question, isCorrect, stats), [
    question?.id,
    stats.totalActions,
    stats.currentStreak,
    isCorrect ? "ok" : "retry",
  ]);
  const performance = getRecentPerformance(stats);
  if (!isCorrect) {
    return {
      type: "try-again",
      title,
      message: performance.accuracy < 0.55 ? "多遇见几次，就会熟起来。" : "再来一次就好。",
    };
  }
  return { type: "success", title, message: "继续" };
}

function getPairMatchProgressText(question) {
  return pickEncouragement(getEncouragementLines(question, true), [
    question?.id,
    state.playSession?.pairMatches?.length || 0,
    Date.now().toString().slice(-4),
  ]);
}

function clearTransientFeedback(session, overrides = {}) {
  return {
    ...session,
    feedback: "",
    celebration: null,
    autoAdvance: false,
    ...overrides,
  };
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }
  try {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "readonly");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  } catch {
    return false;
  }
}

function getRetryFeedbackText() {
  return getRetryFeedbackTextForQuestion(null);
}

function getRetryFeedbackTextForQuestion(question) {
  const performance = getRecentPerformance();
  if (isWordChoiceQuestion(question)) {
    if (question?.questionType === "image-to-word") return "差一点，再看一眼。";
    if (performance.accuracy < 0.55 && performance.attempts >= 4) return "再听一遍这个词，慢慢来。";
    return "差一点，再听一遍。";
  }
  if (question?.questionType?.includes("audio-to-kana") || (question?.questionType === "pair-match" && isAudioPairQuestion(question))) {
    if (performance.accuracy < 0.55 && performance.attempts >= 4) return "这个音再听清楚一点。";
    return "差一点，再听一次。";
  }
  if (question?.questionType === "katakana-to-hiragana") return "差一点，读音相同，再找一次。";
  if (question?.questionType === "romaji-input") return "差一点，读音再想一下。";
  if (question?.questionType === "kana-input") return "差一点，输入对应的假名。";
  if (question?.questionType === "handwriting-check") return "差一点，慢慢写一遍哦。";
  if (isSpeechQuestion(question)) return "再录一遍，慢一点。";
  if (performance.accuracy < 0.55 && performance.attempts >= 4) return "这里多停一下，再看一眼。";
  if (performance.currentStreak >= 4) return "差一点，节奏还在。";
  return "差一点，再看一眼。";
}

function renderRetryChanceNote(level, session) {
  if (!levelUsesMistakeChances(level) || (session.levelWrongAttempts || 0) <= 0) return "";
  const remaining = Math.max(0, MAX_QUESTION_RETRIES - (session.levelWrongAttempts || 0));
  return `
    <small class="retry-note">
      <span>错误机会</span>
      <strong>${remaining}</strong>
      <span>次</span>
    </small>
  `;
}

function getPreviousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getPlayerLevel(exp = state.save.exp) {
  return Math.max(1, Math.floor(exp / 60) + 1);
}

function getPetLevel(exp = state.save.pet?.exp || 0) {
  return Math.max(1, Math.floor(exp / 45) + 1);
}

function getPetMood() {
  const level = getPetLevel();
  if (level >= 5) return "盛放";
  if (level >= 3) return "舒展";
  return "发芽";
}

function ensureDailyState() {
  const today = getTodayKey();
  if (state.save.daily?.date === today) return;

  const yesterday = getPreviousDateKey(today);
  const keptStreak = state.save.lastLoginDate === yesterday || state.save.daily?.date === yesterday;
  state.save = {
    ...state.save,
    dailyStreak: keptStreak ? (state.save.dailyStreak || 0) + 1 : 1,
    lastLoginDate: today,
    daily: {
      date: today,
      answered: 0,
      correct: 0,
      cleared: 0,
      claimed: false,
    },
  };
  saveGame(state.save);
}

function getDailyProgress() {
  const daily = state.save.daily || {};
  const answered = Math.min(daily.answered || 0, DAILY_GOAL.answered);
  const correct = Math.min(daily.correct || 0, DAILY_GOAL.correct);
  const cleared = Math.min(daily.cleared || 0, DAILY_GOAL.cleared);
  const tasks = [
    { label: "练习", value: answered, target: DAILY_GOAL.answered },
    { label: "答对", value: correct, target: DAILY_GOAL.correct },
    { label: "通关", value: cleared, target: DAILY_GOAL.cleared },
  ];
  const finished = tasks.every((task) => task.value >= task.target);
  return { tasks, finished, claimed: Boolean(daily.claimed) };
}

function formatActiveMinutes(seconds = 0) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds / 10) * 10 || 10)} 秒`;
  return `${Math.round(seconds / 60)} 分钟`;
}

function getTodayLearningStats() {
  const stats = getLearningStats();
  const todayStats = stats.daily?.[getTodayKey()] || { activeSeconds: 0, actions: 0, correct: 0, wrong: 0, cleared: 0 };
  const attempts = (todayStats.correct || 0) + (todayStats.wrong || 0);
  return {
    ...todayStats,
    attempts,
    accuracy: attempts ? todayStats.correct / attempts : 1,
  };
}

function getHomeEncouragement() {
  const stats = getLearningStats();
  const todayStats = getTodayLearningStats();
  const performance = getRecentPerformance(stats);
  if (!todayStats.actions) return "今天从一个声音开始。";
  if (performance.attempts >= 5 && performance.accuracy >= 0.85) return "今天很顺，继续摘下一朵。";
  if (performance.attempts >= 4 && performance.accuracy < 0.55) return "今天遇到的难点，正在变成熟悉。";
  if (performance.currentStreak >= 6) return "连着稳住了，手感很棒。";
  if (todayStats.cleared > 0) return `又通过 ${todayStats.cleared} 关，很厉害。`;
  if (todayStats.activeSeconds >= 300) return "已经练了一会儿，记忆开始沉下来了。";
  return "节奏不错，学一点就算一点。";
}

function getWeakKnowledgeItems(limit = 8) {
  const records = state.save.mastery || {};
  const wrongKnowledgeIds = new Set(getReviewWrongQuestions().flatMap((item) => item.knowledgeIds || []));
  return knowledge
    .filter((item) => records[item.id] || wrongKnowledgeIds.has(item.id))
    .map((item) => {
      const record = records[item.id] || { level: 0, correctCount: 0, wrongCount: 0, lastReviewedAt: null };
      return { item, record, score: (record.level || 0) * 3 + (record.correctCount || 0) - (record.wrongCount || 0) * 2 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

const wrongReviewCategories = [
  { id: "vocab", label: "词汇", hint: "假名、词语和含义" },
  { id: "grammar", label: "语法", hint: "句型、填空和排序" },
  { id: "listening", label: "听力", hint: "听词、听句和对话" },
  { id: "reading", label: "阅读", hint: "短文和信息匹配" },
];

function getWrongReviewCategory(entry) {
  const questionType = entry?.questionType || "";
  const items = (entry?.knowledgeIds || []).map((id) => knowledge.find((item) => item.id === id)).filter(Boolean);
  if (questionType.startsWith("reading") || items.some((item) => item.type === "reading")) return "reading";
  if (questionType.startsWith("audio-to") || questionType.startsWith("dialogue") || items.some((item) => item.type === "dialogue")) return "listening";
  if (questionType.startsWith("sentence") || items.some((item) => item.type === "grammar" || item.type === "sentence")) return "grammar";
  return "vocab";
}

function getWrongReviewGroups() {
  const groups = wrongReviewCategories.map((category) => ({ ...category, entries: [] }));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  for (const entry of getReviewWrongQuestions()) {
    const group = groupById.get(getWrongReviewCategory(entry)) || groupById.get("vocab");
    group.entries.push(entry);
  }
  return groups;
}

function formatReviewDueText(nextReviewAt) {
  const nextMs = toTime(nextReviewAt);
  if (!nextMs || nextMs <= Date.now()) return "现在可练";
  const days = Math.max(1, Math.ceil((nextMs - Date.now()) / DAY_MS));
  return days === 1 ? "明天再看" : `${days} 天后再看`;
}

function getReviewDimensionGroups() {
  const nowMs = Date.now();
  return REVIEW_DIMENSIONS.map((dimension) => {
    const knowledgeIds = getDimensionReviewKnowledgeIds(dimension.id, 8);
    const recentItems = knowledgeIds
      .map((knowledgeId) => knowledge.find((item) => item.id === knowledgeId))
      .filter(Boolean)
      .slice(0, 3);
    const dimensionRecords = Object.values(state.save.mastery || {})
      .map((record) => getMasteryDimensionRecord(record, dimension.id))
      .filter((record) => (record.correctCount || 0) + (record.wrongCount || 0) > 0);
    const dueRecords = dimensionRecords.filter((record) => getReviewSchedule(record, nowMs).isDue);
    const nextRecord = dimensionRecords
      .filter((record) => record.nextReviewAt)
      .sort((a, b) => toTime(a.nextReviewAt) - toTime(b.nextReviewAt))[0];
    const wrongCount = getReviewWrongQuestions().filter((entry) => (entry.reviewDimension || getQuestionMasteryDimension(entry)) === dimension.id).length;
    return {
      ...dimension,
      count: knowledgeIds.length,
      wrongCount,
      dueCount: dueRecords.length,
      nextReviewAt: nextRecord?.nextReviewAt || null,
      dueText: dimensionRecords.length ? (dueRecords.length ? `${dueRecords.length} 个到期` : formatReviewDueText(nextRecord?.nextReviewAt)) : "暂无记录",
      recentItems,
    };
  });
}

function getReviewRecommendationCopy(groups = getReviewDimensionGroups()) {
  const active = groups.filter((group) => group.count > 0).sort((a, b) => b.dueCount - a.dueCount || b.wrongCount - a.wrongCount || b.count - a.count);
  if (!active.length) return "今天没有明显弱项，复习一组旧内容就好。";
  const top = active[0];
  if (top.id === "listening") return "先练听力，把听不出的声音捞回来。";
  if (top.id === "speaking") return "先练口说，把说不顺的句子放慢。";
  if (top.id === "reading") return "先练阅读，把看不懂的词句拆开。";
  if (top.id === "writing") return "先练书写，把写不稳的形状收回来。";
  return "先练会用，把认识的词句放进场景。";
}

function renderReviewDimensionGroups() {
  const groups = getReviewDimensionGroups();
  if (!groups.some((group) => group.count)) return "";
  return `
    <section class="review-dimension-panel" aria-label="专项复习">
      <div class="review-dimension-heading">
        <span class="badge">专项</span>
        <strong>${getReviewRecommendationCopy(groups)}</strong>
      </div>
      <div class="review-dimension-grid">
        ${groups
          .map((group) => {
            const recentItems = group.recentItems.map((item) => `<span>${getCollectionDisplayText(item)}</span>`).join("");
            return `
              <button class="review-dimension-card ${group.count ? "" : "is-empty"}" data-start-dimension-review="${group.id}" ${group.count ? "" : "disabled"}>
                <div>
                  <strong>${group.weaknessLabel}</strong>
                  <small>${group.dueText} · ${group.hint}</small>
                </div>
                <b>${group.count}</b>
                ${recentItems ? `<p>${recentItems}</p>` : `<p><span>暂无</span></p>`}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderWrongReviewGroups() {
  const groups = getWrongReviewGroups();
  if (!groups.some((group) => group.entries.length)) return "";
  return `
    <section class="wrong-review-groups" aria-label="错题分类">
      ${groups
        .map((group) => {
          const recentItems = group.entries
            .slice(0, 3)
            .map((entry) => {
              const item = (entry.knowledgeIds || []).map((id) => knowledge.find((knowledgeItem) => knowledgeItem.id === id)).find(Boolean);
              const displayText = item ? getCollectionDisplayText(item) : "练";
              return `<span>${displayText}</span>`;
            })
            .join("");
          return `
            <article class="wrong-review-group ${group.entries.length ? "" : "is-empty"}">
              <div>
                <strong>${group.label}</strong>
                <small>${group.hint}</small>
              </div>
              <b>${group.entries.length}</b>
              ${recentItems ? `<p>${recentItems}</p>` : `<p><span>暂无</span></p>`}
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function getHomeAttentionIds(limit = 4) {
  const wrongEntries = getReviewWrongQuestions()
    .filter((entry) => (entry.wrongCount || 0) > 0 && (entry.correctStreak || 0) < 2)
    .flatMap((entry) => (entry.knowledgeIds || []).map((knowledgeId) => ({ knowledgeId, score: (entry.wrongCount || 0) * 10 - (entry.correctStreak || 0) * 4 })));
  const sorted = wrongEntries
    .reduce((map, entry) => {
      map.set(entry.knowledgeId, Math.max(map.get(entry.knowledgeId) || 0, entry.score));
      return map;
    }, new Map());
  return [...sorted.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([knowledgeId]) => knowledgeId);
}

function getReviewStartLevelId() {
  const weak = getWeakKnowledgeItems(1)[0]?.item;
  if (weak?.type === "word") return "level-7";
  if (weak?.script === "katakana" || weak?.category === "katakana-vowel" || weak?.category === "katakana-kana") return "level-gojuon-clear-review";
  if (weak?.script === "hiragana" || weak?.category === "hiragana-vowel" || weak?.category === "hiragana-kana") return "level-6";
  return state.save.clearedLevels.includes("level-final-review") ? "level-final-review" : "level-6";
}

function getUnlockedKnowledgeItems() {
  const unlocked = new Set(state.save.unlockedCards || []);
  const clearedKnowledge = new Set(
    levels
      .filter((level) => state.save.clearedLevels.includes(level.id))
      .flatMap((level) => [...(level.newKnowledgeIds || []), ...(level.reward?.cards || [])]),
  );
  return knowledge.filter((item) => unlocked.has(item.id) || clearedKnowledge.has(item.id));
}

function recordDailyQuestion(isCorrect) {
  ensureDailyState();
  state.save = {
    ...state.save,
    daily: {
      ...state.save.daily,
      answered: (state.save.daily?.answered || 0) + 1,
      correct: (state.save.daily?.correct || 0) + (isCorrect ? 1 : 0),
    },
  };
}

function recordDailyClear() {
  ensureDailyState();
  state.save = {
    ...state.save,
    daily: {
      ...state.save.daily,
      cleared: (state.save.daily?.cleared || 0) + 1,
    },
  };
}

function claimDailyReward() {
  const progress = getDailyProgress();
  if (!progress.finished || progress.claimed) return;
  const rewardCoins = 12;
  const rewardExp = 12;
  const petExp = 10;
  state.save = {
    ...state.save,
    coins: state.save.coins + rewardCoins,
    exp: state.save.exp + rewardExp,
    playerLevel: getPlayerLevel(state.save.exp + rewardExp),
    pet: {
      ...state.save.pet,
      exp: (state.save.pet?.exp || 0) + petExp,
      level: getPetLevel((state.save.pet?.exp || 0) + petExp),
    },
    daily: {
      ...state.save.daily,
      claimed: true,
    },
  };
  saveGame(state.save);
  audioService.playUiCue("complete");
  render();
}

function renderPairMatchQuestion(question, session) {
  const pairOptions = getSessionPairOptions(session, question);
  const matches = session.pairMatches || [];
  const selectedLeft = session.selectedPairLeft;
  const leftOrder = new Map(pairOptions.left.map((left, index) => [left, index + 1]));
  return `
    <section class="pair-match-panel" aria-label="配对题">
      <div class="pair-column">
        ${pairOptions.left
          .map((left) => {
            const matched = matches.some((match) => match.left === left);
            const wrong = session.pairWrong?.left === left;
            return `
              <button
                class="${selectedLeft === left ? "is-selected" : ""} ${matched ? "is-matched" : ""} ${wrong ? "is-wrong" : ""}"
                data-pair-left="${left}"
                ${renderPairAudioDataset(question, left, "left")}
                ${session.answered || matched ? "disabled" : ""}
              >
                ${renderPairItemContent(question, left, "left", leftOrder.get(left))}
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="pair-column">
        ${pairOptions.right
          .map((right) => {
            const matched = matches.some((match) => match.right === right);
            const wrong = session.pairWrong?.right === right;
            return `
              <button
                class="${matched ? "is-matched" : ""} ${wrong ? "is-wrong" : ""}"
                data-pair-right="${right}"
                ${session.answered || matched ? "disabled" : ""}
              >
                ${renderPairItemContent(question, right, "right")}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderShell(content) {
  const celebration = state.route === "puzzle" ? state.playSession?.celebration : null;
  app.innerHTML = `
    <main class="app-shell">
      <section class="phone-frame">
        ${content}
        ${celebration ? renderCelebrationOverlay(celebration) : ""}
      </section>
    </main>
  `;
  window.scrollTo(0, 0);
}

function renderCelebrationOverlay(type) {
  const celebration = typeof type === "string" ? { type } : type || {};
  const isSuccess = celebration.type === "success";
  const title = celebration.title || (isSuccess ? "就是它" : "差一点");
  const message = celebration.message || (isSuccess ? "继续摘下一朵。" : "再来一次就好。");
  return `
    <div class="celebration-overlay ${isSuccess ? "is-success" : "is-try-again"}" aria-live="polite">
      <div class="burst-field">
        ${Array.from({ length: isSuccess ? 18 : 10 })
          .map((_, index) => `<span style="--i:${index}"></span>`)
          .join("")}
      </div>
      <div class="celebration-message">
        <strong>${title}</strong>
        <p>${message}</p>
      </div>
    </div>
  `;
}

function getHomeLearningState() {
  const mainLevels = levels
    .filter((level) => level.type === "main" && level.order > 0)
    .sort((a, b) => a.order - b.order);
  const activeLevel = state.playSession?.levelId ? getLevelById(state.playSession.levelId) : null;
  const targetLevel = activeLevel || mainLevels.find((level) => !isLevelCleared(level.id)) || mainLevels[mainLevels.length - 1];
  const kanaLevels = mainLevels.filter((level) => level.newKnowledgeIds.length);
  const kanaItems = kanaLevels
    .map((level) => knowledge.find((item) => item.id === level.newKnowledgeIds[0]))
    .filter(Boolean);
  const learnedItems = kanaLevels
    .filter((level) => isLevelCleared(level.id))
    .map((level) => knowledge.find((item) => item.id === level.newKnowledgeIds[0]))
    .filter(Boolean);
  const hasProgress = state.save.clearedLevels.length > 0 || state.save.unlockedCards.length > 0 || Object.keys(state.save.starRecords).length > 0;

  if (!hasProgress) {
    const firstLevel = mainLevels.find((level) => level.newKnowledgeIds.length) || targetLevel;
    const firstKnowledge = knowledge.find((item) => item.id === firstLevel?.newKnowledgeIds[0]) || kanaItems[0];
    return {
      targetLevel: firstLevel,
      targetKnowledge: firstKnowledge,
      focusDisplay: firstKnowledge?.kana,
      focusReading: firstKnowledge?.romaji,
      focusAudioKey: firstKnowledge?.audioKey,
      focusAudioSrc: firstKnowledge?.audioSrc,
      currentKnowledgeId: firstKnowledge?.id,
      badge: "从零开始",
      title: "元音花园",
      subtitle: "先听声音，再认识假名。",
      body: "从 a、i、u、e、o 开始，玩着进入日语。",
      metricTarget: "元音入门",
      learnedCount: 0,
      nextLabel: "开始",
      previewItems: kanaItems.filter((item) => item.id !== firstKnowledge?.id),
      hasProgress,
    };
  }

  const targetKnowledge = knowledge.find((item) => item.id === targetLevel?.newKnowledgeIds[0]);
  const allowedItems = (targetLevel?.allowedKnowledgeIds || [])
    .map((id) => knowledge.find((item) => item.id === id))
    .filter(Boolean);
  const reviewItems = allowedItems.filter((item) => item.type === "kana");
  const n5Items = allowedItems.filter((item) => item.level === "n5" && ["word", "sentence"].includes(item.type));

  if (!targetKnowledge) {
    const visibleItems = n5Items.length ? n5Items : reviewItems.length ? reviewItems : kanaItems;
    const metricTarget =
      n5Items.length
        ? visibleItems
            .slice(0, 2)
            .map((item) => item.kana || item.japanese)
            .join(" ")
        :
      targetLevel?.puzzleMode === "final-review-gate"
        ? "あア いイ"
        : visibleItems
            .slice(0, 5)
            .map((item) => item.kana)
            .join("");
    const isN5Target = Boolean(n5Items.length);
    return {
      targetLevel,
      targetKnowledge: visibleItems[0] || kanaItems[0],
      focusDisplay: metricTarget || "復",
      focusReading: isN5Target ? "N5" : targetLevel?.puzzleMode === "final-review-gate" ? "review" : "mix",
      focusAudioKey: isN5Target ? visibleItems[0]?.audioKey : null,
      focusAudioSrc: isN5Target ? visibleItems[0]?.audioSrc : null,
      currentKnowledgeId: null,
      badge: isN5Target ? "N5 入门" : activeLevel ? "继续练习" : targetLevel?.puzzleMode === "final-review-gate" ? "总复习" : "今天巩固",
      title: targetLevel?.title || "元音花园",
      subtitle: targetLevel?.subtitle || "把已经见过的声音重新唤醒。",
      body: isN5Target
        ? "先把词听熟，再放进短句。"
        : activeLevel
          ? "接着刚才的题继续。"
          : targetLevel?.puzzleMode === "final-review-gate"
            ? "平假名、片假名和词语混合练习。"
            : "听音、辨形、快速选出来。",
      metricTarget: metricTarget || "复习",
      learnedCount: learnedItems.length,
      nextLabel: targetLevel?.statusLabel || "继续",
      previewItems: visibleItems.slice(1),
      hasProgress,
    };
  }

  const previewItems = kanaItems.filter((item) => item.id !== targetKnowledge.id && !learnedItems.some((learned) => learned.id === item.id));
  return {
    targetLevel,
    targetKnowledge,
    focusDisplay: getCompactHomeFocusDisplay(targetKnowledge),
    focusReading: getCompactHomeFocusReading(targetKnowledge),
    focusAudioKey: targetKnowledge.audioKey,
    focusAudioSrc: targetKnowledge.audioSrc,
    currentKnowledgeId: targetKnowledge.id,
    badge: "今天先学",
    title: `${targetKnowledge.kana} 的声音`,
    subtitle: `听到 ${targetKnowledge.romaji}，想起 ${targetKnowledge.kana}。`,
    body: "听一下，跟着写，再自己认出来。",
    metricTarget: targetKnowledge.kana,
    learnedCount: learnedItems.length,
    nextLabel: targetLevel.title.replace("点亮 ", ""),
    previewItems: previewItems.length ? previewItems : kanaItems.filter((item) => item.id !== targetKnowledge.id),
    hasProgress,
  };
}

function getCompactHomeFocusDisplay(item) {
  const text = item?.kana || item?.japanese || "";
  if (!text) return "日";
  if (item?.type === "kana") return text;
  if (item?.type === "sentence" || text.length > 6) return item?.type === "word" ? text.slice(0, 4) : "文";
  return text;
}

function getCompactHomeFocusReading(item) {
  if (item?.type === "kana") return item.romaji || "";
  return item?.level ? String(item.level).toUpperCase() : item?.type === "sentence" ? "句子" : "词";
}

function getHomeGardenItems(homeState) {
  const attentionIds = new Set(getHomeAttentionIds());
  const unlockedKana = getUnlockedKnowledgeItems().filter((item) => item.type === "kana");
  const weakKana = unlockedKana.filter((item) => attentionIds.has(item.id));
  const recentKana = [...unlockedKana].sort((a, b) => (b.unlockOrder || 0) - (a.unlockOrder || 0));
  const pool = [homeState.targetKnowledge, ...weakKana, ...recentKana, ...(homeState.previewItems || [])].filter((item) => item?.type === "kana");
  const uniqueItems = [];
  const seen = new Set();
  for (const item of pool) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    uniqueItems.push(item);
  }
  return uniqueItems.slice(0, 10).map((item) => ({
    item,
    isCurrent: item.id === homeState.currentKnowledgeId,
    isWeak: attentionIds.has(item.id),
    isLearned: unlockedKana.some((entry) => entry.id === item.id),
  }));
}

function renderHomeGardenPlot(homeState) {
  const items = getHomeGardenItems(homeState);
  return `
    <section class="home-garden-plot" aria-label="已点亮">
      <div class="home-garden-heading">
        <span class="badge">已点亮</span>
        <strong>${items.length} 个</strong>
      </div>
      <p class="home-plot-note">红点是错过的声音。</p>
      <div class="home-plot-grid">
        ${items
          .map(
            ({ item, isCurrent, isWeak, isLearned }) => `
              <button
                class="home-plot ${isCurrent ? "is-current" : ""} ${isWeak ? "is-weak" : ""} ${isLearned ? "is-learned" : ""}"
                ${item.audioKey ? `data-audio-key="${item.audioKey}" data-audio-src="${item.audioSrc || ""}"` : ""}
                aria-label="${item.kana || item.japanese}"
              >
                <span>${item.kana || item.japanese}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderHome() {
  const homeState = getHomeLearningState();
  const dailyProgress = getDailyProgress();
  const todayStats = getTodayLearningStats();
  const weakCount = getWeakKnowledgeItems().length;
  const unlockedCount = getUnlockedKnowledgeItems().length;
  const targetKnowledge = homeState.targetKnowledge;
  renderShell(`
    <div class="screen home-screen compact-home">
      <header class="top-bar">
        <div>
          <span class="eyebrow">轻松玩日语</span>
          <h1>元音花园</h1>
        </div>
        <button class="icon-button" data-route="settings" aria-label="设置">⚙</button>
      </header>

      <section class="home-focus-panel" aria-label="今日学习">
        <div class="home-focus-copy">
          <span class="badge">${homeState.badge}</span>
          <h2>${homeState.title}</h2>
          <p>${homeState.body}</p>
        </div>
        <button
          class="home-focus-kana ${homeState.focusDisplay?.length > 1 ? "is-group" : ""}"
          ${homeState.focusAudioKey ? `data-audio-key="${homeState.focusAudioKey}" data-audio-src="${homeState.focusAudioSrc}"` : ""}
          aria-label="${homeState.focusAudioKey ? `播放 ${homeState.focusDisplay} 的读音` : homeState.title}"
        >
          <strong>${homeState.focusDisplay}</strong>
          <small>${homeState.focusReading}</small>
        </button>
      </section>

      <button class="primary-button full home-primary-action" data-start-home-level="${homeState.targetLevel?.id}">继续学习</button>

      ${renderHomeGardenPlot(homeState)}

      <nav class="home-quick-actions" aria-label="常用入口">
        <button class="secondary-button" data-route="levels">学习进度</button>
        <button class="secondary-button" data-route="review">${weakCount ? `错题 ${weakCount}` : "复习"}</button>
        <button class="secondary-button" data-route="collection">图鉴 ${unlockedCount}</button>
      </nav>

      <section class="daily-panel compact-daily" aria-label="今日练习">
        <div class="daily-heading">
          <div>
            <span class="badge">今日</span>
            <strong>连续 ${state.save.dailyStreak || 1} 天</strong>
          </div>
          <span class="reward-pill">Lv.${getPlayerLevel()} · ${state.save.coins} 花币</span>
        </div>
        <div class="daily-task-grid">
          ${dailyProgress.tasks
            .map((task) => `<span>${task.label} ${task.value}/${task.target}</span>`)
            .join("")}
        </div>
        <div class="learning-note">
          <strong>${getHomeEncouragement()}</strong>
          <span>今天练了 ${formatActiveMinutes(todayStats.activeSeconds)} · 答对 ${Math.round(todayStats.accuracy * 100)}%</span>
        </div>
        ${
          dailyProgress.finished
            ? `<button class="secondary-button full" data-claim-daily ${dailyProgress.claimed ? "disabled" : ""}>${dailyProgress.claimed ? "今日奖励已领取" : "领取今日奖励"}</button>`
            : ""
        }
      </section>

      ${state.backMessage ? `<div class="feedback-line is-active">${state.backMessage}</div>` : ""}
    </div>
  `);
}

function renderReviewCenter() {
  const weakItems = getWeakKnowledgeItems();
  const wrongCount = getReviewWrongQuestions().length;
  const dimensionGroups = getReviewDimensionGroups();
  const dimensionWeakCount = dimensionGroups.reduce((total, group) => total + group.count, 0);
  const startLevelId = getReviewStartLevelId();
  const startLevel = levels.find((level) => level.id === startLevelId);
  renderShell(`
    <div class="screen review-screen">
      ${renderHeader("复习", "把容易忘的再点亮。", "home")}
      <section class="review-summary">
        <div>
          <span class="badge">再练</span>
          <strong>${dimensionWeakCount || weakItems.length}</strong>
          <small>错题 ${wrongCount}</small>
        </div>
        <div>
          <span class="badge">宠物</span>
          <strong>${getPetMood()}</strong>
          <small>Lv.${getPetLevel()}</small>
        </div>
      </section>
      ${renderReviewDimensionGroups()}
      ${renderWrongReviewGroups()}
      <section class="review-list">
        ${
          weakItems.length
            ? weakItems
                .map(
                  ({ item, record }) => `
                    <article class="review-item">
                      <strong class="${item.kana.length > 1 ? "is-word" : ""}">${item.kana}</strong>
                      <div>
                        <span>${item.readingHint}</span>
                        <small>${item.chinese}</small>
                        <em>${record.correctCount || 0}/${(record.correctCount || 0) + (record.wrongCount || 0)}</em>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : `<article class="empty-panel"><strong>现在没有特别卡住的地方</strong><small>继续玩，忘了的内容会放到这里。</small></article>`
        }
      </section>
      ${
        wrongCount
          ? `<button class="primary-button full" data-start-wrong-review>错题专练</button>`
          : `<button class="primary-button full" data-start-review-center="${startLevel?.id}" ${startLevel && isLevelUnlocked(startLevel) ? "" : "disabled"}>开始复习</button>`
      }
      ${
        wrongCount && startLevel
          ? `<button class="secondary-button full" data-start-review-center="${startLevel.id}" ${isLevelUnlocked(startLevel) ? "" : "disabled"}>再练一组</button>`
          : ""
      }
    </div>
  `);
}

function getCollectionDisplayText(item) {
  if (item.type === "reading" || item.type === "dialogue") return item.readingHint || item.chinese || "场景材料";
  if (item.type === "kanji") return item.japanese || item.kana || item.readingHint || item.id.replace(/^kanji-/, "");
  return item.kana || item.japanese || item.title || item.id.replace(/^(kana|word|grammar|sentence|reading|dialogue)-/, "");
}

function getCollectionReadingText(item) {
  if (item.type === "kanji") return item.readingHint || "汉字";
  if (item.type === "grammar") return "语法";
  if (item.type === "sentence") return item.romaji || "短句";
  if (item.type === "reading") return "阅读";
  if (item.type === "dialogue") return "听力";
  return item.readingHint || item.romaji || "";
}

function getCollectionGroups() {
  return [
    {
      label: "声音",
      description: "先听清日语声音。",
      items: knowledge.filter((item) => item.type === "kana" && /(?:^|-)sound$/.test(item.category || "")),
    },
    {
      label: "假名",
      description: "把声音对应到平假名和片假名。",
      items: knowledge.filter((item) => item.type === "kana" && !/(?:^|-)sound$/.test(item.category || "")),
    },
    {
      label: "词语",
      description: "从单词进入可表达的意思。",
      items: knowledge.filter((item) => item.type === "word"),
    },
    {
      label: "汉字",
      description: "把常见汉字放进真实日文。",
      items: knowledge.filter((item) => item.type === "kanji"),
    },
    {
      label: "句型",
      description: "语法点和可替换短句。",
      items: knowledge.filter((item) => item.type === "grammar" || item.type === "sentence"),
    },
    {
      label: "场景",
      description: "阅读和听力材料。",
      items: knowledge.filter((item) => item.type === "reading" || item.type === "dialogue"),
    },
  ];
}

function renderCollection() {
  const unlocked = new Set(getUnlockedKnowledgeItems().map((item) => item.id));
  const groups = getCollectionGroups().filter((group) => group.items.length);
  renderShell(`
    <div class="screen collection-screen">
      ${renderHeader("图鉴", "声音、假名、词语、句型和场景。", "home")}
      <section class="collection-sections">
        ${groups
          .map((group) => {
            const unlockedCount = group.items.filter((item) => unlocked.has(item.id)).length;
            return `
              <section class="collection-section" aria-label="${group.label}">
                <div class="collection-section-heading">
                  <div>
                    <strong>${group.label}</strong>
                    <small>${group.description}</small>
                  </div>
                  <span>${unlockedCount}/${group.items.length}</span>
                </div>
                <div class="collection-grid">
                  ${group.items
                    .map((item) => {
                      const isUnlocked = unlocked.has(item.id);
                      const record = state.save.mastery?.[item.id];
                      const displayText = getCollectionDisplayText(item);
                      return `
                        <article class="collection-card ${isUnlocked ? "" : "is-locked"}">
                          <strong class="${displayText.length > 1 ? "is-word" : ""}">${isUnlocked ? displayText : "?"}</strong>
                          <span>${isUnlocked ? getCollectionReadingText(item) : "未收集"}</span>
                          <small>${isUnlocked ? item.chinese : "继续学习后点亮"}</small>
                          ${isUnlocked && record ? `<em>熟悉 ${record.level || 0}/5</em>` : ""}
                        </article>
                      `;
                    })
                    .join("")}
                </div>
              </section>
            `;
          })
          .join("")}
      </section>
    </div>
  `);
}

function renderSettings() {
  const clearedCount = state.save.clearedLevels.length;
  const cardCount = state.save.unlockedCards.length;
  const weakCount = Object.values(state.save.mastery || {}).filter((item) => (item.level || 0) <= 1).length;
  renderShell(`
    <div class="screen settings-screen">
      ${renderHeader("设置", "声音与进度", "home")}
      <section class="settings-panel">
        <div class="settings-row">
          <div>
            <strong>声音</strong>
            <small>日语读音和游戏反馈音</small>
          </div>
          <button class="setting-toggle" data-toggle-audio>${state.save.settings.audioEnabled ? "已开启" : "已关闭"}</button>
        </div>
        <div class="settings-row">
          <div>
            <strong>音量</strong>
            <small>现在 ${Math.round((state.save.settings.volume ?? 1) * 100)}%</small>
          </div>
          <input class="volume-slider" type="range" min="0" max="100" value="${Math.round((state.save.settings.volume ?? 1) * 100)}" data-volume-slider aria-label="音量">
        </div>
        <div class="settings-row">
          <div>
            <strong>学习进度</strong>
            <small>已通关 ${clearedCount} 关 · 已收集 ${cardCount} 张卡 · 可再练 ${weakCount} 个</small>
          </div>
        </div>
      </section>

      <section class="settings-panel about-panel">
        <div class="settings-row about-row">
          <div>
            <strong>关于元音花园</strong>
            <small>轻松玩日语，循序渐进记住假名和词语。</small>
          </div>
          <span class="setting-value">v1.0</span>
        </div>
        <div class="contact-card">
          <div>
            <strong>联系作者</strong>
            <small>反馈问题、建议玩法或读音内容。</small>
          </div>
          <div class="contact-actions">
            <button class="contact-button qq" data-open-contact="qq" aria-label="通过 QQ 联系作者">
              <span class="contact-icon">QQ</span>
              <strong>QQ</strong>
            </button>
            <button class="contact-button wechat" data-open-contact="wechat" aria-label="通过微信联系作者">
              <span class="contact-icon">微</span>
              <strong>微信</strong>
            </button>
          </div>
          ${state.contactNotice ? `<p class="contact-notice">${state.contactNotice}</p>` : ""}
        </div>
      </section>

      <section class="settings-danger">
        <div>
          <strong>重置学习进度</strong>
          <p>会清空关卡、卡片和星级记录。</p>
        </div>
        ${
          state.resetConfirmPending
            ? `
              <div class="confirm-actions">
                <button class="secondary-button full" data-cancel-reset>取消</button>
                <button class="danger-button full" data-confirm-reset>确定清空</button>
              </div>
            `
            : `<button class="danger-outline-button full" data-request-reset>重置进度</button>`
        }
      </section>
    </div>
  `);
}

function renderMap() {
  const mainLevels = levels.filter((level) => level.type !== "review");

  renderShell(`
    <div class="screen map-screen">
      ${renderHeader("元音花园", "从 あ 开始。", "home")}
      <section class="map-panel">
        <div class="map-river"></div>
        <div class="level-path">
          ${mainLevels.map((level) => renderMapNode(level)).join("")}
        </div>
      </section>
      <section class="hint-panel">
        <strong>今日练习</strong>
        <p>听一听，写一写，再选出正确的假名。</p>
      </section>
      <button class="primary-button full" data-route="levels">查看进度</button>
    </div>
  `);
}

function renderMapNode(level) {
  const unlocked = isLevelUnlocked(level);
  const cleared = isLevelCleared(level.id);
  const classes = ["map-node", unlocked ? "unlocked" : "locked", cleared ? "cleared" : ""].join(" ");

  return `
    <button class="${classes}" data-level="${level.id}" ${unlocked ? "" : "disabled"}>
      <span>${level.order}</span>
      <strong>${level.title}</strong>
      <small>${cleared ? "已点亮" : unlocked ? "可进入" : "稍后"}</small>
    </button>
  `;
}

function renderLevels() {
  const sections = getLevelSections();
  renderShell(`
    <div class="screen levels-screen">
      ${renderHeader("学习进度", "按能力路径继续。", "home")}
      ${renderProgressPathPanel(sections)}
      <section class="level-list">
        ${sections.map((section) => renderLevelSection(section)).join("")}
      </section>
    </div>
  `);
}

const PROGRESS_PATH_STAGES = [
  { id: "foundation", title: "基础音", caption: "假名和发音", ability: "听读写" },
  { id: "n5", title: "N5 场景", caption: "词句和回应", ability: "词句" },
  { id: "n4", title: "N4 表达", caption: "生活场景", ability: "表达" },
  { id: "conversation", title: "会话材料", caption: "对话和真实文本", ability: "交流" },
];

function getProgressPathStageId(section) {
  const sectionText = [
    section.id,
    section.title,
    ...section.levels.flatMap((level) => [level.id, level.title, level.statusLabel, level.puzzleMode, level.memoryRule?.stage, level.memoryRule?.groupId]),
  ]
    .filter(Boolean)
    .join(" ");

  if (/conversation|speaking-response|speaking-intent|real-listening|kanji|real-text|kana-to-real/.test(sectionText)) return "conversation";
  if (/level-n4|n4-|N4/.test(sectionText)) return "n4";
  if (/level-n5|n5-|N5/.test(sectionText)) return "n5";
  if (
    section.id === "intro" ||
    /^row-/.test(section.id) ||
    ["gojuon-clear", "daku", "handaku", "yoon", "special", "basic-sounds"].includes(section.id) ||
    /speaking-basic|four-skills-basic/.test(sectionText)
  ) {
    return "foundation";
  }
  return "conversation";
}

function getProgressPathStages(sections) {
  return PROGRESS_PATH_STAGES.map((stage) => {
    const stageSections = sections.filter((section) => getProgressPathStageId(section) === stage.id);
    const stageLevels = stageSections.flatMap((section) => section.levels);
    const total = stageLevels.length;
    const cleared = stageLevels.filter((level) => isLevelCleared(level.id)).length;
    const unlocked = stageLevels.some((level) => isLevelUnlocked(level));
    const progress = total ? Math.round((cleared / total) * 100) : 0;
    const state = total && cleared >= total ? "done" : unlocked ? "active" : "locked";
    return {
      ...stage,
      total,
      cleared,
      progress,
      state,
    };
  });
}

function renderProgressPathPanel(sections) {
  const stages = getProgressPathStages(sections);
  return `
    <section class="progress-path-panel" aria-label="能力路径">
      <div class="progress-path-heading">
        <span class="badge">路径</span>
        <strong>从假名到会话</strong>
        <small>按阶段推进</small>
      </div>
      <div class="progress-path-grid">
        ${stages
          .map(
            (stage, index) => `
              <article class="progress-path-step is-${stage.state}" style="--stage-progress: ${stage.progress}%">
                <span class="progress-path-index">${index + 1}</span>
                <div class="progress-path-copy">
                  <strong>${stage.title}</strong>
                  <span>${stage.caption}</span>
                  <small>${stage.cleared}/${stage.total} · ${stage.ability}</small>
                </div>
                <div class="progress-path-meter" aria-hidden="true"><span></span></div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

const LEVEL_SECTION_LABELS = {
  intro: "入门",
  "row-a": "あ行",
  "row-ka": "か行",
  "row-sa": "さ行",
  "row-ta": "た行",
  "row-na": "な行",
  "row-ha": "は行",
  "row-ma": "ま行",
  "row-ya": "や行",
  "row-ra": "ら行",
  "row-wa": "わ行",
  "gojuon-clear": "清音总复习",
  daku: "浊音",
  handaku: "半浊音",
  yoon: "拗音",
  special: "促音和长音",
  "basic-sounds": "基础音总复习",
  "n5-intro": "N5 自我介绍",
  "n5-objects": "N5 物品指代",
  "n5-places": "N5 地点位置",
  "n5-food": "N5 食物饮料",
  "n5-actions": "N5 日常动作",
  "n5-time": "N5 数字时间",
  "n5-position": "N5 位置存在",
  "n5-likes": "N5 喜欢不喜欢",
  "n5-shopping": "N5 购物入门",
  "n5-transport": "N5 交通地点",
  "n5-family": "N5 家人朋友",
  "n5-weather": "N5 天气日期",
  "n5-reading": "N5 简单阅读",
  "n5-reading-passage": "N5 小短文阅读",
  "n5-dialogue": "N5 短对话听力",
  "n5-dialogue-conversation": "N5 短对话理解",
  "n5-reading-info": "N5 阅读信息匹配",
  "n5-dialogue-multi-turn": "N5 多轮短对话",
  "n5-review-foundation": "N5 主题回顾",
  "n5-review-daily": "N5 日常回顾",
  "n5-review-life": "N5 生活回顾",
  "n5-review-expansion": "N5 场景回顾",
  "n5-review-cumulative": "N5 综合回顾",
  "n5-practical-scenes": "N5 场景小任务",
  "n5-jlpt-practice": "N5 综合小测",
  "n5-jlpt-vocab-grammar": "N5 词汇语法小测",
  "n5-jlpt-reading-listening": "N5 阅读听力小测",
  "n5-scene-theater": "N5 场景小剧场",
  "n5-long-reading": "N5 长一点阅读",
  "n5-complex-listening": "N5 多步听力",
  "n5-grammar-deepening": "N5 语法深化",
  "n5-school-life": "N5 学校生活",
  "n5-final-integrated": "N5 听读综合复盘",
  "n5-daily-life": "N5 生活词汇扩展",
  "n5-jlpt-integrated-advanced": "N5 听读强化小测",
  "n5-routine": "N5 作息词汇扩展",
  "n5-jlpt-routine": "N5 作息听读小测",
  "n5-visual-loop": "N5 图像记忆小测",
};

function normalizeSectionGroupId(groupId) {
  if (!groupId) return null;
  const normalized = groupId.replace(/-review$/, "");
  if (normalized === "vowel-a-row") return "row-a";
  if (normalized === "vowel-boss" || normalized === "vowel-light" || normalized === "vowel-words") return "row-a";
  if (normalized === "gojuon-clear") return "gojuon-clear";
  if (normalized === "basic-sounds") return "basic-sounds";
  const generatedRowMatch = normalized.match(/^(words|row|cumulative)-(ka|sa|ta|na|ha|ma|ya|ra|wa)$/);
  if (generatedRowMatch) return `row-${generatedRowMatch[2]}`;
  const rowMatch = normalized.match(/^(hira|kata)-(ka|sa|ta|na|ha|ma|ya|ra|wa)$/);
  if (rowMatch) return `row-${rowMatch[2]}`;
  const moduleMatch = normalized.match(/^(hira|kata)-(daku|handaku|yoon|special)$/);
  if (moduleMatch) return moduleMatch[2];
  return normalized;
}

function getLevelSectionKey(level) {
  if (level.type === "tutorial") return "intro";
  if (
    [
      "level-1",
      "level-2",
      "level-3",
      "level-4",
      "level-5",
      "level-6",
      "level-kata-1",
      "level-kata-2",
      "level-kata-3",
      "level-kata-4",
      "level-kata-5",
    ].includes(level.id)
  ) {
    return "row-a";
  }
  if (["level-7", "level-8", "level-light-review"].includes(level.id)) return "row-a";
  if (level.id === "level-final-review") return "row-a";
  if (level.id === "level-gojuon-clear-review") return "gojuon-clear";
  if (level.id === "level-basic-sounds-review") return "basic-sounds";
  const groupKey = normalizeSectionGroupId(level.memoryRule?.groupId);
  if (groupKey) return groupKey;
  const firstNew = knowledge.find((item) => item.id === level.newKnowledgeIds[0]);
  if (firstNew?.row) return ["daku", "handaku", "yoon", "special"].includes(firstNew.row) ? firstNew.row : `row-${firstNew.row}`;
  return "misc";
}

function getLevelSectionTitle(sectionId, levelsInSection) {
  if (LEVEL_SECTION_LABELS[sectionId]) return LEVEL_SECTION_LABELS[sectionId];
  return levelsInSection[0]?.statusLabel || "小节";
}

function getSectionDescription(section, current) {
  if (section.id === "row-a") return "基础单音、片假名和书写练习";
  if (/^row-/.test(section.id)) return `${section.title}平假名、片假名和读音练习`;
  return current.subtitle || current.title;
}

function getLevelSections() {
  const grouped = new Map();
  levels
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((level) => {
      const key = getLevelSectionKey(level);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(level);
    });

  return [...grouped.entries()].map(([id, items]) => ({
    id,
    title: getLevelSectionTitle(id, items),
    levels: items,
  }));
}

const SECTION_COMPACT_PREVIEWS = {
  "n5-reading-passage": ["短文阅读", "主旨", "细节"],
  "n5-dialogue-conversation": ["短对话", "听力理解", "回应"],
  "n5-reading-info": ["信息阅读", "细节", "匹配"],
  "n5-dialogue-multi-turn": ["多轮听力", "信息匹配", "回应"],
  "n5-jlpt-reading-listening": ["短文阅读", "信息阅读", "短对话", "回应"],
  "n5-scene-theater": ["场景听力", "关键词", "回应"],
  "n5-long-reading": ["长文阅读", "主旨", "细节"],
  "n5-complex-listening": ["多步听力", "信息匹配", "回应"],
  "n5-final-integrated": ["听读复盘", "词汇", "句型", "短对话"],
  "n5-jlpt-integrated-advanced": ["听读强化", "信息阅读", "限次听力", "回应"],
  "n5-jlpt-routine": ["作息听读", "短文阅读", "短对话", "细节"],
};

function shouldUseCompactSectionPreview(section, items) {
  if (/^row-/.test(section.id) || ["daku", "handaku", "yoon", "special", "basic-sounds"].includes(section.id)) return false;
  if (SECTION_COMPACT_PREVIEWS[section.id]) return true;
  if (section.id === "intro") return false;
  return items.length > 0;
}

function getCompactPreviewLabel(section, item) {
  const id = section.id || "";
  const hint = item.readingHint || "";
  const category = item.category || "";
  if (item.type === "reading") {
    if (/long|长/.test(`${id} ${hint}`)) return "长文阅读";
    if (/info|信息|match/.test(`${id} ${hint} ${category}`)) return "信息阅读";
    return "短文阅读";
  }
  if (item.type === "dialogue") {
    if (/multi|complex|多轮|多步/.test(`${id} ${hint} ${category}`)) return "多轮听力";
    return "短对话";
  }
  if (item.type === "sentence") return "句型";
  if (item.type === "grammar") return "语法";
  if (item.type === "word") return "词汇";
  if (item.type === "kanji") return "汉字";
  if (item.type === "kana") return "假名";
  return "";
}

function getSectionPreviewItems(section) {
  const newIds = section.levels.flatMap((level) => level.newKnowledgeIds || []);
  const fallbackIds = section.levels.flatMap((level) => level.allowedKnowledgeIds || []);
  return [...new Set(newIds.length ? newIds : fallbackIds)]
    .map((id) => knowledge.find((entry) => entry.id === id))
    .filter(Boolean);
}

function getSectionPreview(section) {
  const items = getSectionPreviewItems(section);

  if (shouldUseCompactSectionPreview(section, items)) {
    const labels = SECTION_COMPACT_PREVIEWS[section.id] ? [...SECTION_COMPACT_PREVIEWS[section.id]] : [];
    for (const item of items) {
      const label = getCompactPreviewLabel(section, item);
      if (label && !labels.includes(label)) labels.push(label);
    }
    return labels.slice(0, 5);
  }

  return items
    .map((item) => {
      if (item.type === "reading" || item.type === "dialogue") return item.readingHint || item.chinese || "场景材料";
      if (item.type === "grammar") return item.japanese || "语法";
      if (item.type === "sentence") return item.readingHint || item.japanese || item.kana;
      return item.kana || item.japanese;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function getSectionBreakdown(section) {
  if (!["row-a", "row-ka", "row-sa", "row-ta", "row-na", "row-ha", "row-ma", "row-ya", "row-ra", "row-wa", "daku", "handaku", "yoon", "special"].includes(section.id)) {
    return [];
  }
  const getKanaScript = (item) => item?.script || (item?.id?.startsWith("kana-hira-") ? "hiragana" : item?.id?.startsWith("kana-kata-") ? "katakana" : "");
  const introducedById = new Map();
  for (const level of section.levels) {
    for (const id of level.newKnowledgeIds || []) {
      const item = knowledge.find((entry) => entry.id === id);
      if (item?.type === "kana" && getKanaScript(item)) introducedById.set(id, { item, level });
    }
  }
  const groups = new Map();
  for (const { item, level } of introducedById.values()) {
    const label = getKanaScript(item) === "katakana" ? "片假名" : "平假名";
    if (!groups.has(label)) groups.set(label, { label, cleared: 0, total: 0 });
    const group = groups.get(label);
    group.total += 1;
    if (isLevelCleared(level.id)) group.cleared += 1;
  }
  return ["平假名", "片假名"]
    .map((label) => groups.get(label))
    .filter(Boolean)
    .map((item) => {
      return { label: item.label, cleared: item.cleared, total: item.total };
    })
    .filter((item) => item.total > 0);
}

function isSectionReviewStatusLevel(section, level) {
  if (level.puzzleMode === "cumulative-review-gate") return true;
  return section.id === "row-a" && level.id === "level-final-review";
}

function getCumulativeReviewStatus(section) {
  const cumulativeLevels = section.levels.filter((level) => isSectionReviewStatusLevel(section, level));
  if (!cumulativeLevels.length) return null;
  const cleared = cumulativeLevels.filter((level) => isLevelCleared(level.id)).length;
  const current = cumulativeLevels.find((level) => isLevelUnlocked(level) && !isLevelCleared(level.id)) || cumulativeLevels[0];
  return {
    title: section.id === "row-a" && current.id === "level-final-review" ? "あ行花园回顾" : current.title,
    cleared,
    total: cumulativeLevels.length,
  };
}

function getSectionCurrentLevel(section) {
  const primaryLevels = section.levels.filter((level) => level.type !== "review");
  const candidates = primaryLevels.length ? primaryLevels : section.levels;
  return candidates.find((level) => isLevelUnlocked(level) && !isLevelCleared(level.id)) || candidates.find((level) => isLevelUnlocked(level)) || candidates[0];
}

function renderLevelSection(section) {
  const total = section.levels.length;
  const cleared = section.levels.filter((level) => isLevelCleared(level.id)).length;
  const current = getSectionCurrentLevel(section);
  const preview = getSectionPreview(section);
  const compactPreview = shouldUseCompactSectionPreview(section, getSectionPreviewItems(section));
  const unlocked = section.levels.some((level) => isLevelUnlocked(level));
  const breakdown = getSectionBreakdown(section);
  const hasCumulativeReview = section.levels.some((level) => isSectionReviewStatusLevel(section, level));
  const cumulativeReview = getCumulativeReviewStatus(section);
  const sectionDescription = getSectionDescription(section, current);

  return `
    <article class="level-section ${unlocked ? "" : "is-locked"} ${hasCumulativeReview ? "has-cumulative" : ""} ${compactPreview ? "has-compact-preview" : ""}">
      <div class="level-section-main">
        <span class="badge">${cleared}/${total}</span>
        <h2>${section.title}</h2>
        <p>${sectionDescription}</p>
        <div class="section-breakdown">
          ${breakdown.map((item) => `<span>${item.label} ${item.cleared}/${item.total}</span>`).join("")}
          ${cumulativeReview ? `<span class="is-review">回顾 ${cumulativeReview.cleared}/${cumulativeReview.total}</span>` : ""}
        </div>
        ${cumulativeReview ? `<p class="section-review-title">${cumulativeReview.title}</p>` : ""}
        ${preview.length ? `<div class="section-kana-preview">${preview.map((item) => `<span>${item}</span>`).join("")}</div>` : ""}
      </div>
      <div class="level-section-actions">
        <span class="stars">${"●".repeat(Math.min(cleared, 5))}${"○".repeat(Math.max(0, Math.min(total, 5) - Math.min(cleared, 5)))}</span>
        <button data-level="${current.id}" ${isLevelUnlocked(current) ? "" : "disabled"}>
          ${cleared >= total ? "再练" : isLevelUnlocked(current) ? "继续" : "稍后"}
        </button>
      </div>
    </article>
  `;
}

function getPairItemKnowledge(question, value, side) {
  const pair = side === "left" ? question.pairs?.find((item) => item.left === value) : question.pairs?.find((item) => item.right === value);
  const pairValues = pair ? [pair.left, pair.right] : [value];
  return knowledge.find((item) => pairValues.includes(item.kana) || pairValues.includes(item.romaji) || pairValues.includes(item.japanese));
}

function getPairAudio(question, value, side) {
  const item = getPairItemKnowledge(question, value, side);
  if (item) return item.audioKey ? { audioKey: item.audioKey, audioSrc: item.audioSrc || "" } : { audioKey: "", audioSrc: "" };
  const kanaItem = knowledge.find((entry) => entry.kana === value);
  if (kanaItem) return kanaItem.audioKey ? { audioKey: kanaItem.audioKey, audioSrc: kanaItem.audioSrc || getAudioSrcForKey(kanaItem.audioKey) } : { audioKey: "", audioSrc: "" };
  if (/^[a-z-]+$/.test(value)) return { audioKey: `kana.${value}`, audioSrc: `assets/audio/kana/${value}.wav` };
  return { audioKey: "", audioSrc: "" };
}

function getAudioSrcForKey(audioKey) {
  if (!audioKey || typeof audioKey !== "string") return "";
  const [type, name] = audioKey.split(".");
  if (!name) return "";
  if (type === "kana") return `assets/audio/kana/${name}.wav`;
  if (type === "word") return `assets/audio/words/${name}.wav`;
  return "";
}

function resolveAudioSrc(src, audioKey) {
  const trimmedSrc = typeof src === "string" ? src.trim() : src;
  return trimmedSrc || getAudioSrcForKey(audioKey);
}

function renderPairAudioDataset(question, value, side) {
  if (side === "right") return "";
  const { audioKey, audioSrc } = getPairAudio(question, value, side);
  if (!audioKey) return "";
  return `data-pair-audio-key="${audioKey}" ${audioSrc ? `data-pair-audio-src="${audioSrc}"` : ""}`;
}

function renderPairItemContent(question, value, side, index = 0) {
  const isAudioLabel = side === "left" && isAudioPairQuestion(question);
  if (!isAudioLabel) return `<strong>${value}</strong>`;
  return `<strong>声音 ${index || ""}</strong>`;
}

function renderLevelCard(level) {
  const unlocked = isLevelUnlocked(level);
  const cleared = isLevelCleared(level.id);
  const inProgress = state.playSession?.levelId === level.id && !cleared;
  const stars = state.save.starRecords[level.id] || 0;
  const knowledgeLabels = level.newKnowledgeIds
    .map((id) => knowledge.find((item) => item.id === id)?.japanese)
    .filter(Boolean)
    .join(" ");

  return `
    <article class="level-card ${unlocked ? "" : "is-locked"}">
      <div>
        <span class="badge">${level.statusLabel}</span>
        <h2>${level.title}</h2>
        <p>${level.subtitle}</p>
        <small>${knowledgeLabels ? `今天：${knowledgeLabels}` : "复习"}</small>
      </div>
      <div class="level-card-actions">
        <span class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>
        <button data-level="${level.id}" ${unlocked ? "" : "disabled"}>
          ${inProgress ? "继续" : cleared ? "再玩一次" : unlocked ? "进入" : "稍后"}
        </button>
      </div>
    </article>
  `;
}

function renderPuzzle() {
  const level = getLevelById(state.selectedLevelId) || levels[0];
  const session =
    state.playSession?.levelId === level.id
      ? state.playSession
      : createPlaySession(level.id);

  if (level.type === "tutorial") {
    renderTutorial(level, session);
    return;
  }

  renderQuestionLevel(level, session);
}

function renderTutorial(level, session) {
  const step = tutorialSteps[session.tutorialStep] || tutorialSteps[0];
  const progress = session.tutorialStep + 1;

  renderShell(`
    <div class="screen puzzle-screen">
      ${renderHeader(level.title, level.subtitle, "levels")}
      <section class="puzzle-board tutorial-board">
        <span class="badge">${step.eyebrow} / ${tutorialSteps.length}</span>
        ${
          step.focusType === "romaji-sequence"
            ? `<div class="tutorial-sequence">${step.focus.map((item) => `<span>${item}</span>`).join("")}</div>`
            : step.focusType === "kana-reading"
              ? `<div class="tutorial-reading-focus"><strong>${step.focus.kana}</strong><span>${step.focus.romaji}</span></div>`
            : `<div class="kana-focus tutorial-focus">${step.focus}</div>`
        }
        <div class="reading-card">
          <button class="sound-button large" data-audio-key="${step.audioKey}" data-audio-src="${step.audioSrc}" aria-label="播放日语读音">▶</button>
          <div>
            <strong>${step.title}</strong>
            <span>${step.body}</span>
          </div>
        </div>
      </section>

      <section class="vowel-mini-grid" aria-label="元音速览">
        ${knowledge
          .filter((item) => item.category === "hiragana-vowel")
          .map(
            (item) => `
              <button data-audio-key="${item.audioKey}" data-audio-src="${item.audioSrc}" aria-label="播放 ${item.kana}">
                <strong>${item.kana}</strong>
                <span>${item.romaji}</span>
              </button>
            `,
          )
          .join("")}
      </section>

      <div class="progress-dots" aria-label="引导进度">
        ${tutorialSteps.map((_, index) => `<span class="${index < progress ? "active" : ""}"></span>`).join("")}
      </div>

      <button class="primary-button full" data-tutorial-next="${level.id}">
        ${progress >= tutorialSteps.length ? "完成引导，进入第 1 关" : "下一步"}
      </button>
    </div>
  `);
}

function renderQuestionLevel(level, session) {
  const levelQuestions = getSessionQuestions(session);
  const currentQuestion = levelQuestions[session.questionIndex];
  const focusKnowledge = getSessionFocusKnowledge(level, session, currentQuestion);
  const isRemedialKana = session.remedialMode === "kana" && focusKnowledge;
  const isRemedialWord = session.remedialMode === "word";
  const usesHandwriting = sessionUsesHandwriting(level, session, focusKnowledge);
  const shouldShowStudyCard = (level.newKnowledgeIds.length > 0 || isRemedialKana) && !session.studySeen;
  const shouldShowPractice = (level.newKnowledgeIds.length > 0 || isRemedialKana) && session.studySeen && !session.practiceSeen;
  const shouldShowHandwritingDemo = usesHandwriting && session.studySeen && session.practiceSeen && !session.handwritingDemoSeen;
  const shouldShowHandwritingTrace =
    usesHandwriting && session.studySeen && session.handwritingDemoSeen && !session.handwritingTraceDone;
  const shouldShowHandwritingCheck =
    usesHandwriting && session.studySeen && session.handwritingDemoSeen && session.handwritingTraceDone && !session.handwritingDone;
  const shouldShowWordReview =
    ((isRemedialWord && !session.wordReviewSeen) ||
      (level.newKnowledgeIds.length === 0 &&
    levelNeedsWordReview(level) &&
        !session.wordReviewSeen));
  const shouldShowQuizReady =
    (level.newKnowledgeIds.length > 0 || isRemedialKana) && session.studySeen && session.handwritingDone && !session.readyForQuiz;

  if (shouldShowStudyCard && focusKnowledge) {
    renderStudyCard(level, focusKnowledge, session);
    return;
  }

  if (shouldShowPractice && focusKnowledge) {
    renderFamiliarPractice(level, focusKnowledge, session);
    return;
  }

  if (shouldShowHandwritingDemo && focusKnowledge) {
    renderHandwritingDemo(level, focusKnowledge);
    return;
  }

  if (shouldShowHandwritingTrace && focusKnowledge) {
    renderHandwritingTrace(level, focusKnowledge);
    return;
  }

  if (shouldShowHandwritingCheck && focusKnowledge) {
    renderHandwritingCheck(level, focusKnowledge);
    return;
  }

  if (shouldShowWordReview) {
    renderReviewWordStudy(level, session);
    return;
  }

  if (shouldShowQuizReady && focusKnowledge) {
    renderQuizReady(level, focusKnowledge);
    return;
  }

  if (!currentQuestion) {
    renderShell(`
      <div class="screen puzzle-screen">
        ${renderHeader(level.title, level.subtitle, "levels")}
        <section class="puzzle-board">
          <span class="badge">${getPuzzleModeLabel(level.puzzleMode)}</span>
          <div class="kana-focus">${getKnowledgeWrittenForm(focusKnowledge) || "芽"}</div>
          <h2>这里先等等</h2>
          <p>回到进度里，再选一次就好。</p>
        </section>
        <button class="primary-button full" data-route="levels">返回进度</button>
      </div>
    `);
    return;
  }

  const progressText = `${session.questionIndex + 1} / ${levelQuestions.length}`;
  const puzzleHeader = getPuzzleHeader(level, currentQuestion);
  const effectiveRounds = getEffectiveReviewRounds(level);
  const progressLabel = effectiveRounds > 1 ? `练习 ${session.questionIndex + 1} / ${levelQuestions.length}` : `进度 ${progressText}`;
  const isHandwritingQuestion = currentQuestion.questionType === "handwriting-check";
  const isMaterialQuestion = isMaterialChoiceQuestion(currentQuestion);
  const questionUiFamily = getQuestionUiFamily(currentQuestion);
  const shouldShowFeedback = isHandwritingQuestion ? Boolean(session.feedback) : session.answered || session.feedback;
  const feedbackClass = [session.failed ? "is-wrong" : "", isHandwritingQuestion ? "is-prominent" : ""].filter(Boolean).join(" ");
  const feedbackText = session.feedback || "刚刚读了一遍，想再听就点播放。";
  const replayInfo = getQuestionReplayInfo(currentQuestion, session);
  const readingCardDescription = getReadingCardDescription(currentQuestion, focusKnowledge);
  const questionAction =
    session.answered && !session.autoAdvance
      ? session.failed
        ? `<button class="primary-button full" data-restart-level="${level.id}">这关再来一遍</button>`
        : `<button class="primary-button full" data-question-next="${level.id}">
            ${session.questionIndex >= levelQuestions.length - 1 ? "继续" : "下一题"}
          </button>`
      : "";
  const bottomAction = questionAction || renderQuestionBottomAction(currentQuestion, session);
  const screenClass = [
    "screen",
    "puzzle-screen",
    bottomAction ? "has-bottom-action" : "",
    isHandwritingQuestion ? "handwriting-question-screen" : "",
    `question-ui-${questionUiFamily}`,
  ]
    .filter(Boolean)
    .join(" ");
  const boardClass = [
    "puzzle-board",
    isHandwritingQuestion ? "handwriting-question-board" : "",
    isMaterialQuestion ? "material-question-board" : "",
    `question-board-${questionUiFamily}`,
  ]
    .filter(Boolean)
    .join(" ");
  renderShell(`
    <div class="${screenClass}">
      ${renderHeader(puzzleHeader.title, puzzleHeader.subtitle, "levels")}
      <div class="question-flow">
        <section class="${boardClass}">
          <span class="badge">${getPuzzleModeLabel(level.puzzleMode)}</span>
          ${renderQuestionFocus(currentQuestion, focusKnowledge)}
          ${
            currentQuestion.audioKey
              ? `<span hidden data-question-audio-key="${currentQuestion.audioKey}" data-question-audio-src="${resolveAudioSrc(currentQuestion.audioSrc, currentQuestion.audioKey)}"></span>`
              : ""
          }
          ${
            shouldShowReadingCard(currentQuestion, focusKnowledge)
              ? `
                <div class="reading-card">
                  <button
                    class="sound-button large"
                    data-audio-key="${focusKnowledge.audioKey}"
                    data-audio-src="${focusKnowledge.audioSrc}"
                    ${replayInfo.limited ? `data-replay-limited-question-id="${currentQuestion.id}" data-replay-limit="${replayInfo.limit}"` : ""}
                    ${replayInfo.limited && replayInfo.remaining <= 0 ? "disabled" : ""}
                    aria-label="重听读音"
                  >▶</button>
                  <div>
                    <strong>${getReadingCardTitle(currentQuestion, focusKnowledge)}</strong>
                    ${readingCardDescription ? `<span>${readingCardDescription}</span>` : ""}
                    ${renderReplayLimitNote(currentQuestion, session)}
                  </div>
                </div>
              `
              : ""
          }
          ${shouldShowQuestionHeading(currentQuestion, focusKnowledge) ? `<h2>${currentQuestion.questionText}</h2>` : ""}
          ${renderPetalMeter(session.correctCount, levelQuestions.length)}
          <p class="puzzle-progress-copy">${progressLabel} · 点亮 ${session.correctCount} 片花瓣。</p>
          ${renderRetryChanceNote(level, session)}
        </section>
        ${
          shouldShowFeedback
            ? `<div class="question-feedback-toast is-active ${feedbackClass}" id="feedback" aria-live="polite">${feedbackText}</div>`
            : ""
        }
        ${renderQuestionControls(currentQuestion, session)}
      </div>
      ${bottomAction ? `<div class="question-action-slot">${bottomAction}</div>` : ""}
    </div>
  `);
}

function renderStudyCard(level, focusKnowledge, session = state.playSession) {
  const hasWordSeeds = !session?.remedialMode && getLevelWordItems(level).length > 0;
  const hasAudio = Boolean(focusKnowledge.audioKey);
  const writtenForm = getKnowledgeWrittenForm(focusKnowledge);
  const readingText = getKnowledgeReadingText(focusKnowledge);
  renderShell(`
    <div class="screen puzzle-screen ${hasWordSeeds ? "study-word-screen" : ""}">
      ${renderHeader(level.title, level.subtitle, "levels")}
      <section class="puzzle-board study-board">
        <span class="badge">先认识</span>
        <div class="kana-focus">${writtenForm}</div>
        <h2>${writtenForm} 的${hasAudio ? "声音" : focusKnowledge.type === "kanji" ? "读法" : "规则"}</h2>
        <p>${focusKnowledge.type === "kanji" && readingText ? `${readingText} · ${focusKnowledge.chinese}` : focusKnowledge.chinese}</p>
        ${
          hasAudio
            ? `<button class="sound-button large" data-audio-key="${focusKnowledge.audioKey}" data-audio-src="${focusKnowledge.audioSrc}" aria-label="播放读音">▶</button>`
            : ""
        }
      </section>
      ${hasWordSeeds ? renderWordSeeds(level) : ""}
      <button class="primary-button full" data-start-review="${level.id}">先熟悉一下</button>
    </div>
  `);
}

function renderFamiliarPractice(level, focusKnowledge, session = state.playSession) {
  const pairedKnowledge = focusKnowledge.audioKey && (focusKnowledge.script === "katakana" || focusKnowledge.category === "katakana-vowel" || focusKnowledge.category === "katakana-kana")
    ? knowledge.find((item) => (item.script === "hiragana" || item.category === "hiragana-vowel" || item.category === "hiragana-kana") && item.romaji === focusKnowledge.romaji)
    : null;
  const progressItems = (level.newKnowledgeIds.length
    ? level.newKnowledgeIds.map((id) => knowledge.find((item) => item.id === id))
    : [focusKnowledge]
  ).filter(Boolean);
  const usesHandwriting = sessionUsesHandwriting(level, session, focusKnowledge);
  const hasAudio = Boolean(focusKnowledge.audioKey);
  const writtenForm = getKnowledgeWrittenForm(focusKnowledge);
  const readingText = getKnowledgeReadingText(focusKnowledge);

  renderShell(`
    <div class="screen puzzle-screen">
      ${renderHeader("熟悉一下", level.title, "levels")}
      <section class="puzzle-board study-board">
        <span class="badge">练习</span>
        ${
          hasAudio
            ? `<button class="kana-focus" data-audio-key="${focusKnowledge.audioKey}" data-audio-src="${focusKnowledge.audioSrc}" aria-label="播放 ${writtenForm}">
                ${writtenForm}
              </button>`
            : `<div class="kana-focus">${writtenForm}</div>`
        }
        ${
          pairedKnowledge
            ? `<h2>${focusKnowledge.kana} 和 ${pairedKnowledge.kana} 读音相同</h2>`
            : hasAudio
              ? `<h2>多听几遍 ${writtenForm}</h2>`
              : `<h2>${focusKnowledge.type === "kanji" ? `读作 ${readingText}` : `记住 ${writtenForm} 的作用`}</h2>`
        }
        <p>${
          pairedKnowledge
            ? `${focusKnowledge.kana} 对应 ${pairedKnowledge.kana}，先建立形状和读音的对应关系。`
            : hasAudio
              ? "先听声音，看形状，再进入后面的练习。"
              : focusKnowledge.type === "kanji"
                ? focusKnowledge.chinese
                : focusKnowledge.chinese
        }</p>
      </section>
      ${pairedKnowledge ? renderKatakanaProgressTile(focusKnowledge, pairedKnowledge) : renderPracticeProgress(progressItems, focusKnowledge)}
      <button class="primary-button full" data-finish-practice="${level.id}">
        ${usesHandwriting ? "继续练写" : "开始小测"}
      </button>
    </div>
  `);
}

function renderPracticeProgress(items, focusKnowledge) {
  return `
    <section class="practice-strip" aria-label="熟悉练习">
      ${items
        .map(
          (item) => `
            <button ${item.audioKey ? `data-audio-key="${item.audioKey}" data-audio-src="${item.audioSrc || ""}"` : ""} class="${item.id === focusKnowledge.id ? "active" : ""}">
              <strong>${getKnowledgeWrittenForm(item)}</strong>
              <span>${getKnowledgeReadingText(item)}</span>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderKatakanaProgressTile(focusKnowledge, pairedKnowledge) {
  return `
    <section class="script-pair-tile" aria-label="片假名进度">
      <button data-audio-key="${focusKnowledge.audioKey}" data-audio-src="${focusKnowledge.audioSrc}">
        <strong>${focusKnowledge.kana}</strong>
        <span>${pairedKnowledge.kana}</span>
        <small>${focusKnowledge.romaji}</small>
      </button>
    </section>
  `;
}

function renderReviewWordStudy(level, session) {
  const wordItems = getWordReviewItemsForSession(level, session);
  const safeIndex = Math.min(Math.max(Number(session.wordReviewIndex || 0), 0), Math.max(wordItems.length - 1, 0));
  const safeRound = Math.min(Math.max(Number(session.wordReviewRound || 0), 0), WORD_REVIEW_ROUNDS - 1);
  const isLastStep = safeRound >= WORD_REVIEW_ROUNDS - 1 && safeIndex >= wordItems.length - 1;
  renderShell(`
    <div class="screen puzzle-screen word-review-screen">
      ${renderHeader(level.title, "先熟悉，后面再抽查。", "levels")}
      ${renderWordReview(level, session)}
      ${
        isLastStep
          ? `<button class="primary-button full" data-finish-word-review="${level.id}">开始巩固</button>`
          : `<button class="primary-button full" data-next-word-review="${level.id}">记住了，下一个</button>`
      }
    </div>
  `);
}

function renderOfficialStrokeDemo(focusKnowledge) {
  const model = getFrontendHandwritingModel(focusKnowledge.id);
  const writtenForm = getKnowledgeWrittenForm(focusKnowledge);
  if (model?.officialAnimationSrc) {
    return `
      <figure class="official-stroke-demo">
        <img src="${model.officialAnimationSrc}" alt="${writtenForm} 的标准笔顺动画">
      </figure>
    `;
  }
  return `
    <figure class="official-stroke-demo pending-stroke-demo">
      <strong>${writtenForm}</strong>
    </figure>
  `;
}

function renderWritingPad(focusKnowledge, mode) {
  return `
    <div class="writing-pad-wrap">
      <canvas
        id="handwriting-canvas"
        class="writing-pad"
        width="640"
        height="420"
        aria-label="手写画板"
        data-knowledge-id="${focusKnowledge.id}"
        data-writing-mode="${mode}"
      ></canvas>
    </div>
  `;
}

function renderHandwritingDemo(level, focusKnowledge) {
  const model = getFrontendHandwritingModel(focusKnowledge.id);
  const readingText = getKnowledgeReadingText(focusKnowledge);
  renderShell(`
    <div class="screen puzzle-screen stroke-preview-screen question-ui-handwriting">
      ${renderHeader("看笔顺", `${level.title}${readingText ? ` · ${readingText}` : ""}`, "levels")}
      <section class="puzzle-board handwriting-board stroke-preview-board">
        <span class="badge">${model?.officialAnimationSrc ? "慢动作示范" : "写法练习"}</span>
        ${renderOfficialStrokeDemo(focusKnowledge)}
        <p>${model?.officialAnimationSrc ? "看标准笔顺动画，下一步跟着写。" : "先记住这个形状，下一步跟着写。"}</p>
      </section>
      <button class="primary-button full" data-finish-handwriting-demo="${level.id}">跟着写一遍</button>
    </div>
  `);
}

function renderHandwritingTrace(level, focusKnowledge) {
  const handwritingFeedback = state.playSession?.feedback || "写一遍，稳稳收笔。";
  const feedbackClass = state.playSession?.feedback ? "is-active is-wrong" : "";
  const readingText = getKnowledgeReadingText(focusKnowledge);
  renderShell(`
    <div class="screen puzzle-screen has-bottom-action handwriting-stage-screen question-ui-handwriting">
      ${renderHeader("跟着写", `顺着笔画走${readingText ? ` · ${readingText}` : ""}`, "levels")}
      <div class="question-flow">
        <section class="puzzle-board handwriting-board question-board-handwriting">
          <span class="badge">跟写</span>
          ${renderOfficialStrokeDemo(focusKnowledge)}
          ${renderWritingPad(focusKnowledge, "trace")}
          <p>看完动画后写一遍，感觉不顺就重写。</p>
          <div class="handwriting-reset-row">
            <button class="secondary-button full" data-clear-handwriting>重写</button>
          </div>
        </section>
        <div class="feedback-line ${feedbackClass}" id="handwriting-feedback">${handwritingFeedback}</div>
      </div>
      <div class="question-action-slot">
        <button class="primary-button full" data-finish-handwriting-trace="${level.id}" disabled>OK</button>
      </div>
    </div>
  `);
}

function renderHandwritingCheck(level, focusKnowledge) {
  const handwritingFeedback = state.playSession?.feedback || "写一遍，稳稳收笔。";
  const feedbackClass = state.playSession?.feedback ? "is-active is-wrong" : "";
  const promptText = getKnowledgeReadingText(focusKnowledge);
  renderShell(`
    <div class="screen puzzle-screen has-bottom-action handwriting-stage-screen question-ui-handwriting">
      ${renderHeader("自己写", `只看读音${promptText ? ` · ${promptText}` : ""}`, "levels")}
      <div class="question-flow">
        <section class="puzzle-board handwriting-board question-board-handwriting">
          <span class="badge">默写</span>
          <div class="romaji-writing-prompt" aria-label="罗马音提示">
            <span>${promptText}</span>
          </div>
          ${renderWritingPad(focusKnowledge, "memory")}
          <p>看到读音后，把对应的假名写出来。</p>
          <div class="handwriting-reset-row">
            <button class="secondary-button full" data-clear-handwriting>重写</button>
          </div>
        </section>
        <div class="feedback-line ${feedbackClass}" id="handwriting-feedback">${handwritingFeedback}</div>
      </div>
      <div class="question-action-slot">
        <button class="primary-button full" data-finish-handwriting="${level.id}" disabled>OK</button>
      </div>
    </div>
  `);
}

function renderQuizReady(level, focusKnowledge) {
  const promptText = getKnowledgeReadingText(focusKnowledge);
  renderShell(`
    <div class="screen puzzle-screen">
      ${renderHeader("听音练习", `读音${promptText ? ` · ${promptText}` : ""}`, "levels")}
      <section class="puzzle-board study-board">
        <span class="badge">下一步</span>
        <div class="romaji-writing-prompt" aria-label="读音提示">
          <span>${promptText}</span>
        </div>
        <h2>听声音，选假名</h2>
        <p>下一题会播放读音。</p>
      </section>
      <button class="primary-button full" data-start-quiz="${level.id}">开始听音练习</button>
    </div>
  `);
}

function renderHeader(title, subtitle, backRoute) {
  return `
    <header class="page-header">
      <button class="icon-button" data-back-route="${backRoute}" aria-label="返回">←</button>
      <div>
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
    </header>
  `;
}

function render() {
  syncActiveSessionToSave();
  const shouldAnimateRoute = state.route !== lastRenderedRoute;
  const routes = {
    home: renderHome,
    map: renderMap,
    levels: renderLevels,
    puzzle: renderPuzzle,
    settings: renderSettings,
    review: renderReviewCenter,
    collection: renderCollection,
  };

  routes[state.route]?.();
  app.querySelector(".screen")?.classList.toggle("route-enter", shouldAnimateRoute);
  lastRenderedRoute = state.route;
  bindEvents();
}

function syncAudioSettings() {
  const volume = Number(state.save.settings?.volume ?? 1);
  audioService.enabled = state.save.settings?.audioEnabled !== false;
  audioService.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

function setupAudioActivation() {
  if (window.__vowelGardenAudioActivationSetup) return;
  window.__vowelGardenAudioActivationSetup = true;

  const unlockAudio = () => {
    syncAudioSettings();
    audioService.unlock?.().catch(() => {});
    if (state.route === "puzzle") {
      window.setTimeout(() => setupAutoAudio(), 80);
    }
  };

  document.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true });
  document.addEventListener("touchstart", unlockAudio, { capture: true, passive: true });
  window.addEventListener("focus", unlockAudio);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) unlockAudio();
  });
}

function bindEvents() {
  syncAudioSettings();

  document.querySelectorAll("[data-route]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      navigate(element.dataset.route);
    });
  });

  document.querySelectorAll("[data-back-route]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      goBack();
    });
  });

  document.querySelectorAll("[data-level]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      const level = levels.find((item) => item.id === element.dataset.level);
      if (!level || !isLevelUnlocked(level)) return;
      if (state.playSession?.levelId === level.id) {
        resumeOrStartLevel(level.id);
        return;
      }
      startLevel(level.id);
    });
  });

  document.querySelectorAll("[data-start-home-level]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      const level = levels.find((item) => item.id === element.dataset.startHomeLevel);
      if (!level || !isLevelUnlocked(level)) {
        navigate("levels");
        return;
      }
      resumeOrStartLevel(level.id);
    });
  });

  document.querySelectorAll("[data-start-review-center]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      const level = levels.find((item) => item.id === element.dataset.startReviewCenter);
      if (!level || !isLevelUnlocked(level)) return;
      startLevel(level.id);
    });
  });

  document.querySelectorAll("[data-start-wrong-review]").forEach((element) => {
    element.addEventListener("click", () => {
      if (!buildWrongReviewQuestions().length) return;
      audioService.playUiCue("click");
      startWrongReview();
    });
  });

  document.querySelectorAll("[data-start-dimension-review]").forEach((element) => {
    element.addEventListener("click", () => {
      const dimensionId = element.dataset.startDimensionReview;
      if (!getDimensionReviewKnowledgeIds(dimensionId).length) return;
      audioService.playUiCue("click");
      startDimensionReview(dimensionId);
    });
  });

  document.querySelectorAll("[data-claim-daily]").forEach((element) => {
    element.addEventListener("click", () => {
      claimDailyReward();
    });
  });

  document.querySelectorAll("[data-complete]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("complete");
      completeLevel(element.dataset.complete, 1);
    });
  });

  document.querySelectorAll("[data-tutorial-next]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.tutorialNext;
      const nextStep = (state.playSession?.tutorialStep || 0) + 1;

      if (nextStep >= tutorialSteps.length) {
        audioService.playUiCue("complete");
        state.playSession = {
          ...state.playSession,
          correctCount: 1,
        };
        completeLevel(levelId, 3);
        return;
      }

      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...state.playSession,
          tutorialStep: nextStep,
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-answer]").forEach((element) => {
    element.addEventListener("click", () => {
      const answer = element.dataset.answer;
      const session = state.playSession;
      if (!session) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      if (!currentQuestion || session.answered) return;

      const isCorrect = answer === currentQuestion.correctAnswer;
      applyQuestionResult(clearTransientFeedback(session), currentQuestion, answer, isCorrect);
    });
  });

  document.querySelectorAll("[data-option-audio-key]").forEach((element) => {
    const playOptionAudio = (event) => {
      event.preventDefault();
      event.stopPropagation();
      audioService.unlock?.().catch(() => {});
      audioService.play(resolveAudioSrc(element.dataset.optionAudioSrc, element.dataset.optionAudioKey), element.dataset.optionAudioKey);
    };
    element.addEventListener("click", playOptionAudio);
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      playOptionAudio(event);
    });
  });

  document.querySelectorAll("[data-order-token]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      if (currentQuestion?.questionType !== "sentence-order" && currentQuestion?.questionType !== "word-spell") return;
      const chunk = element.dataset.orderToken;
      const selected = Array.isArray(session.sentenceOrder) ? session.sentenceOrder : [];
      if (!chunk || selected.includes(chunk)) return;
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: clearTransientFeedback(session, {
          sentenceOrder: [...selected, chunk],
          selectedAnswer: null,
        }),
      };
      render();
    });
  });

  document.querySelectorAll("[data-order-remove]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      const removeIndex = Number(element.dataset.orderRemove);
      const selected = Array.isArray(session.sentenceOrder) ? session.sentenceOrder : [];
      if (!Number.isInteger(removeIndex) || removeIndex < 0 || removeIndex >= selected.length) return;
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: clearTransientFeedback(session, {
          sentenceOrder: selected.filter((_, index) => index !== removeIndex),
          selectedAnswer: null,
        }),
      };
      render();
    });
  });

  document.querySelectorAll("[data-submit-sentence-order]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      if (currentQuestion?.questionType !== "sentence-order" && currentQuestion?.questionType !== "word-spell") return;
      const selected = Array.isArray(session.sentenceOrder) ? session.sentenceOrder : [];
      const tokens = getOrderTokens(getSessionOptions(session, currentQuestion));
      const answer = selected.map((entry) => getOrderSelectionLabel(entry, tokens)).join("|");
      applyQuestionResult(clearTransientFeedback(session), currentQuestion, answer, answer === currentQuestion.correctAnswer);
    });
  });

  const submitRomajiInput = () => {
    const session = state.playSession;
    if (!session || session.answered) return;
    const currentQuestion = getSessionQuestions(session)[session.questionIndex];
    if (currentQuestion?.questionType !== "romaji-input") return;
    const answer = (session.typedAnswer || "").trim().toLowerCase();
    const acceptedAnswers = currentQuestion.acceptedAnswers || [currentQuestion.correctAnswer];
    applyQuestionResult(clearTransientFeedback(session), currentQuestion, answer, acceptedAnswers.includes(answer));
  };

  const submitKanaInput = () => {
    const session = state.playSession;
    if (!session || session.answered) return;
    const currentQuestion = getSessionQuestions(session)[session.questionIndex];
    if (currentQuestion?.questionType !== "kana-input") return;
    const answer = normalizeKanaInputAnswer(session.typedAnswer);
    const acceptedAnswers = (currentQuestion.acceptedAnswers || [currentQuestion.correctAnswer]).map(normalizeKanaInputAnswer);
    applyQuestionResult(clearTransientFeedback(session), currentQuestion, answer, acceptedAnswers.includes(answer));
  };

  document.querySelectorAll("[data-romaji-input]").forEach((element) => {
    element.addEventListener("input", () => {
      state = {
        ...state,
        playSession: clearTransientFeedback(state.playSession, {
          selectedAnswer: null,
          typedAnswer: element.value,
        }),
      };
    });
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state = {
        ...state,
        playSession: clearTransientFeedback(state.playSession, {
          selectedAnswer: null,
          typedAnswer: element.value,
        }),
      };
      submitRomajiInput();
    });
  });

  document.querySelectorAll("[data-submit-romaji]").forEach((element) => {
    element.addEventListener("click", submitRomajiInput);
  });

  document.querySelectorAll("[data-kana-input]").forEach((element) => {
    element.addEventListener("input", () => {
      state = {
        ...state,
        playSession: clearTransientFeedback(state.playSession, {
          selectedAnswer: null,
          typedAnswer: element.value,
        }),
      };
    });
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state = {
        ...state,
        playSession: clearTransientFeedback(state.playSession, {
          selectedAnswer: null,
          typedAnswer: element.value,
        }),
      };
      submitKanaInput();
    });
  });

  document.querySelectorAll("[data-submit-kana]").forEach((element) => {
    element.addEventListener("click", submitKanaInput);
  });

  document.querySelectorAll("[data-speech-play-target]").forEach((element) => {
    element.addEventListener("click", () => {
      const audioKey = element.dataset.audioKey;
      const audioSrc = element.dataset.audioSrc;
      if (!audioKey && !audioSrc) return;
      audioService.play(resolveAudioSrc(audioSrc, audioKey), audioKey);
    });
  });

  document.querySelectorAll("[data-speech-start]").forEach((element) => {
    element.addEventListener("click", async () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      if (!isSpeechQuestion(currentQuestion)) return;
      try {
        await speechService.deleteRecording();
        await speechService.startRecording();
        state = {
          ...state,
          playSession: clearTransientFeedback(session, {
            speechRecording: true,
            speechRecorded: false,
            speechPassed: false,
            speechDurationMs: 0,
            speechTranscript: "",
            speechEngine: "",
            feedback: "正在录音。",
          }),
        };
      } catch {
        state = {
          ...state,
          playSession: clearTransientFeedback(session, {
            speechRecording: false,
            feedback: "麦克风没有准备好，检查权限后再试。",
          }),
        };
      }
      render();
    });
  });

  document.querySelectorAll("[data-speech-stop]").forEach((element) => {
    element.addEventListener("click", async () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      if (!isSpeechQuestion(currentQuestion)) return;
      const recordingResult = await speechService.stopRecording();
      const recognitionResult = await speechService.recognizeRecording(currentQuestion, recordingResult);
      const evaluation = speechService.evaluateRecording(currentQuestion, recordingResult, recognitionResult);
      state = {
        ...state,
        playSession: clearTransientFeedback(session, {
          speechRecording: false,
          speechRecorded: Boolean(recordingResult.hasRecording),
          speechPassed: Boolean(evaluation.passed),
          speechDurationMs: recordingResult.durationMs || 0,
          speechTranscript: evaluation.transcript || "",
          speechEngine: evaluation.engine || "",
          feedback: evaluation.message,
        }),
      };
      render();
    });
  });

  document.querySelectorAll("[data-speech-play-recording]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session?.speechRecorded) return;
      speechService.playRecording().catch(() => {
        state = {
          ...state,
          playSession: clearTransientFeedback(session, {
            feedback: "这段录音暂时不能播放。",
          }),
        };
        render();
      });
    });
  });

  document.querySelectorAll("[data-submit-speech]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered || !session.speechPassed) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      if (!isSpeechQuestion(currentQuestion)) return;
      advanceCorrectQuestion(
        clearTransientFeedback(session, {
          feedback: "OK",
        }),
        currentQuestion,
        { delay: true },
      );
    });
  });

  document.querySelectorAll("[data-submit-handwriting-question]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      const canvas = document.querySelector("#handwriting-canvas");
      const result = validateHandwriting(canvas?.dataset.knowledgeId, window.vowelGardenHandwritingStrokes || [], canvas);
      if (result.passed) {
        advanceCorrectQuestion(clearTransientFeedback(session), currentQuestion, { delay: true });
        return;
      }
      audioService.playUiCue("wrong");
      state = {
        ...state,
        playSession: {
          ...clearTransientFeedback(session),
          answered: false,
          failed: false,
          selectedAnswer: null,
          autoPlayedQuestionId: null,
          feedback: result.message,
          celebration: getQuestionCelebration(currentQuestion, false),
          autoAdvance: false,
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-pair-left]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      if (element.dataset.pairAudioKey) {
        audioService.play(resolveAudioSrc(element.dataset.pairAudioSrc, element.dataset.pairAudioKey), element.dataset.pairAudioKey);
      }
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: clearTransientFeedback(session, {
          selectedPairLeft: element.dataset.pairLeft,
          pairWrong: null,
        }),
      };
      render();
    });
  });

  document.querySelectorAll("[data-pair-right]").forEach((element) => {
    element.addEventListener("click", () => {
      const session = state.playSession;
      if (!session || session.answered) return;
      if (!session.selectedPairLeft) {
        if (session.feedback || session.celebration) {
          state = {
            ...state,
            playSession: clearTransientFeedback(session, { pairWrong: null }),
          };
          render();
        }
        return;
      }
      const right = element.dataset.pairRight;
      const matches = session.pairMatches || [];
      if (matches.some((match) => match.right === right || match.left === session.selectedPairLeft)) return;
      const currentQuestion = getSessionQuestions(session)[session.questionIndex];
      const isCorrect = getPairRightByLeft(currentQuestion, session.selectedPairLeft) === right;
      const nextMatches = isCorrect ? [...matches, { left: session.selectedPairLeft, right }] : matches;
      const isComplete = isCorrect && nextMatches.length === (currentQuestion.pairs || []).length;
      if (!isCorrect) {
        applyQuestionResult(
          {
            ...clearTransientFeedback(session),
            selectedPairLeft: null,
            pairWrong: { left: session.selectedPairLeft, right },
            pairMatches: nextMatches,
          },
          currentQuestion,
          "配对",
          false,
        );
        return;
      }
      if (isComplete) {
        applyQuestionResult(
          {
            ...clearTransientFeedback(session),
            selectedPairLeft: null,
            pairWrong: null,
            pairMatches: nextMatches,
            feedback: getPairMatchProgressText(currentQuestion),
          },
          currentQuestion,
          "配对",
          true,
        );
        return;
      }
      audioService.playUiCue("correct");
      state = {
        ...state,
        playSession: {
          ...clearTransientFeedback(session),
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: nextMatches,
          feedback: getPairMatchProgressText(currentQuestion),
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-start-review]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.startReview;
      const level = getLevelById(levelId);
      const currentSession = state.playSession || createPlaySession(levelId);
      const focusKnowledge = getSessionFocusKnowledge(level, currentSession);
      const usesHandwriting = sessionUsesHandwriting(level, currentSession, focusKnowledge);
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...currentSession,
          levelId,
          studySeen: true,
          practiceSeen: false,
          handwritingDemoSeen: false,
          handwritingTraceDone: false,
          handwritingDone: false,
          readyForQuiz: !usesHandwriting,
          wordReviewSeen: false,
          wordReviewRound: 0,
          wordReviewIndex: 0,
          questionIndex: 0,
          correctCount: 0,
          answered: false,
          failed: false,
          selectedAnswer: null,
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: [],
          sentenceOrder: [],
          typedAnswer: "",
          questionWrongAttempts: 0,
          levelWrongAttempts: currentSession.levelWrongAttempts || 0,
          feedback: "",
          celebration: null,
          questionQueue: [],
          optionQueue: {},
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-finish-practice]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.finishPractice;
      const level = getLevelById(levelId);
      const currentSession = state.playSession || createPlaySession(levelId);
      const focusKnowledge = getSessionFocusKnowledge(level, currentSession);
      const usesHandwriting = sessionUsesHandwriting(level, currentSession, focusKnowledge);
      const questionQueue = usesHandwriting ? [] : buildQuestionQueue(level.id);
      audioService.playUiCue("click");
      if (currentSession.remedialMode === "kana" && !usesHandwriting) {
        state = {
          ...state,
          playSession: getRestartedQuizSession(currentSession, levelId),
        };
        render();
        return;
      }
      state = {
        ...state,
        playSession: {
          ...currentSession,
          levelId,
          practiceSeen: true,
          readyForQuiz: !usesHandwriting,
          questionIndex: 0,
          correctCount: 0,
          answered: false,
          failed: false,
          autoPlayedQuestionId: null,
          selectedAnswer: null,
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: [],
          sentenceOrder: [],
          typedAnswer: "",
          questionWrongAttempts: 0,
          levelWrongAttempts: currentSession.levelWrongAttempts || 0,
          feedback: "",
          celebration: null,
          questionQueue,
          optionQueue: usesHandwriting ? {} : buildOptionQueue(level.id, questionQueue),
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-finish-handwriting-demo]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...state.playSession,
          levelId: element.dataset.finishHandwritingDemo,
          handwritingDemoSeen: true,
          handwritingTraceDone: false,
          handwritingDone: false,
          readyForQuiz: false,
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-finish-handwriting-trace]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.finishHandwritingTrace;
      const canvas = document.querySelector("#handwriting-canvas");
      const result = validateHandwriting(canvas?.dataset.knowledgeId, window.vowelGardenHandwritingStrokes || [], canvas);
      const feedback = document.querySelector("#handwriting-feedback");
      if (!result.passed) {
        audioService.playUiCue("wrong");
        state = {
          ...state,
          playSession: {
            ...state.playSession,
            feedback: result.message,
            celebration: getQuestionCelebration({ questionType: "handwriting-check" }, false),
            autoAdvance: false,
          },
        };
        if (feedback) feedback.textContent = result.message;
        render();
        return;
      }

      audioService.playUiCue("correct");
      state = {
        ...state,
        playSession: {
          ...state.playSession,
          levelId,
          handwritingTraceDone: true,
          handwritingDone: false,
          readyForQuiz: false,
          feedback: result.message,
          celebration: getQuestionCelebration({ questionType: "handwriting-check" }, true),
          autoAdvance: true,
        },
      };
      render();
      const sessionToken = state.playSession?.sessionToken;
      window.setTimeout(() => {
        if (state.route !== "puzzle" || state.playSession?.sessionToken !== sessionToken || state.playSession?.levelId !== levelId || !state.playSession?.handwritingTraceDone) return;
        state = {
          ...state,
          playSession: {
            ...state.playSession,
            celebration: null,
            autoAdvance: false,
          },
        };
        render();
      }, HANDWRITING_ADVANCE_DELAY_MS);
    });
  });

  document.querySelectorAll("[data-finish-handwriting]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.finishHandwriting;
      const canvas = document.querySelector("#handwriting-canvas");
      const result = validateHandwriting(canvas?.dataset.knowledgeId, window.vowelGardenHandwritingStrokes || [], canvas);
      const feedback = document.querySelector("#handwriting-feedback");
      if (!result.passed) {
        audioService.playUiCue("wrong");
        state = {
          ...state,
          playSession: {
            ...state.playSession,
            feedback: result.message,
            celebration: getQuestionCelebration({ questionType: "handwriting-check" }, false),
            autoAdvance: false,
          },
        };
        if (feedback) feedback.textContent = result.message;
        render();
        return;
      }

      audioService.playUiCue("correct");
      state = {
        ...state,
        playSession: {
          ...state.playSession,
          levelId,
          handwritingDone: true,
          readyForQuiz: false,
          questionIndex: 0,
          correctCount: 0,
          answered: false,
          failed: false,
          autoPlayedQuestionId: null,
          selectedAnswer: null,
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: [],
          sentenceOrder: [],
          typedAnswer: "",
          questionWrongAttempts: 0,
          levelWrongAttempts: state.playSession?.levelWrongAttempts || 0,
          feedback: result.message,
          celebration: getQuestionCelebration({ questionType: "handwriting-check" }, true),
          autoAdvance: true,
          questionQueue: [],
          optionQueue: {},
        },
      };
      render();
      const sessionToken = state.playSession?.sessionToken;
      window.setTimeout(() => {
        if (state.route !== "puzzle" || state.playSession?.sessionToken !== sessionToken || state.playSession?.levelId !== levelId || !state.playSession?.handwritingDone) return;
        state = {
          ...state,
          playSession: {
            ...state.playSession,
            celebration: null,
            autoAdvance: false,
          },
        };
        render();
      }, HANDWRITING_ADVANCE_DELAY_MS);
    });
  });

  document.querySelectorAll("[data-start-quiz]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.startQuiz;
      const currentSession = state.playSession || createPlaySession(levelId);
      if (currentSession.remedialMode === "kana") {
        audioService.playUiCue("click");
        state = {
          ...state,
          playSession: getRestartedQuizSession(currentSession, levelId),
        };
        render();
        return;
      }
      const questionQueue = buildQuestionQueue(levelId);
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...currentSession,
          levelId,
          remedialMode: null,
          remedialKnowledgeId: null,
          readyForQuiz: true,
          questionIndex: 0,
          correctCount: 0,
          answered: false,
          failed: false,
          autoPlayedQuestionId: null,
          selectedAnswer: null,
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: [],
          sentenceOrder: [],
          typedAnswer: "",
          questionWrongAttempts: 0,
          levelWrongAttempts: 0,
          feedback: "",
          celebration: null,
          questionQueue,
          optionQueue: buildOptionQueue(levelId, questionQueue),
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-finish-word-review]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.finishWordReview;
      const currentSession = state.playSession || createPlaySession(levelId);
      if (currentSession.remedialMode === "word") {
        audioService.playUiCue("click");
        state = {
          ...state,
          playSession: getRestartedQuizSession(currentSession, levelId),
        };
        render();
        return;
      }
      const questionQueue = buildQuestionQueue(levelId);
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...currentSession,
          levelId,
          remedialMode: null,
          remedialKnowledgeId: null,
          wordReviewSeen: true,
          wordReviewRound: 0,
          wordReviewIndex: 0,
          readyForQuiz: true,
          questionIndex: 0,
          correctCount: 0,
          answered: false,
          failed: false,
          autoPlayedQuestionId: null,
          selectedAnswer: null,
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: [],
          sentenceOrder: [],
          typedAnswer: "",
          questionWrongAttempts: 0,
          levelWrongAttempts: 0,
          feedback: "",
          celebration: null,
          questionQueue,
          optionQueue: buildOptionQueue(levelId, questionQueue),
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-restart-level]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("wrong");
      startLevel(element.dataset.restartLevel);
    });
  });

  document.querySelectorAll("[data-question-next]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.questionNext;
      const session = state.playSession;
      const levelQuestions = getSessionQuestions(session);
      if (!session) return;

      if (session.questionIndex >= levelQuestions.length - 1) {
        completeLevel(levelId, getStars(session.correctCount, levelQuestions.length));
        return;
      }

      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...session,
          questionIndex: session.questionIndex + 1,
          answered: false,
          failed: false,
          autoPlayedQuestionId: null,
          selectedAnswer: null,
          selectedPairLeft: null,
          pairWrong: null,
          pairMatches: [],
          sentenceOrder: [],
          typedAnswer: "",
          questionWrongAttempts: 0,
          levelWrongAttempts: session.levelWrongAttempts || 0,
          feedback: "",
          celebration: null,
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-audio-key]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const replayLimitedQuestionId = element.dataset.replayLimitedQuestionId;
      if (replayLimitedQuestionId) {
        const session = state.playSession;
        const currentQuestion = session ? getSessionQuestions(session)[session.questionIndex] : null;
        const replay = getQuestionReplayInfo(currentQuestion, session);
        if (!session || currentQuestion?.id !== replayLimitedQuestionId || replay.remaining <= 0) {
          if (session) {
            state = {
              ...state,
              playSession: {
                ...session,
                feedback: "先用刚刚听到的内容作答。",
              },
            };
            render();
          }
          return;
        }
        const replayCounts = {
          ...(session.replayCounts || {}),
          [replayLimitedQuestionId]: replay.used + 1,
        };
        state = {
          ...state,
          playSession: {
            ...session,
            replayCounts,
          },
        };
        audioService.unlock?.().catch(() => {});
        audioService.play(resolveAudioSrc(element.dataset.audioSrc, element.dataset.audioKey), element.dataset.audioKey);
        render();
        return;
      }
      audioService.unlock?.().catch(() => {});
      audioService.play(resolveAudioSrc(element.dataset.audioSrc, element.dataset.audioKey), element.dataset.audioKey);
    });
  });

  document.querySelectorAll("[data-request-reset]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      state = {
        ...state,
        resetConfirmPending: true,
      };
      render();
    });
  });

  document.querySelectorAll("[data-cancel-reset]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("click");
      state = {
        ...state,
        resetConfirmPending: false,
      };
      render();
    });
  });

  document.querySelectorAll("[data-confirm-reset]").forEach((element) => {
    element.addEventListener("click", () => {
      audioService.playUiCue("wrong");
      state.save = resetSave();
      state.resetConfirmPending = false;
      state.playSession = null;
      state.selectedLevelId = null;
      state.route = "home";
      render();
    });
  });

  document.querySelectorAll("[data-toggle-audio]").forEach((element) => {
    element.addEventListener("click", () => {
      const nextAudioEnabled = !state.save.settings.audioEnabled;
      state.save = {
        ...state.save,
        settings: {
          ...state.save.settings,
          audioEnabled: nextAudioEnabled,
        },
      };
      syncAudioSettings();
      saveGame(state.save);
      if (nextAudioEnabled) {
        audioService.unlock?.().catch(() => {});
        audioService.playUiCue("correct");
      }
      render();
    });
  });

  document.querySelectorAll("[data-next-word-review]").forEach((element) => {
    element.addEventListener("click", () => {
      const levelId = element.dataset.nextWordReview;
      const level = getLevelById(levelId);
      const wordItems = getWordReviewItemsForSession(level, state.playSession);
      if (!state.playSession || !wordItems.length) return;
      const currentIndex = Math.min(Math.max(Number(state.playSession.wordReviewIndex || 0), 0), wordItems.length - 1);
      const currentRound = Math.min(Math.max(Number(state.playSession.wordReviewRound || 0), 0), WORD_REVIEW_ROUNDS - 1);
      const nextIndex = currentIndex + 1 >= wordItems.length ? 0 : currentIndex + 1;
      const nextRound = currentIndex + 1 >= wordItems.length ? Math.min(currentRound + 1, WORD_REVIEW_ROUNDS - 1) : currentRound;
      audioService.playUiCue("click");
      state = {
        ...state,
        playSession: {
          ...state.playSession,
          levelId,
          wordReviewSeen: false,
          readyForQuiz: false,
          wordReviewIndex: nextIndex,
          wordReviewRound: nextRound,
          autoPlayedStudyKey: null,
          feedback: "",
          celebration: null,
        },
      };
      render();
    });
  });

  document.querySelectorAll("[data-volume-slider]").forEach((element) => {
    element.addEventListener("input", () => {
      const volume = Number(element.value) / 100;
      state.save = {
        ...state.save,
        settings: {
          ...state.save.settings,
          volume,
        },
      };
      syncAudioSettings();
      saveGame(state.save);
    });
  });

  document.querySelectorAll("[data-open-contact]").forEach((element) => {
    element.addEventListener("click", async () => {
      audioService.playUiCue("click");
      const type = element.dataset.openContact;
      if (type === "qq") {
        window.location.href = "mqqwpa://im/chat?chat_type=wpa&uin=1667875177&version=1&src_type=web";
        return;
      }
      if (type === "wechat") {
        const copied = await copyTextToClipboard(AUTHOR_WECHAT_ID);
        state = {
          ...state,
          contactNotice: copied ? `微信号 ${AUTHOR_WECHAT_ID} 已经复制好了。` : `微信号是 ${AUTHOR_WECHAT_ID}，打开微信搜一下就好。`,
        };
        render();
        const contactLauncher = window.Capacitor?.Plugins?.ContactLauncher;
        if (contactLauncher?.openWeChat) {
          try {
            await contactLauncher.openWeChat();
            return;
          } catch (error) {
            window.location.href = "weixin://";
            return;
          }
        }
        window.location.href = "weixin://";
        return;
      }
    });
  });

  setupHandwritingCanvas();
  setupAutoAudio();
}

function setupHandwritingCanvas() {
  const canvas = document.querySelector("#handwriting-canvas");
  if (!canvas) return;

  const finishButton = document.querySelector("[data-finish-handwriting], [data-finish-handwriting-trace], [data-submit-handwriting-question]");
  const clearButton = document.querySelector("[data-clear-handwriting]");
  const context = canvas.getContext("2d");
  const isResultLocked = Boolean(state.playSession?.answered || state.playSession?.autoAdvance);
  const isLocked = isResultLocked;
  let isDrawing = false;
  let hasInk = false;
  let lastPoint = null;
  let currentStroke = [];
  window.vowelGardenHandwritingStrokes = [];

  const paintGuide = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fbfcf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(47, 104, 73, 0.16)";
    context.lineWidth = 3;
    context.setLineDash([16, 14]);
    context.beginPath();
    context.moveTo(canvas.width / 2, 28);
    context.lineTo(canvas.width / 2, canvas.height - 28);
    context.moveTo(28, canvas.height / 2);
    context.lineTo(canvas.width - 28, canvas.height / 2);
    context.stroke();
    context.setLineDash([]);
  };

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const isPrimaryDrawInput = (event) => {
    if (event.pointerType === "mouse") {
      return event.isPrimary !== false && event.button !== 1 && event.button !== 2 && (event.buttons === 1 || event.button === 0);
    }
    return event.isPrimary !== false && (event.pointerType === "touch" || event.pointerType === "pen" || event.pointerType === "");
  };

  const enableFinish = () => {
    hasInk = true;
    if (finishButton) finishButton.disabled = false;
  };

  paintGuide();

  if (isLocked) {
    canvas.classList.add("is-locked");
    if (finishButton) finishButton.disabled = true;
    if (clearButton) clearButton.disabled = isResultLocked;
    return;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!isPrimaryDrawInput(event)) return;
    event.preventDefault();
    if (state.playSession?.feedback && !state.playSession?.answered && !state.playSession?.autoAdvance) {
      state = {
        ...state,
        playSession: clearTransientFeedback(state.playSession),
      };
      document.querySelector("#feedback")?.classList.remove("is-active", "is-wrong", "is-prominent");
      document.querySelector(".celebration-overlay")?.remove();
    }
    isDrawing = true;
    lastPoint = getPoint(event);
    currentStroke = [lastPoint];
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDrawing || !lastPoint) return;
    if (!isPrimaryDrawInput(event)) {
      isDrawing = false;
      lastPoint = null;
      currentStroke = [];
      return;
    }
    event.preventDefault();
    const point = getPoint(event);
    context.strokeStyle = "#22302d";
    context.lineWidth = 18;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint = point;
    currentStroke.push(point);
    enableFinish();
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    canvas.addEventListener(eventName, () => {
      if (currentStroke.length >= 2) {
        window.vowelGardenHandwritingStrokes.push(currentStroke);
      }
      isDrawing = false;
      lastPoint = null;
      currentStroke = [];
    });
  });

  clearButton?.addEventListener("click", () => {
    audioService.playUiCue("click");
    hasInk = false;
    window.vowelGardenHandwritingStrokes = [];
    if (finishButton) finishButton.disabled = true;
    if ((canvas.dataset.writingMode === "review" || canvas.dataset.writingMode === "trace" || canvas.dataset.writingMode === "memory") && state.playSession) {
      state = {
        ...state,
        playSession: clearTransientFeedback(state.playSession),
      };
      render();
      return;
    }
    paintGuide();
  });

  finishButton?.addEventListener("click", (event) => {
    if (hasInk) return;
    event.preventDefault();
  });
}

function setupAutoAudio() {
  const session = state.playSession;
  if (!session) return;
  if (session.layoutTestMode) return;
  const studyAudioButton = document.querySelector(".study-board [data-audio-key], .script-pair-tile [data-audio-key], .word-review-focus [data-audio-key]");
  if (studyAudioButton && !session.readyForQuiz && !session.answered) {
    const studyKey = `${state.selectedLevelId}:${studyAudioButton.dataset.audioKey}`;
    if (session.autoPlayedStudyKey !== studyKey) {
      const sessionToken = session.sessionToken;
      state = {
        ...state,
        playSession: {
          ...session,
          autoPlayedStudyKey: studyKey,
        },
      };
      window.setTimeout(() => {
        if (state.route !== "puzzle" || state.playSession?.sessionToken !== sessionToken) return;
        playAutoAudio(
          studyAudioButton.dataset.audioSrc,
          studyAudioButton.dataset.audioKey,
          () => {
            if (state.playSession?.sessionToken !== sessionToken) return;
            state = {
              ...state,
              playSession: {
                ...state.playSession,
                autoPlayedStudyKey: null,
              },
            };
          },
        );
      }, AUTO_AUDIO_STUDY_DELAY_MS);
      return;
    }
  }

  if (session.answered) return;
  if (!session.readyForQuiz) return;
  const currentQuestion = getSessionQuestions(session)[session.questionIndex];
  if (!shouldAutoPlayQuestionAudio(currentQuestion)) return;
  if (session.autoPlayedQuestionId === currentQuestion.id) return;

  const audioButton = document.querySelector("[data-question-audio-key], .reading-card [data-audio-key]");
  if (!audioButton) return;

  state = {
    ...state,
    playSession: {
      ...session,
      autoPlayedQuestionId: currentQuestion.id,
    },
  };

  const sessionToken = session.sessionToken;
  window.setTimeout(() => {
    if (state.route !== "puzzle" || state.playSession?.sessionToken !== sessionToken) return;
    playAutoAudio(
      audioButton.dataset.questionAudioSrc || audioButton.dataset.audioSrc,
      audioButton.dataset.questionAudioKey || audioButton.dataset.audioKey,
      () => {
        if (state.playSession?.sessionToken !== sessionToken) return;
        state = {
          ...state,
          playSession: {
            ...state.playSession,
            autoPlayedQuestionId: null,
          },
        };
      },
    );
  }, AUTO_AUDIO_DELAY_MS);
}

function playAutoAudio(src, audioKey, onRetryNeeded) {
  syncAudioSettings();
  return audioService.play(resolveAudioSrc(src, audioKey), audioKey).then((result) => {
    if (result?.skipped || result?.errorName === "NotAllowedError") {
      onRetryNeeded?.();
    }
    return result;
  });
}

function setupNativeBackButton() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;
  appPlugin.addListener("backButton", () => {
    goBack();
  });
}

function createLayoutTestSession(levelId, questionQueue, overrides = {}) {
  return {
    levelId,
    sessionToken: `${levelId}-layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tutorialStep: 0,
    questionIndex: 0,
    correctCount: 0,
    answered: false,
    failed: false,
    studySeen: true,
    practiceSeen: true,
    handwritingDemoSeen: true,
    handwritingTraceDone: true,
    handwritingDone: true,
    readyForQuiz: true,
    wordReviewSeen: true,
    wordReviewRound: 0,
    wordReviewIndex: 0,
    autoPlayedQuestionId: null,
    autoPlayedStudyKey: null,
    replayCounts: {},
    selectedAnswer: null,
    selectedPairLeft: null,
    pairWrong: null,
    pairMatches: [],
    sentenceOrder: [],
    typedAnswer: "",
    questionWrongAttempts: 0,
    levelWrongAttempts: 0,
    feedback: "",
    celebration: null,
    autoAdvance: false,
    remedialMode: null,
    remedialKnowledgeId: null,
    layoutTestMode: true,
    questionQueue,
    optionQueue: buildOptionQueue(levelId, questionQueue),
    ...overrides,
  };
}

window.vowelGardenLayoutTest = {
  navigate(route, levelId = null) {
    const fallbackLevelId = levels.find((level) => isLevelUnlocked(level))?.id || levels[0]?.id || null;
    state = {
      ...state,
      route,
      selectedLevelId: route === "puzzle" ? levelId || state.selectedLevelId || fallbackLevelId : state.selectedLevelId,
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    if (route !== "puzzle") {
      state.playSession = sanitizeSavedPlaySession(state.save.activeSession, { refreshToken: true, allowCleared: true });
      state.selectedLevelId = state.playSession?.levelId || state.selectedLevelId;
    }
    render();
  },
  startLevel(levelId) {
    if (!getLevelById(levelId)) return false;
    state = {
      ...state,
      route: "puzzle",
      selectedLevelId: levelId,
      playSession: createPlaySession(levelId),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    render();
    return true;
  },
  showQuestionType(levelId, questionType) {
    const level = getLevelById(levelId);
    if (!level) return false;
    const levelQuestions = getLevelQuestions(levelId);
    const question = levelQuestions.find((item) => item.questionType === questionType);
    if (!question) return false;
    const questionQueue = [question.id];
    state = {
      ...state,
      route: "puzzle",
      selectedLevelId: levelId,
      playSession: createLayoutTestSession(levelId, questionQueue),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    render();
    return true;
  },
  showQuestionById(questionId) {
    const question = questions.find((item) => item.id === questionId);
    if (!question) return false;
    const level = getLevelById(question.levelId);
    if (!level) return false;
    const questionQueue = [question.id];
    state = {
      ...state,
      route: "puzzle",
      selectedLevelId: question.levelId,
      playSession: createLayoutTestSession(question.levelId, questionQueue),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    render();
    return true;
  },
  showHandwritingStage(levelId, stage = "check", knowledgeId = null) {
    const level = getLevelById(levelId);
    if (!level) return false;
    const targetKnowledge = knowledgeId ? knowledge.find((item) => item.id === knowledgeId) : null;
    const focusKnowledge = targetKnowledge || knowledge.find((item) => item.id === level.newKnowledgeIds?.[0]);
    if (!levelAllowsHandwriting(level) || !canUseHandwritingForItem(focusKnowledge)) return false;
    const stageStateByName = {
      demo: {
        studySeen: true,
        practiceSeen: true,
        handwritingDemoSeen: false,
        handwritingTraceDone: false,
        handwritingDone: false,
        readyForQuiz: false,
      },
      trace: {
        studySeen: true,
        practiceSeen: true,
        handwritingDemoSeen: true,
        handwritingTraceDone: false,
        handwritingDone: false,
        readyForQuiz: false,
      },
      check: {
        studySeen: true,
        practiceSeen: true,
        handwritingDemoSeen: true,
        handwritingTraceDone: true,
        handwritingDone: false,
        readyForQuiz: false,
      },
      ready: {
        studySeen: true,
        practiceSeen: true,
        handwritingDemoSeen: true,
        handwritingTraceDone: true,
        handwritingDone: true,
        readyForQuiz: false,
      },
    };
    const stageState = stageStateByName[stage];
    if (!stageState) return false;
    state = {
      ...state,
      route: "puzzle",
      selectedLevelId: levelId,
      playSession: createLayoutTestSession(levelId, [], {
        ...stageState,
        remedialMode: targetKnowledge ? "kana" : null,
        remedialKnowledgeId: targetKnowledge?.id || null,
        questionQueue: [],
        optionQueue: {},
        feedback: "",
      }),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    render();
    return true;
  },
  showQuestionFeedbackState(levelId, questionType, stateOptions = {}) {
    const level = getLevelById(levelId);
    if (!level) return false;
    const levelQuestions = getLevelQuestions(levelId);
    const question = levelQuestions.find((item) => item.questionType === questionType);
    if (!question) return false;
    const questionQueue = [question.id];
    const wrongAnswer = question.options?.find((option) => option !== question.correctAnswer) || "";
    const isCorrect = stateOptions.correct === true;
    state = {
      ...state,
      route: "puzzle",
      selectedLevelId: levelId,
      playSession: createLayoutTestSession(levelId, questionQueue, {
        answered: isCorrect,
        failed: !isCorrect && stateOptions.failed === true,
        selectedAnswer: isCorrect ? question.correctAnswer : wrongAnswer,
        typedAnswer: isCorrect ? question.correctAnswer : "x",
        correctCount: isCorrect ? 1 : 0,
        feedback: stateOptions.feedback || (isCorrect ? "很稳，继续。" : "差一点，再来一次。"),
        autoAdvance: false,
      }),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    render();
    return true;
  },
  showWeakReviewDimension(dimensionId, knowledgeId = null) {
    if (!REVIEW_DIMENSION_IDS.has(dimensionId)) return false;
    const fallbackKnowledgeIds = {
      listening: "dialogue-n5-station-bus",
      speaking: "sentence-n5-watashi-gakusei",
      reading: "reading-n5-park-letter",
      writing: "word-n5-watashi",
      usage: "sentence-n5-watashi-gakusei",
    };
    const target = knowledge.find((item) => item.id === (knowledgeId || fallbackKnowledgeIds[dimensionId]));
    if (!target) return false;
    const current = getMasteryRecord(target.id);
    const now = new Date().toISOString();
    state = {
      ...state,
      save: {
        ...state.save,
        mastery: {
          ...(state.save.mastery || {}),
          [target.id]: {
            ...current,
            level: Math.min(current.level || 0, 1),
            wrongCount: Math.max(current.wrongCount || 0, 1),
            lastReviewedAt: now,
            dimensions: {
              ...(current.dimensions || {}),
              [dimensionId]: {
                level: 0,
                correctCount: 0,
                wrongCount: 1,
                lastReviewedAt: now,
              },
            },
          },
        },
      },
    };
    const levelId = `weak-review-${dimensionId}`;
    const levelQuestions = getLevelQuestions(levelId);
    const question = levelQuestions[0];
    if (!question) return false;
    state = {
      ...state,
      route: "puzzle",
      selectedLevelId: levelId,
      playSession: createLayoutTestSession(levelId, [question.id]),
      resetConfirmPending: false,
      backMessage: "",
      contactNotice: "",
      routeHistory: [],
    };
    render();
    return true;
  },
  listLevels() {
    return levels.map((level) => ({
      id: level.id,
      title: level.title,
      puzzleMode: level.puzzleMode,
      order: level.order,
      questionTypes: [...new Set(getLevelQuestions(level.id).map((question) => question.questionType))],
    }));
  },
  listQuestions() {
    return questions.map((question) => ({
      id: question.id,
      levelId: question.levelId,
      questionType: question.questionType,
      knowledgeIds: question.knowledgeIds || [],
      correctAnswer: question.correctAnswer || "",
      prompt: question.prompt || "",
      inputScript: question.inputScript || "",
    }));
  },
  snapshot() {
    const screen = document.querySelector(".screen");
    const activeQuestion = state.playSession ? getSessionQuestions(state.playSession)[state.playSession.questionIndex] : null;
    const screenQuestionUiFamily = getQuestionUiFamilyFromScreen(screen);
    return {
      route: state.route,
      selectedLevelId: state.selectedLevelId,
      screenClass: screen?.className || "",
      bodyText: document.body.innerText.slice(0, 500),
      questionType: activeQuestion?.questionType || null,
      questionUiFamily: screenQuestionUiFamily || (activeQuestion ? getQuestionUiFamily(activeQuestion) : null),
      questionKnowledgeIds: activeQuestion?.knowledgeIds || [],
      romajiInputPlaceholder: document.querySelector("[data-romaji-input]")?.getAttribute("placeholder") || "",
      kanaInputPlaceholder: document.querySelector("[data-kana-input]")?.getAttribute("placeholder") || "",
      levelId: state.playSession?.levelId || null,
      questionIndex: state.playSession?.questionIndex ?? null,
      audioMarkers: document.querySelectorAll("[data-question-audio-key], [data-audio-key], [data-pair-audio-key]").length,
      optionAudioButtons: document.querySelectorAll("[data-option-audio-key]").length,
      rightPairAudioMarkers: document.querySelectorAll("[data-pair-right] [data-audio-key], [data-pair-right][data-audio-key], [data-pair-right] [data-pair-audio-key], [data-pair-right][data-pair-audio-key]").length,
      optionButtons: document.querySelectorAll(".option-grid button").length,
      sentenceOrderButtons: document.querySelectorAll("[data-order-token], [data-order-remove]").length,
      pairLeftButtons: document.querySelectorAll("[data-pair-left]").length,
      pairRightButtons: document.querySelectorAll("[data-pair-right]").length,
      handwritingCanvas: Boolean(document.querySelector("#handwriting-canvas, .writing-pad")),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  },
};

setupNativeBackButton();
setupAudioActivation();
render();
