const SAVE_KEY = "vowel-garden-save-v1";

export const defaultSave = {
  version: 1,
  playerLevel: 1,
  exp: 0,
  coins: 0,
  currentStage: "vowel-garden",
  clearedLevels: [],
  starRecords: {},
  unlockedCards: [],
  mastery: {},
  pet: {
    id: "sprout",
    level: 1,
    exp: 0,
  },
  daily: {
    date: null,
    answered: 0,
    correct: 0,
    cleared: 0,
    claimed: false,
  },
  learningStats: {
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
  },
  dailyStreak: 0,
  lastLoginDate: null,
  wrongQuestions: [],
  activeSession: null,
  settings: {
    audioEnabled: true,
    volume: 0.8,
  },
};

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return structuredClone(defaultSave);
    }

    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultSave),
      ...parsed,
      pet: {
        ...structuredClone(defaultSave.pet),
        ...(parsed.pet || {}),
      },
      daily: {
        ...structuredClone(defaultSave.daily),
        ...(parsed.daily || {}),
      },
      learningStats: {
        ...structuredClone(defaultSave.learningStats),
        ...(parsed.learningStats || {}),
        daily: {
          ...structuredClone(defaultSave.learningStats.daily),
          ...(parsed.learningStats?.daily || {}),
        },
        recentResults: Array.isArray(parsed.learningStats?.recentResults) ? parsed.learningStats.recentResults : [],
      },
      settings: {
        ...structuredClone(defaultSave.settings),
        ...(parsed.settings || {}),
      },
      activeSession: parsed.activeSession || null,
    };
  } catch {
    return structuredClone(defaultSave);
  }
}

export function saveGame(save) {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function resetSave() {
  window.localStorage.removeItem(SAVE_KEY);
  return loadSave();
}
