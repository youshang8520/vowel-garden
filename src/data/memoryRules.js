export const memoryStages = [
  {
    id: "short",
    title: "短暂记忆",
    goal: "刚见过，能在提示下认出来。",
    usage: "teaching-only",
    romanizationAllowed: true,
    requiredCorrectStreak: 2,
    questionModes: ["study-card", "audio-to-kana"],
  },
  {
    id: "working",
    title: "临时记忆",
    goal: "离开提示后，能在已学假名中选出来。",
    romanizationAllowed: false,
    requiredCorrectStreak: 3,
    questionModes: ["audio-to-kana", "kana-pair-match"],
  },
  {
    id: "long",
    title: "长期记忆",
    goal: "隔一段时间再出现，仍然能快速判断。",
    romanizationAllowed: false,
    requiredCorrectStreak: 5,
    questionModes: ["audio-to-kana", "mixed-kana-choice", "word-recognition"],
  },
  {
    id: "muscle",
    title: "肌肉记忆",
    goal: "看到假名直接反应读音，看到片假名能立刻对应平假名，并能完成基础输入。",
    romanizationAllowed: false,
    requiredCorrectStreak: 8,
    questionModes: ["kana-to-sound", "katakana-to-hiragana", "rapid-review", "kana-typing"],
  },
];

export const reviewGateRules = {
  groupSize: 5,
  minimumReviewRoundsBeforeClear: 5,
  requireAllGroupItemsInReview: true,
  randomizeReviewOrder: true,
  blockNextGroupUntilReviewClear: true,
  newGroupWarmupPreviousGroupRounds: 5,
  allowRomanizationInTeachingOnly: true,
  romanizationAllowedInReview: false,
  romanizationAllowedInGate: false,
  romanizationAllowedInWarmup: false,
  romanizationFadeOutAfterStage: "short",
  scriptsOrder: ["hiragana", "katakana"],
  pairTraining: {
    enabled: true,
    sourceScript: "katakana",
    targetScript: "hiragana",
    useRomajiAsAnswer: false,
  },
  typingTraining: {
    enabled: true,
    unlockAfterStage: "working",
    useInReviewGate: false,
    useInMuscleStage: true,
    inputModes: ["romaji-ime", "kana-choice-keyboard"],
    requireAudioBeforeTyping: true,
  },
};

export const firstVowelGroup = {
  id: "vowel-a-row",
  title: "あ行元音",
  hiraganaIds: ["kana-hira-a", "kana-hira-i", "kana-hira-u", "kana-hira-e", "kana-hira-o"],
  katakanaIds: ["kana-kata-a", "kana-kata-i", "kana-kata-u", "kana-kata-e", "kana-kata-o"],
  reviewFocus: ["audio-to-kana", "hiragana-recognition", "katakana-to-hiragana"],
};
