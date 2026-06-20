const kanaRows = [
  {
    key: "ka",
    label: "か行",
    hiragana: [
      ["ka", "か"],
      ["ki", "き"],
      ["ku", "く"],
      ["ke", "け"],
      ["ko", "こ"],
    ],
    katakana: [
      ["ka", "カ"],
      ["ki", "キ"],
      ["ku", "ク"],
      ["ke", "ケ"],
      ["ko", "コ"],
    ],
  },
  {
    key: "sa",
    label: "さ行",
    hiragana: [
      ["sa", "さ"],
      ["shi", "し"],
      ["su", "す"],
      ["se", "せ"],
      ["so", "そ"],
    ],
    katakana: [
      ["sa", "サ"],
      ["shi", "シ"],
      ["su", "ス"],
      ["se", "セ"],
      ["so", "ソ"],
    ],
  },
  {
    key: "ta",
    label: "た行",
    hiragana: [
      ["ta", "た"],
      ["chi", "ち"],
      ["tsu", "つ"],
      ["te", "て"],
      ["to", "と"],
    ],
    katakana: [
      ["ta", "タ"],
      ["chi", "チ"],
      ["tsu", "ツ"],
      ["te", "テ"],
      ["to", "ト"],
    ],
  },
  {
    key: "na",
    label: "な行",
    hiragana: [
      ["na", "な"],
      ["ni", "に"],
      ["nu", "ぬ"],
      ["ne", "ね"],
      ["no", "の"],
    ],
    katakana: [
      ["na", "ナ"],
      ["ni", "ニ"],
      ["nu", "ヌ"],
      ["ne", "ネ"],
      ["no", "ノ"],
    ],
  },
  {
    key: "ha",
    label: "は行",
    hiragana: [
      ["ha", "は"],
      ["hi", "ひ"],
      ["fu", "ふ"],
      ["he", "へ"],
      ["ho", "ほ"],
    ],
    katakana: [
      ["ha", "ハ"],
      ["hi", "ヒ"],
      ["fu", "フ"],
      ["he", "ヘ"],
      ["ho", "ホ"],
    ],
  },
  {
    key: "ma",
    label: "ま行",
    hiragana: [
      ["ma", "ま"],
      ["mi", "み"],
      ["mu", "む"],
      ["me", "め"],
      ["mo", "も"],
    ],
    katakana: [
      ["ma", "マ"],
      ["mi", "ミ"],
      ["mu", "ム"],
      ["me", "メ"],
      ["mo", "モ"],
    ],
  },
  {
    key: "ya",
    label: "や行",
    hiragana: [
      ["ya", "や"],
      ["yu", "ゆ"],
      ["yo", "よ"],
    ],
    katakana: [
      ["ya", "ヤ"],
      ["yu", "ユ"],
      ["yo", "ヨ"],
    ],
  },
  {
    key: "ra",
    label: "ら行",
    hiragana: [
      ["ra", "ら"],
      ["ri", "り"],
      ["ru", "る"],
      ["re", "れ"],
      ["ro", "ろ"],
    ],
    katakana: [
      ["ra", "ラ"],
      ["ri", "リ"],
      ["ru", "ル"],
      ["re", "レ"],
      ["ro", "ロ"],
    ],
  },
  {
    key: "wa",
    label: "わ行",
    hiragana: [
      ["wa", "わ"],
      ["wo", "を"],
      ["n", "ん"],
    ],
    katakana: [
      ["wa", "ワ"],
      ["wo", "ヲ"],
      ["n", "ン"],
    ],
  },
];

const baseHiragana = [
  ["a", "あ"],
  ["i", "い"],
  ["u", "う"],
  ["e", "え"],
  ["o", "お"],
];

const baseKatakana = [
  ["a", "ア"],
  ["i", "イ"],
  ["u", "ウ"],
  ["e", "エ"],
  ["o", "オ"],
];

const allHiragana = [...baseHiragana, ...kanaRows.flatMap((row) => row.hiragana)];
const allKatakana = [...baseKatakana, ...kanaRows.flatMap((row) => row.katakana)];

const rowWords = {
  ka: [
    ["kaki", "かき", "柿子，也可指牡蛎"],
    ["kiku", "きく", "听、问"],
    ["koko", "ここ", "这里"],
    ["kake", "かけ", "挂、乘，常见词形的一部分"],
    ["kika", "きか", "可作为词的一部分，用来熟悉音形"],
  ],
  sa: [
    ["sushi", "すし", "寿司"],
    ["sake", "さけ", "酒、鲑鱼，读音相同"],
    ["suki", "すき", "喜欢"],
    ["soko", "そこ", "那里"],
    ["sasa", "ささ", "竹叶，常见词根"],
  ],
  ta: [
    ["tako", "たこ", "章鱼、风筝"],
    ["taki", "たき", "瀑布"],
    ["tsuki", "つき", "月亮"],
    ["soto", "そと", "外面"],
    ["kutsu", "くつ", "鞋"],
  ],
  na: [
    ["nani", "なに", "什么"],
    ["naka", "なか", "里面、中间"],
    ["natsu", "なつ", "夏天"],
    ["neko", "ねこ", "猫"],
    ["inu", "いぬ", "狗"],
  ],
  ha: [
    ["hana", "はな", "花、鼻"],
    ["hito", "ひと", "人"],
    ["fune", "ふね", "船"],
    ["hako", "はこ", "箱子"],
    ["hoshi", "ほし", "星星"],
  ],
  ma: [
    ["mimi", "みみ", "耳朵"],
    ["mame", "まめ", "豆子"],
    ["machi", "まち", "城镇"],
    ["matsu", "まつ", "松树、等待"],
    ["momo", "もも", "桃子"],
  ],
  ya: [
    ["yama", "やま", "山"],
    ["yuki", "ゆき", "雪"],
    ["yume", "ゆめ", "梦"],
    ["yoko", "よこ", "旁边、横向"],
    ["oya", "おや", "父母、哎呀"],
  ],
  ra: [
    ["sora", "そら", "天空"],
    ["tori", "とり", "鸟"],
    ["haru", "はる", "春天"],
    ["kore", "これ", "这个"],
    ["iro", "いろ", "颜色"],
  ],
  wa: [
    ["watashi", "わたし", "我"],
    ["kawa", "かわ", "河、皮"],
    ["wan", "わん", "碗，也常见于拟声"],
    ["hon", "ほん", "书"],
    ["ten", "てん", "点、天"],
  ],
};

const baseWordChoices = [
  ["ai", "あい"],
  ["ii", "いい"],
  ["iu", "いう"],
  ["ue", "うえ"],
  ["ao", "あお"],
];

const soundModules = [
  {
    key: "daku",
    label: "浊音",
    startAfter: "level-gojuon-clear-review",
    hiraPrefix: "hira-daku",
    kataPrefix: "kata-daku",
    hiraStatus: "浊音",
    kataStatus: "片假名",
    items: [
      ["ga", "が", "ガ"],
      ["gi", "ぎ", "ギ"],
      ["gu", "ぐ", "グ"],
      ["ge", "げ", "ゲ"],
      ["go", "ご", "ゴ"],
      ["za", "ざ", "ザ"],
      ["ji", "じ", "ジ"],
      ["zu", "ず", "ズ"],
      ["ze", "ぜ", "ゼ"],
      ["zo", "ぞ", "ゾ"],
      ["da", "だ", "ダ"],
      ["di", "ぢ", "ヂ"],
      ["du", "づ", "ヅ"],
      ["de", "で", "デ"],
      ["do", "ど", "ド"],
      ["ba", "ば", "バ"],
      ["bi", "び", "ビ"],
      ["bu", "ぶ", "ブ"],
      ["be", "べ", "ベ"],
      ["bo", "ぼ", "ボ"],
    ],
  },
  {
    key: "handaku",
    label: "半浊音",
    hiraPrefix: "hira-handaku",
    kataPrefix: "kata-handaku",
    hiraStatus: "半浊音",
    kataStatus: "片假名",
    items: [
      ["pa", "ぱ", "パ"],
      ["pi", "ぴ", "ピ"],
      ["pu", "ぷ", "プ"],
      ["pe", "ぺ", "ペ"],
      ["po", "ぽ", "ポ"],
    ],
  },
  {
    key: "yoon",
    label: "拗音",
    hiraPrefix: "hira-yoon",
    kataPrefix: "kata-yoon",
    hiraStatus: "拗音",
    kataStatus: "片假名",
    items: [
      ["kya", "きゃ", "キャ"],
      ["kyu", "きゅ", "キュ"],
      ["kyo", "きょ", "キョ"],
      ["sha", "しゃ", "シャ"],
      ["shu", "しゅ", "シュ"],
      ["sho", "しょ", "ショ"],
      ["cha", "ちゃ", "チャ"],
      ["chu", "ちゅ", "チュ"],
      ["cho", "ちょ", "チョ"],
      ["nya", "にゃ", "ニャ"],
      ["nyu", "にゅ", "ニュ"],
      ["nyo", "にょ", "ニョ"],
      ["hya", "ひゃ", "ヒャ"],
      ["hyu", "ひゅ", "ヒュ"],
      ["hyo", "ひょ", "ヒョ"],
      ["mya", "みゃ", "ミャ"],
      ["myu", "みゅ", "ミュ"],
      ["myo", "みょ", "ミョ"],
      ["rya", "りゃ", "リャ"],
      ["ryu", "りゅ", "リュ"],
      ["ryo", "りょ", "リョ"],
      ["gya", "ぎゃ", "ギャ"],
      ["gyu", "ぎゅ", "ギュ"],
      ["gyo", "ぎょ", "ギョ"],
      ["ja", "じゃ", "ジャ"],
      ["ju", "じゅ", "ジュ"],
      ["jo", "じょ", "ジョ"],
      ["bya", "びゃ", "ビャ"],
      ["byu", "びゅ", "ビュ"],
      ["byo", "びょ", "ビョ"],
      ["pya", "ぴゃ", "ピャ"],
      ["pyu", "ぴゅ", "ピュ"],
      ["pyo", "ぴょ", "ピョ"],
    ],
  },
  {
    key: "special",
    label: "促音和长音",
    hiraPrefix: "hira-special",
    kataPrefix: "kata-special",
    hiraStatus: "基础音",
    kataStatus: "基础音",
    items: [
      ["small-tsu", "っ", "ッ"],
      ["long-vowel", "ー", "ー"],
    ],
  },
];

const LONG_VOWEL_RULE_ANSWER = "拉长前一个假名的元音";
const LONG_VOWEL_RULE_OPTIONS = [
  LONG_VOWEL_RULE_ANSWER,
  "单独读成 a",
  "单独读成 i",
  "表示停顿一拍",
];

function hasStandaloneAudio(romaji) {
  return romaji !== "long-vowel";
}

function isLongVowel(romaji) {
  return romaji === "long-vowel";
}

function soundId(prefix, romaji) {
  return `kana-${prefix}-${romaji}`;
}

function getKanaByRomaji(items, romaji, scriptIndex) {
  return items.find(([itemRomaji]) => itemRomaji === romaji)?.[scriptIndex];
}

function kanaId(script, romaji) {
  return `kana-${script}-${romaji}`;
}

function kanaAudioKey(romaji) {
  return hasStandaloneAudio(romaji) ? `kana.${romaji}` : null;
}

function kanaAudioSrc(romaji) {
  return hasStandaloneAudio(romaji) ? `assets/audio/kana/${romaji}.wav` : "";
}

function buildLongVowelRuleQuestion({ id, levelId, knowledgeId, prompt = "ー", difficulty = 3 }) {
  return {
    id,
    levelId,
    questionType: "kana-to-sound",
    knowledgeIds: [knowledgeId],
    questionText: "看长音符，选出它的作用。",
    prompt,
    options: LONG_VOWEL_RULE_OPTIONS,
    correctAnswer: LONG_VOWEL_RULE_ANSWER,
    difficulty,
    isPreview: false,
  };
}

function rowWordId(rowKey, romaji) {
  return `word-${rowKey}-${romaji}`;
}

function rowWordVisualSrc(rowKey, romaji) {
  return `assets/visual/words/${rowKey}-${romaji}.svg`;
}

function baseWordId(romaji) {
  return `word-${romaji}`;
}

function generatedRequiresHandwriting(script, romaji) {
  return ["hiragana", "katakana"].includes(script) && Boolean(romaji);
}

function getOptions(items, romaji, minCount = 4) {
  const answer = items.find(([itemRomaji]) => itemRomaji === romaji);
  const others = items.filter(([itemRomaji]) => itemRomaji !== romaji);
  const options = [answer, ...others].filter(Boolean).slice(0, minCount).map(([, kana]) => kana);
  return options.includes(answer?.[1]) ? options : [answer?.[1], ...options].filter(Boolean);
}

function getRomajiOptions(items, romaji, minCount = 4) {
  const answer = items.find(([itemRomaji]) => itemRomaji === romaji);
  const others = items.filter(([itemRomaji]) => itemRomaji !== romaji);
  const options = [answer, ...others].filter(Boolean).slice(0, minCount).map(([itemRomaji]) => itemRomaji);
  return options.includes(answer?.[0]) ? options : [answer?.[0], ...options].filter(Boolean);
}

function getWordDifferenceScore(answer, candidate) {
  const [answerRomaji, answerKana] = answer;
  const [candidateRomaji, candidateKana] = candidate;
  let score = 0;
  if (answerKana[0] !== candidateKana[0]) score += 3;
  if (answerRomaji[0] !== candidateRomaji[0]) score += 2;
  if (Math.abs(answerKana.length - candidateKana.length) >= 1) score += 2;
  if (answerKana.length !== candidateKana.length || answerRomaji.length !== candidateRomaji.length) score += 1;
  return score;
}

function getDistinctWordOptions(wordRomaji, wordKana, candidateWords, minCount = 5) {
  const answer = [wordRomaji, wordKana];
  const uniqueCandidates = [];
  const seenKana = new Set([wordKana]);
  for (const [candidateRomaji, candidateKana] of candidateWords) {
    if (!candidateKana || seenKana.has(candidateKana)) continue;
    seenKana.add(candidateKana);
    uniqueCandidates.push([candidateRomaji, candidateKana]);
  }
  const options = uniqueCandidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: getWordDifferenceScore(answer, candidate),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, minCount - 1))
    .map(({ candidate }) => candidate[1]);
  return [wordKana, ...options];
}

function buildKanaInputQuestion({ id, levelId, knowledgeIds, prompt, inputScript, correctAnswer, questionText }) {
  return {
    id,
    levelId,
    questionType: "kana-input",
    knowledgeIds,
    questionText,
    prompt,
    inputScript,
    options: [],
    correctAnswer,
    acceptedAnswers: [correctAnswer],
    difficulty: 4,
    isPreview: false,
    noRomaji: false,
  };
}

function buildCumulativeReviewQuestions(levelId, rowKey, learnedRows, learnedWordRows) {
  const questions = [];
  const learnedHira = [...baseHiragana, ...learnedRows.flatMap((row) => row.hiragana)];
  const learnedKata = [...baseKatakana, ...learnedRows.flatMap((row) => row.katakana)];
  const learnedWords = [
    ["ai", "あい", baseWordId("ai")],
    ["ii", "いい", baseWordId("ii")],
    ["iu", "いう", baseWordId("iu")],
    ["ue", "うえ", baseWordId("ue")],
    ["ao", "あお", baseWordId("ao")],
    ...learnedWordRows.flatMap((row) => (rowWords[row.key] || []).map(([romaji, kana]) => [romaji, kana, rowWordId(row.key, romaji)])),
  ];
  const sampledHira = learnedHira.filter((_, index) => index % 2 === 0 || index >= learnedHira.length - Math.min(5, learnedHira.length));
  const sampledKata = learnedKata.filter((_, index) => index % 2 === 1 || index >= learnedKata.length - Math.min(5, learnedKata.length));
  const sampledWords = learnedWords.filter((_, index) => index % 2 === 0 || index >= Math.max(0, learnedWords.length - 4));

  for (const [romaji, kana] of sampledHira) {
    questions.push({
      id: `q-cumulative-${rowKey}-hira-audio-${romaji}`,
      levelId,
      questionType: "audio-to-kana-review",
      knowledgeIds: [kanaId("hira", romaji)],
      questionText: "听声音，选平假名。",
      audioKey: `kana.${romaji}`,
      audioSrc: kanaAudioSrc(romaji),
      options: getOptions(learnedHira, romaji, Math.min(6, learnedHira.length)),
      correctAnswer: kana,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
    questions.push({
      id: `q-cumulative-${rowKey}-read-hira-${romaji}`,
      levelId,
      questionType: "romaji-input",
      knowledgeIds: [kanaId("hira", romaji)],
      questionText: "输入这个平假名的读音。",
      prompt: kana,
      options: [],
      correctAnswer: romaji,
      acceptedAnswers: [romaji],
      difficulty: 4,
      isPreview: false,
    });
  }

  for (const [romaji, kana] of sampledKata) {
    const hiraKana = learnedHira.find(([hiraRomaji]) => hiraRomaji === romaji)?.[1];
    questions.push({
      id: `q-cumulative-${rowKey}-kata-audio-${romaji}`,
      levelId,
      questionType: "audio-to-kana-review",
      knowledgeIds: [kanaId("kata", romaji)],
      questionText: "听声音，选片假名。",
      audioKey: `kana.${romaji}`,
      audioSrc: kanaAudioSrc(romaji),
      options: getOptions(learnedKata, romaji, Math.min(6, learnedKata.length)),
      correctAnswer: kana,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
    questions.push({
      id: `q-cumulative-${rowKey}-read-kata-${romaji}`,
      levelId,
      questionType: "romaji-input",
      knowledgeIds: [kanaId("kata", romaji)],
      questionText: "输入这个片假名的读音。",
      prompt: kana,
      options: [],
      correctAnswer: romaji,
      acceptedAnswers: [romaji],
      difficulty: 4,
      isPreview: false,
    });
    if (hiraKana) {
      questions.push({
        id: `q-cumulative-${rowKey}-kata-hira-${romaji}`,
        levelId,
        questionType: "katakana-to-hiragana",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "看片假名，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(learnedHira, romaji, Math.min(6, learnedHira.length)),
        correctAnswer: hiraKana,
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
    }
  }

  for (const [wordRomaji, wordKana, wordId] of sampledWords) {
    const wordOptions = [wordKana, ...learnedWords.map(([, kana]) => kana).filter((kana) => kana !== wordKana)]
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, Math.max(5, Math.min(8, learnedWords.length)));
    questions.push({
      id: `q-cumulative-${rowKey}-word-${wordRomaji}`,
      levelId,
      questionType: "audio-to-word",
      knowledgeIds: [wordId],
      questionText: "听声音，选词语。",
      audioKey: `word.${wordRomaji}`,
      audioSrc: `assets/audio/words/${wordRomaji}.wav`,
      options: wordOptions,
      correctAnswer: wordKana,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
    questions.push({
      id: `q-cumulative-${rowKey}-word-image-${wordRomaji}`,
      levelId,
      questionType: "image-to-word",
      knowledgeIds: [wordId],
      questionText: "看图，选出这个词。",
      options: getDistinctWordOptions(wordRomaji, wordKana, learnedWords),
      correctAnswer: wordKana,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
  }

  const pairSample = learnedHira
    .filter(([romaji]) => learnedKata.some(([kataRomaji]) => kataRomaji === romaji))
    .filter((_, index) => index % Math.max(1, Math.ceil(learnedHira.length / 6)) === 0)
    .slice(0, 6);
  if (pairSample.length >= 3) {
    questions.push({
      id: `q-cumulative-${rowKey}-pair-hira-kata`,
      levelId,
      questionType: "pair-match",
      knowledgeIds: pairSample.flatMap(([romaji]) => [kanaId("hira", romaji), kanaId("kata", romaji)]),
      questionText: "把平假名和片假名连起来。",
      pairLabel: "平假名 ↔ 片假名",
      pairs: pairSample.map(([romaji, hira]) => ({ left: hira, right: learnedKata.find(([kataRomaji]) => kataRomaji === romaji)?.[1] })),
      options: [],
      correctAnswer: "全部配对",
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
    questions.push({
      id: `q-cumulative-${rowKey}-pair-sound-hira`,
      levelId,
      questionType: "pair-match",
      knowledgeIds: pairSample.map(([romaji]) => kanaId("hira", romaji)),
      questionText: "点播放，连到对应的平假名。",
      pairLabel: "声音 ↔ 平假名",
      pairs: pairSample.map(([romaji, hira]) => ({ left: romaji, right: hira })),
      options: [],
      correctAnswer: "全部配对",
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
  }

  return questions;
}

function buildKnowledge() {
  const hiragana = kanaRows.flatMap((row, rowIndex) =>
    row.hiragana.map(([romaji, kana], index) => ({
      id: kanaId("hira", romaji),
      type: "kana",
      script: "hiragana",
      japanese: kana,
      kana,
      romaji,
      chinese: `平假名 ${romaji}，属于${row.label}`,
      readingHint: `${kana} / ${romaji}`,
      audioKey: `kana.${romaji}`,
      audioSrc: kanaAudioSrc(romaji),
      level: "gojuon",
      category: "hiragana-kana",
      row: row.key,
      unlockOrder: 200 + rowIndex * 10 + index,
      requiresHandwriting: generatedRequiresHandwriting("hiragana", romaji),
    })),
  );

  const katakana = kanaRows.flatMap((row, rowIndex) =>
    row.katakana.map(([romaji, kana], index) => ({
      id: kanaId("kata", romaji),
      type: "kana",
      script: "katakana",
      japanese: kana,
      kana,
      romaji,
      chinese: `片假名 ${romaji}，读音与平假名相同`,
      readingHint: `${kana} / ${romaji}`,
      audioKey: `kana.${romaji}`,
      audioSrc: kanaAudioSrc(romaji),
      level: "gojuon",
      category: "katakana-kana",
      row: row.key,
      unlockOrder: 500 + rowIndex * 10 + index,
      requiresHandwriting: generatedRequiresHandwriting("katakana", romaji),
    })),
  );

  const modules = soundModules.flatMap((module, moduleIndex) => {
    const hiraItems = module.items.map(([romaji, hira], index) => ({
      id: soundId(module.hiraPrefix, romaji),
      type: "kana",
      script: "hiragana",
      japanese: hira,
      kana: hira,
      romaji,
      chinese: isLongVowel(romaji) ? "长音符：本身没有固定读音，只把前一个假名的元音拖长" : `${module.label} ${romaji}`,
      readingHint: isLongVowel(romaji) ? `${hira} / 拉长前一个元音` : `${hira} / ${romaji}`,
      audioKey: kanaAudioKey(romaji),
      audioSrc: kanaAudioSrc(romaji),
      level: "basic-sounds",
      category: module.key === "special" ? "special-sound" : "hiragana-sound",
      row: module.key,
      unlockOrder: 800 + moduleIndex * 100 + index,
      requiresHandwriting: false,
    }));
    const kataItems = module.items.map(([romaji, , kata], index) => ({
      id: soundId(module.kataPrefix, romaji),
      type: "kana",
      script: "katakana",
      japanese: kata,
      kana: kata,
      romaji,
      chinese: isLongVowel(romaji) ? "长音符：本身没有固定读音，只把前一个假名的元音拖长" : `${module.label}片假名 ${romaji}`,
      readingHint: isLongVowel(romaji) ? `${kata} / 拉长前一个元音` : `${kata} / ${romaji}`,
      audioKey: kanaAudioKey(romaji),
      audioSrc: kanaAudioSrc(romaji),
      level: "basic-sounds",
      category: module.key === "special" ? "special-sound" : "katakana-sound",
      row: module.key,
      unlockOrder: 1100 + moduleIndex * 100 + index,
      requiresHandwriting: false,
    }));
    return [...hiraItems, ...kataItems];
  });

  const words = Object.entries(rowWords).flatMap(([rowKey, items], rowIndex) =>
    items.map(([romaji, kana, chinese], index) => ({
      id: rowWordId(rowKey, romaji),
      type: "word",
      japanese: kana,
      kana,
      romaji,
      chinese,
      readingHint: `${kana} / ${romaji}`,
      audioKey: `word.${romaji}`,
      audioSrc: `assets/audio/words/${romaji}.wav`,
      level: "gojuon",
      category: "gojuon-word",
      row: rowKey,
      unlockOrder: 650 + rowIndex * 20 + index,
      introducedAt: `level-hira-${rowKey}-words`,
      imageSrc: rowWordVisualSrc(rowKey, romaji),
      visualType: "svg-card",
      visualPrompt: `A clear friendly learning card for ${chinese}.`,
      visualAlt: `${chinese} 的图示`,
      assetStatus: "ready",
      assetLicense: "project-generated",
      learnedRatio: 1,
      preview: false,
    })),
  );

  return [...hiragana, ...katakana, ...modules, ...words];
}

function buildLevels() {
  const levels = [];
  let order = 30;
  let requiredLevelId = "level-final-review";
  const learnedHiragana = baseHiragana.map(([romaji]) => kanaId("hira", romaji));
  const learnedKatakana = baseKatakana.map(([romaji]) => kanaId("kata", romaji));
  const learnedWordIds = ["ai", "ii", "iu", "ue", "ao"].map(baseWordId);

  for (const row of kanaRows) {
    const hiraRowIds = [];
    for (const [romaji, kana] of row.hiragana) {
      const id = `level-hira-${romaji}`;
      hiraRowIds.push(kanaId("hira", romaji));
      levels.push({
        id,
        order: order++,
        title: `点亮 ${kana}`,
        subtitle: `认识平假名 ${romaji}`,
        type: "main",
        statusLabel: "平假名",
        requiredLevelId,
        allowedKnowledgeIds: [...learnedHiragana, ...hiraRowIds],
        newKnowledgeIds: [kanaId("hira", romaji)],
        puzzleMode: "kana-chain-tile",
        previewLimit: 0,
        memoryRule: {
          stage: "short",
          groupId: `hira-${row.key}`,
          romanizationAllowed: true,
          requiredQuestionModes: ["audio-to-kana"],
        },
        reward: { coins: 10, exp: 10, cards: [kanaId("hira", romaji)] },
      });
      requiredLevelId = id;
    }
    learnedHiragana.push(...hiraRowIds);
    levels.push({
      id: `level-hira-${row.key}-review`,
      order: order++,
      title: `${row.label}巩固`,
      subtitle: `复习${row.label}平假名`,
      type: "main",
      statusLabel: "巩固",
      requiredLevelId,
      allowedKnowledgeIds: [...learnedHiragana],
      newKnowledgeIds: [],
      puzzleMode: "memory-review-gate",
      previewLimit: 0,
      memoryRule: {
        stage: "long",
        groupId: `hira-${row.key}-review`,
        romanizationAllowed: false,
        requiredQuestionModes: ["audio-to-kana", "pair-match"],
      },
      reward: { coins: 14, exp: 14, cards: [] },
    });
    requiredLevelId = `level-hira-${row.key}-review`;

    const wordIds = (rowWords[row.key] || []).map(([romaji]) => rowWordId(row.key, romaji));
    learnedWordIds.push(...wordIds);
    if (wordIds.length) {
      levels.push({
        id: `level-hira-${row.key}-words`,
        order: order++,
        title: `${row.label}词语`,
        subtitle: `用${row.label}读出简单词`,
        type: "main",
        statusLabel: "词语",
        requiredLevelId,
        allowedKnowledgeIds: [...learnedHiragana, ...wordIds],
        newKnowledgeIds: [],
        puzzleMode: "word-review-gate",
        previewLimit: 0,
        memoryRule: {
          stage: "long",
          groupId: `words-${row.key}`,
          romanizationAllowed: false,
          requiredQuestionModes: ["audio-to-word", "image-to-word"],
        },
        reward: { coins: 14, exp: 14, cards: wordIds },
      });
      requiredLevelId = `level-hira-${row.key}-words`;
    }

    const kataRowIds = [];
    for (const [romaji, kana] of row.katakana) {
      const id = `level-kata-${romaji}`;
      kataRowIds.push(kanaId("kata", romaji));
      levels.push({
        id,
        order: order++,
        title: `遇见 ${kana}`,
        subtitle: `认识片假名 ${romaji}`,
        type: "main",
        statusLabel: "片假名",
        requiredLevelId,
        allowedKnowledgeIds: [...learnedHiragana, ...learnedKatakana, ...kataRowIds],
        newKnowledgeIds: [kanaId("kata", romaji)],
        puzzleMode: "same-sound-new-shape",
        previewLimit: 0,
        memoryRule: {
          stage: "muscle",
          groupId: `kata-${row.key}`,
          romanizationAllowed: false,
          requiredQuestionModes: ["katakana-to-hiragana", "audio-to-kana"],
        },
        reward: { coins: 12, exp: 12, cards: [kanaId("kata", romaji)] },
      });
      requiredLevelId = id;
    }
    learnedKatakana.push(...kataRowIds);
    levels.push({
      id: `level-kata-${row.key}-review`,
      order: order++,
      title: `${row.label}片假名巩固`,
      subtitle: `复习${row.label}片假名`,
      type: "main",
      statusLabel: "巩固",
      requiredLevelId,
      allowedKnowledgeIds: [...learnedHiragana, ...learnedKatakana, ...wordIds],
      newKnowledgeIds: [],
      puzzleMode: "memory-review-gate",
      previewLimit: 0,
      memoryRule: {
        stage: "long",
        groupId: `kata-${row.key}-review`,
        romanizationAllowed: false,
        requiredQuestionModes: ["audio-to-kana", "katakana-to-hiragana", "pair-match"],
      },
      reward: { coins: 14, exp: 14, cards: [] },
    });
    requiredLevelId = `level-kata-${row.key}-review`;

    levels.push({
      id: `level-row-${row.key}-review`,
      order: order++,
      title: `${row.label}综合巩固`,
      subtitle: `平假名、片假名和词语混合练习`,
      type: "main",
      statusLabel: "综合",
      requiredLevelId,
      allowedKnowledgeIds: [
        ...row.hiragana.map(([romaji]) => kanaId("hira", romaji)),
        ...row.katakana.map(([romaji]) => kanaId("kata", romaji)),
        ...wordIds,
      ],
      newKnowledgeIds: [],
      puzzleMode: "final-review-gate",
      previewLimit: 0,
        memoryRule: {
          stage: "muscle",
          groupId: `row-${row.key}-review`,
          romanizationAllowed: false,
          requiredQuestionModes: ["audio-to-kana", "audio-to-word", "image-to-word", "katakana-to-hiragana", "kana-input", "pair-match"],
        },
      reward: { coins: 22, exp: 22, cards: [] },
    });
    requiredLevelId = `level-row-${row.key}-review`;

    levels.push({
      id: `level-cumulative-${row.key}-review`,
      order: order++,
      title: `${row.label}花园回顾`,
      subtitle: `混合抽查到${row.label}为止学过的内容`,
      type: "main",
      statusLabel: "回顾",
      requiredLevelId,
      allowedKnowledgeIds: [...learnedHiragana, ...learnedKatakana, ...learnedWordIds],
      newKnowledgeIds: [],
      puzzleMode: "cumulative-review-gate",
      previewLimit: 0,
        memoryRule: {
          stage: "spaced",
          groupId: `cumulative-${row.key}-review`,
          romanizationAllowed: false,
          requiredQuestionModes: ["audio-to-kana", "audio-to-word", "image-to-word", "katakana-to-hiragana", "romaji-input", "pair-match"],
        },
      reward: { coins: 18, exp: 18, cards: [] },
    });
    requiredLevelId = `level-cumulative-${row.key}-review`;
  }

  levels.push({
    id: "level-gojuon-clear-review",
    order: order++,
    title: "清音总复习",
    subtitle: "平假名和片假名清音混合练习",
    type: "main",
    statusLabel: "总复习",
    requiredLevelId,
    allowedKnowledgeIds: [
      ...allHiragana.map(([romaji]) => kanaId("hira", romaji)),
      ...allKatakana.map(([romaji]) => kanaId("kata", romaji)),
    ],
    newKnowledgeIds: [],
    puzzleMode: "final-review-gate",
    previewLimit: 0,
    memoryRule: {
      stage: "muscle",
      groupId: "gojuon-clear-review",
      romanizationAllowed: false,
      requiredQuestionModes: ["audio-to-kana", "katakana-to-hiragana", "pair-match"],
    },
    reward: { coins: 28, exp: 28, cards: [] },
  });

  for (const module of soundModules) {
    const hiraIds = [];
    const moduleStart = module.startAfter || requiredLevelId;
    if (module.startAfter) requiredLevelId = module.startAfter;
    for (const [romaji, hira] of module.items) {
      const id = `level-${module.hiraPrefix}-${romaji}`;
      hiraIds.push(soundId(module.hiraPrefix, romaji));
      levels.push({
        id,
        order: order++,
        title: `点亮 ${hira}`,
        subtitle: isLongVowel(romaji) ? "理解长音符：不单独发音，只拉长前一个元音" : `认识${module.label} ${romaji}`,
        type: "main",
        statusLabel: module.hiraStatus,
        requiredLevelId,
        allowedKnowledgeIds: [...hiraIds],
        newKnowledgeIds: [soundId(module.hiraPrefix, romaji)],
        puzzleMode: module.key === "special" ? "sound-rule-tile" : "kana-chain-tile",
        previewLimit: 0,
        memoryRule: {
          stage: "short",
          groupId: `${module.hiraPrefix}`,
          romanizationAllowed: module.key === "special" && !isLongVowel(romaji),
          requiredQuestionModes: isLongVowel(romaji) ? ["kana-to-sound"] : ["audio-to-kana"],
        },
        reward: { coins: 10, exp: 10, cards: [soundId(module.hiraPrefix, romaji)] },
      });
      requiredLevelId = id;
    }
    levels.push({
      id: `level-${module.hiraPrefix}-review`,
      order: order++,
      title: `${module.label}巩固`,
      subtitle: `复习${module.label}平假名`,
      type: "main",
      statusLabel: "巩固",
      requiredLevelId,
      allowedKnowledgeIds: [...hiraIds],
      newKnowledgeIds: [],
      puzzleMode: "memory-review-gate",
      previewLimit: 0,
      memoryRule: {
        stage: "long",
        groupId: `${module.hiraPrefix}-review`,
        romanizationAllowed: false,
        requiredQuestionModes: module.key === "special" ? ["audio-to-kana", "kana-to-sound"] : ["audio-to-kana", "pair-match"],
      },
      reward: { coins: 14, exp: 14, cards: [] },
    });
    requiredLevelId = `level-${module.hiraPrefix}-review`;

    const kataIds = [];
    for (const [romaji, , kata] of module.items) {
      const id = `level-${module.kataPrefix}-${romaji}`;
      kataIds.push(soundId(module.kataPrefix, romaji));
      levels.push({
        id,
        order: order++,
        title: `遇见 ${kata}`,
        subtitle: isLongVowel(romaji) ? "理解长音符：不单独发音，只拉长前一个元音" : `认识${module.label}片假名 ${romaji}`,
        type: "main",
        statusLabel: module.kataStatus,
        requiredLevelId,
        allowedKnowledgeIds: [...hiraIds, ...kataIds],
        newKnowledgeIds: [soundId(module.kataPrefix, romaji)],
        puzzleMode: module.key === "special" ? "sound-rule-tile" : "same-sound-new-shape",
        previewLimit: 0,
        memoryRule: {
          stage: "muscle",
          groupId: `${module.kataPrefix}`,
          romanizationAllowed: false,
          requiredQuestionModes: isLongVowel(romaji) ? ["kana-to-sound"] : ["katakana-to-hiragana", "audio-to-kana"],
        },
        reward: { coins: 12, exp: 12, cards: [soundId(module.kataPrefix, romaji)] },
      });
      requiredLevelId = id;
    }
    levels.push({
      id: `level-${module.kataPrefix}-review`,
      order: order++,
      title: `${module.label}片假名巩固`,
      subtitle: `复习${module.label}片假名`,
      type: "main",
      statusLabel: "巩固",
      requiredLevelId,
      allowedKnowledgeIds: [...hiraIds, ...kataIds],
      newKnowledgeIds: [],
      puzzleMode: "memory-review-gate",
      previewLimit: 0,
      memoryRule: {
        stage: "long",
        groupId: `${module.kataPrefix}-review`,
        romanizationAllowed: false,
        requiredQuestionModes: module.key === "special" ? ["audio-to-kana", "kana-to-sound"] : ["audio-to-kana", "katakana-to-hiragana", "pair-match"],
      },
      reward: { coins: 14, exp: 14, cards: [] },
    });
    requiredLevelId = `level-${module.kataPrefix}-review`;
    if (moduleStart && module.startAfter) requiredLevelId = `level-${module.kataPrefix}-review`;
  }

  levels.push({
    id: "level-basic-sounds-review",
    order: order++,
    title: "基础音总复习",
    subtitle: "清音、浊音、半浊音、拗音、促音和长音",
    type: "main",
    statusLabel: "总复习",
    requiredLevelId,
    allowedKnowledgeIds: [
      ...allHiragana.map(([romaji]) => kanaId("hira", romaji)),
      ...allKatakana.map(([romaji]) => kanaId("kata", romaji)),
      ...soundModules.flatMap((module) => module.items.flatMap(([romaji]) => [soundId(module.hiraPrefix, romaji), soundId(module.kataPrefix, romaji)])),
    ],
    newKnowledgeIds: [],
    puzzleMode: "final-review-gate",
    previewLimit: 0,
    memoryRule: {
      stage: "muscle",
      groupId: "basic-sounds-review",
      romanizationAllowed: false,
      requiredQuestionModes: ["audio-to-kana", "katakana-to-hiragana", "pair-match"],
    },
    reward: { coins: 36, exp: 36, cards: [] },
  });

  return levels;
}

function buildQuestions() {
  const questions = [];

  let clearRowIndex = -1;
  for (const row of kanaRows) {
    clearRowIndex += 1;
    for (const [romaji, kana] of row.hiragana) {
      questions.push({
        id: `q-hira-${romaji}-audio-1`,
        levelId: `level-hira-${romaji}`,
        questionType: "audio-to-kana",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "听声音，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana, romaji, row.hiragana.length),
        correctAnswer: kana,
        difficulty: 2,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-hira-${romaji}-audio-2`,
        levelId: `level-hira-${romaji}`,
        questionType: "audio-to-kana",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "再听一次，选出这个平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana.slice().reverse(), romaji),
        correctAnswer: kana,
        difficulty: 2,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-hira-${romaji}-write-learning`,
        levelId: `level-hira-${romaji}`,
        questionType: "handwriting-check",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "看读音，写出这个平假名。",
        prompt: romaji,
        promptType: "romaji",
        options: [],
        correctAnswer: kana,
        difficulty: 2,
        isPreview: false,
        noRomaji: true,
      });
    }
    row.hiragana.forEach(([romaji, kana], index) => {
      questions.push({
        id: `q-hira-${row.key}-review-${romaji}`,
        levelId: `level-hira-${row.key}-review`,
        questionType: "audio-to-kana-review",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "听声音，选假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana, romaji, row.hiragana.length),
        correctAnswer: kana,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-hira-${row.key}-recall-${romaji}`,
        levelId: `level-hira-${row.key}-review`,
        questionType: "kana-to-sound",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "看假名，选读音。",
        prompt: kana,
        options: getRomajiOptions(row.hiragana, romaji, row.hiragana.length),
        correctAnswer: romaji,
        difficulty: 3,
        isPreview: false,
      });
      if (index === 0 && row.hiragana.length >= 3) {
        questions.push({
          id: `q-hira-${row.key}-pair`,
          levelId: `level-hira-${row.key}-review`,
          questionType: "pair-match",
          knowledgeIds: row.hiragana.map(([itemRomaji]) => kanaId("hira", itemRomaji)),
          questionText: "点播放，连到对应的平假名。",
          pairLabel: "声音 ↔ 平假名",
          pairs: row.hiragana.map(([itemRomaji, itemKana]) => ({ left: itemRomaji, right: itemKana })),
          options: [],
          correctAnswer: "全部配对",
          difficulty: 3,
          isPreview: false,
        });
      }
    });

    const wordItems = rowWords[row.key] || [];
    const imageWordCandidates = [
      ...baseWordChoices,
      ...kanaRows.slice(0, clearRowIndex).flatMap((learnedRow) => rowWords[learnedRow.key] || []),
      ...wordItems,
    ];
    wordItems.forEach(([wordRomaji, wordKana]) => {
      questions.push({
        id: `q-word-${row.key}-${wordRomaji}`,
        levelId: `level-hira-${row.key}-words`,
        questionType: "audio-to-word",
        knowledgeIds: [rowWordId(row.key, wordRomaji)],
        questionText: "听声音，选词语。",
        audioKey: `word.${wordRomaji}`,
        audioSrc: `assets/audio/words/${wordRomaji}.wav`,
        options: wordItems.map(([, itemKana]) => itemKana),
        correctAnswer: wordKana,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-word-${row.key}-${wordRomaji}-image`,
        levelId: `level-hira-${row.key}-words`,
        questionType: "image-to-word",
        knowledgeIds: [rowWordId(row.key, wordRomaji)],
        questionText: "看图，选出这个词。",
        options: getDistinctWordOptions(wordRomaji, wordKana, imageWordCandidates),
        correctAnswer: wordKana,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
    });
  }

  let reviewRowIndex = -1;
  for (const row of kanaRows) {
    reviewRowIndex += 1;
    for (const [romaji, kana] of row.katakana) {
      const hira = row.hiragana.find(([itemRomaji]) => itemRomaji === romaji)?.[1];
      questions.push({
        id: `q-kata-${romaji}-pair-hira`,
        levelId: `level-kata-${romaji}`,
        questionType: "katakana-to-hiragana",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "看片假名，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana, romaji),
        correctAnswer: hira,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-kata-${romaji}-audio`,
        levelId: `level-kata-${romaji}`,
        questionType: "audio-to-kana",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "听声音，选片假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.katakana, romaji, row.katakana.length),
        correctAnswer: kana,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-kata-${romaji}-write-learning`,
        levelId: `level-kata-${romaji}`,
        questionType: "handwriting-check",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "看读音，写出这个片假名。",
        prompt: romaji,
        promptType: "romaji",
        options: [],
        correctAnswer: kana,
        difficulty: 2,
        isPreview: false,
        noRomaji: true,
      });
    }
    row.katakana.forEach(([romaji, kana], index) => {
      questions.push({
        id: `q-kata-${row.key}-review-${romaji}`,
        levelId: `level-kata-${row.key}-review`,
        questionType: "audio-to-kana-review",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "听声音，选片假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.katakana, romaji, row.katakana.length),
        correctAnswer: kana,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-kata-${row.key}-hira-${romaji}`,
        levelId: `level-kata-${row.key}-review`,
        questionType: "katakana-to-hiragana",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "看片假名，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana, romaji, row.hiragana.length),
        correctAnswer: row.hiragana.find(([hiraRomaji]) => hiraRomaji === romaji)?.[1],
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-kata-${row.key}-recall-${romaji}`,
        levelId: `level-kata-${row.key}-review`,
        questionType: "kana-to-sound",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "看片假名，选读音。",
        prompt: kana,
        options: getRomajiOptions(row.katakana, romaji, row.katakana.length),
        correctAnswer: romaji,
        difficulty: 3,
        isPreview: false,
      });
      if (index === 0 && row.katakana.length >= 3) {
        questions.push({
          id: `q-kata-${row.key}-pair`,
          levelId: `level-kata-${row.key}-review`,
          questionType: "pair-match",
          knowledgeIds: row.katakana.map(([itemRomaji]) => kanaId("kata", itemRomaji)),
          questionText: "把平假名和片假名连起来。",
          pairLabel: "平假名 ↔ 片假名",
          pairs: row.katakana.map(([itemRomaji, itemKana]) => ({
            left: row.hiragana.find(([hiraRomaji]) => hiraRomaji === itemRomaji)?.[1],
            right: itemKana,
          })),
          options: [],
          correctAnswer: "全部配对",
          difficulty: 3,
          isPreview: false,
          noRomaji: true,
        });
      }
    });

    const wordItems = rowWords[row.key] || [];
    row.hiragana.forEach(([romaji, kana]) => {
      questions.push({
        id: `q-row-${row.key}-hira-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "audio-to-kana-review",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "听声音，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana, romaji, row.hiragana.length),
        correctAnswer: kana,
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
    });
    row.katakana.forEach(([romaji, kana]) => {
      questions.push({
        id: `q-row-${row.key}-kata-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "audio-to-kana-review",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "听声音，选片假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.katakana, romaji, row.katakana.length),
        correctAnswer: kana,
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
      questions.push(buildKanaInputQuestion({
        id: `q-row-${row.key}-type-kata-from-hira-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        knowledgeIds: [kanaId("hira", romaji), kanaId("kata", romaji)],
        questionText: "看平假名，输入对应片假名。",
        prompt: row.hiragana.find(([hiraRomaji]) => hiraRomaji === romaji)?.[1],
        inputScript: "katakana",
        correctAnswer: kana,
      }));
      questions.push({
        id: `q-row-${row.key}-read-hira-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "romaji-input",
        knowledgeIds: [kanaId("hira", romaji)],
        questionText: "输入这个平假名的读音。",
        prompt: row.hiragana.find(([hiraRomaji]) => hiraRomaji === romaji)?.[1],
        options: [],
        correctAnswer: romaji,
        acceptedAnswers: [romaji],
        difficulty: 4,
        isPreview: false,
      });
      questions.push(buildKanaInputQuestion({
        id: `q-row-${row.key}-type-hira-from-kata-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        knowledgeIds: [kanaId("kata", romaji), kanaId("hira", romaji)],
        questionText: "看片假名，输入对应平假名。",
        prompt: kana,
        inputScript: "hiragana",
        correctAnswer: row.hiragana.find(([hiraRomaji]) => hiraRomaji === romaji)?.[1],
      }));
      questions.push({
        id: `q-row-${row.key}-read-kata-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "romaji-input",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "输入这个片假名的读音。",
        prompt: kana,
        options: [],
        correctAnswer: romaji,
        acceptedAnswers: [romaji],
        difficulty: 4,
        isPreview: false,
      });
      questions.push({
        id: `q-row-${row.key}-kata-hira-${romaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "katakana-to-hiragana",
        knowledgeIds: [kanaId("kata", romaji)],
        questionText: "看片假名，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(row.hiragana, romaji, row.hiragana.length),
        correctAnswer: row.hiragana.find(([hiraRomaji]) => hiraRomaji === romaji)?.[1],
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
    });
    const reviewImageWordCandidates = [
      ...baseWordChoices,
      ...kanaRows.slice(0, reviewRowIndex).flatMap((learnedRow) => rowWords[learnedRow.key] || []),
      ...wordItems,
    ];
    wordItems.forEach(([wordRomaji, wordKana]) => {
      questions.push({
        id: `q-row-${row.key}-word-${wordRomaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "audio-to-word",
        knowledgeIds: [rowWordId(row.key, wordRomaji)],
        questionText: "听声音，选词语。",
        audioKey: `word.${wordRomaji}`,
        audioSrc: `assets/audio/words/${wordRomaji}.wav`,
        options: wordItems.map(([, itemKana]) => itemKana),
        correctAnswer: wordKana,
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-row-${row.key}-word-image-${wordRomaji}`,
        levelId: `level-row-${row.key}-review`,
        questionType: "image-to-word",
        knowledgeIds: [rowWordId(row.key, wordRomaji)],
        questionText: "看图，选出这个词。",
        options: getDistinctWordOptions(wordRomaji, wordKana, reviewImageWordCandidates),
        correctAnswer: wordKana,
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
    });
    if (row.hiragana.length >= 3) {
      questions.push({
        id: `q-row-${row.key}-hira-kata-pair`,
        levelId: `level-row-${row.key}-review`,
        questionType: "pair-match",
        knowledgeIds: [
          ...row.hiragana.map(([itemRomaji]) => kanaId("hira", itemRomaji)),
          ...row.katakana.map(([itemRomaji]) => kanaId("kata", itemRomaji)),
        ],
        questionText: "把平假名和片假名连起来。",
        pairLabel: "平假名 ↔ 片假名",
        pairs: row.katakana.map(([itemRomaji, itemKana]) => ({
          left: row.hiragana.find(([hiraRomaji]) => hiraRomaji === itemRomaji)?.[1],
          right: itemKana,
        })),
        options: [],
        correctAnswer: "全部配对",
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-row-${row.key}-sound-hira-pair`,
        levelId: `level-row-${row.key}-review`,
        questionType: "pair-match",
        knowledgeIds: row.hiragana.map(([itemRomaji]) => kanaId("hira", itemRomaji)),
        questionText: "点左侧播放，连到对应的平假名。",
        pairLabel: "声音 ↔ 平假名",
        pairs: row.hiragana.map(([itemRomaji, itemKana]) => ({ left: itemRomaji, right: itemKana })),
        options: [],
        correctAnswer: "全部配对",
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-row-${row.key}-sound-kata-pair`,
        levelId: `level-row-${row.key}-review`,
        questionType: "pair-match",
        knowledgeIds: row.katakana.map(([itemRomaji]) => kanaId("kata", itemRomaji)),
        questionText: "点左侧播放，连到对应的片假名。",
        pairLabel: "声音 ↔ 片假名",
        pairs: row.katakana.map(([itemRomaji, itemKana]) => ({ left: itemRomaji, right: itemKana })),
        options: [],
        correctAnswer: "全部配对",
        difficulty: 4,
        isPreview: false,
        noRomaji: true,
      });
    }

    questions.push(...buildCumulativeReviewQuestions(`level-cumulative-${row.key}-review`, row.key, kanaRows.slice(0, kanaRows.indexOf(row) + 1), kanaRows.slice(0, kanaRows.indexOf(row) + 1)));
  }

  for (const [romaji, kana] of allHiragana.filter((_, index) => index % 5 === 0)) {
    questions.push({
      id: `q-gojuon-final-hira-${romaji}`,
      levelId: "level-gojuon-clear-review",
      questionType: "audio-to-kana-review",
      knowledgeIds: [kanaId("hira", romaji)],
      questionText: "听声音，选平假名。",
      audioKey: `kana.${romaji}`,
      audioSrc: kanaAudioSrc(romaji),
      options: getOptions(allHiragana, romaji, 5),
      correctAnswer: kana,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
  }

  for (const [romaji, kana] of allKatakana.filter((_, index) => index % 5 === 1)) {
    questions.push({
      id: `q-gojuon-final-kata-${romaji}`,
      levelId: "level-gojuon-clear-review",
      questionType: "audio-to-kana-review",
      knowledgeIds: [kanaId("kata", romaji)],
      questionText: "听声音，选片假名。",
      audioKey: `kana.${romaji}`,
      audioSrc: kanaAudioSrc(romaji),
      options: getOptions(allKatakana, romaji, 5),
      correctAnswer: kana,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
  }

  questions.push({
    id: "q-gojuon-final-pair-a-row",
    levelId: "level-gojuon-clear-review",
    questionType: "pair-match",
    knowledgeIds: ["kana-hira-a", "kana-hira-i", "kana-hira-u", "kana-kata-a", "kana-kata-i", "kana-kata-u"],
    questionText: "把平假名和片假名连起来。",
    pairLabel: "平假名 ↔ 片假名",
    pairs: [
      { left: "あ", right: "ア" },
      { left: "い", right: "イ" },
      { left: "う", right: "ウ" },
    ],
    options: [],
    correctAnswer: "全部配对",
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  });

  for (const module of soundModules) {
    const hiraItems = module.items.map(([romaji, hira]) => [romaji, hira]);
    const kataItems = module.items.map(([romaji, , kata]) => [romaji, kata]);
    for (const [romaji, hira, kata] of module.items) {
      if (isLongVowel(romaji)) {
        questions.push(
          buildLongVowelRuleQuestion({
            id: `q-${module.hiraPrefix}-${romaji}-rule`,
            levelId: `level-${module.hiraPrefix}-${romaji}`,
            knowledgeId: soundId(module.hiraPrefix, romaji),
            prompt: hira,
          }),
        );
        questions.push(
          buildLongVowelRuleQuestion({
            id: `q-${module.kataPrefix}-${romaji}-rule`,
            levelId: `level-${module.kataPrefix}-${romaji}`,
            knowledgeId: soundId(module.kataPrefix, romaji),
            prompt: kata,
          }),
        );
        continue;
      }
      questions.push({
        id: `q-${module.hiraPrefix}-${romaji}-audio-1`,
        levelId: `level-${module.hiraPrefix}-${romaji}`,
        questionType: "audio-to-kana",
        knowledgeIds: [soundId(module.hiraPrefix, romaji)],
        questionText: "听声音，选假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(hiraItems, romaji),
        correctAnswer: hira,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-${module.hiraPrefix}-${romaji}-audio-2`,
        levelId: `level-${module.hiraPrefix}-${romaji}`,
        questionType: "audio-to-kana",
        knowledgeIds: [soundId(module.hiraPrefix, romaji)],
        questionText: "再听一次，选出这个假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(hiraItems.slice().reverse(), romaji),
        correctAnswer: hira,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-${module.kataPrefix}-${romaji}-pair-hira`,
        levelId: `level-${module.kataPrefix}-${romaji}`,
        questionType: "katakana-to-hiragana",
        knowledgeIds: [soundId(module.kataPrefix, romaji)],
        questionText: "看片假名，选平假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(hiraItems, romaji),
        correctAnswer: hira,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      questions.push({
        id: `q-${module.kataPrefix}-${romaji}-audio`,
        levelId: `level-${module.kataPrefix}-${romaji}`,
        questionType: "audio-to-kana",
        knowledgeIds: [soundId(module.kataPrefix, romaji)],
        questionText: "听声音，选片假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(kataItems, romaji),
        correctAnswer: kata,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
    }

    module.items.forEach(([romaji, hira], index) => {
      if (isLongVowel(romaji)) {
        questions.push(
          buildLongVowelRuleQuestion({
            id: `q-${module.hiraPrefix}-review-${romaji}-rule`,
            levelId: `level-${module.hiraPrefix}-review`,
            knowledgeId: soundId(module.hiraPrefix, romaji),
            prompt: hira,
          }),
        );
        return;
      }
      questions.push({
        id: `q-${module.hiraPrefix}-review-${romaji}`,
        levelId: `level-${module.hiraPrefix}-review`,
        questionType: "audio-to-kana-review",
        knowledgeIds: [soundId(module.hiraPrefix, romaji)],
        questionText: "听声音，选假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(hiraItems, romaji),
        correctAnswer: hira,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      if (index === 0 && module.items.length >= 3) {
        questions.push({
          id: `q-${module.hiraPrefix}-pair`,
          levelId: `level-${module.hiraPrefix}-review`,
          questionType: "pair-match",
          knowledgeIds: module.items.slice(0, 3).map(([itemRomaji]) => soundId(module.hiraPrefix, itemRomaji)),
          questionText: "点播放，连到对应的假名。",
          pairLabel: "声音 ↔ 假名",
          pairs: module.items.slice(0, 3).map(([itemRomaji, itemHira]) => ({ left: itemRomaji, right: itemHira })),
          options: [],
          correctAnswer: "全部配对",
          difficulty: 3,
          isPreview: false,
        });
      }
    });

    module.items.forEach(([romaji, hira, kata], index) => {
      if (isLongVowel(romaji)) {
        questions.push(
          buildLongVowelRuleQuestion({
            id: `q-${module.kataPrefix}-review-${romaji}-rule`,
            levelId: `level-${module.kataPrefix}-review`,
            knowledgeId: soundId(module.kataPrefix, romaji),
            prompt: kata,
          }),
        );
        return;
      }
      questions.push({
        id: `q-${module.kataPrefix}-review-${romaji}`,
        levelId: `level-${module.kataPrefix}-review`,
        questionType: "audio-to-kana-review",
        knowledgeIds: [soundId(module.kataPrefix, romaji)],
        questionText: "听声音，选片假名。",
        audioKey: `kana.${romaji}`,
        audioSrc: kanaAudioSrc(romaji),
        options: getOptions(kataItems, romaji),
        correctAnswer: kata,
        difficulty: 3,
        isPreview: false,
        noRomaji: true,
      });
      if (index === 0 && module.items.length >= 3) {
        questions.push({
          id: `q-${module.kataPrefix}-pair`,
          levelId: `level-${module.kataPrefix}-review`,
          questionType: "pair-match",
          knowledgeIds: module.items.slice(0, 3).flatMap(([itemRomaji]) => [
            soundId(module.hiraPrefix, itemRomaji),
            soundId(module.kataPrefix, itemRomaji),
          ]),
          questionText: "把平假名和片假名连起来。",
          pairLabel: "平假名 ↔ 片假名",
          pairs: module.items.slice(0, 3).map(([, itemHira, itemKata]) => ({ left: itemHira, right: itemKata })),
          options: [],
          correctAnswer: "全部配对",
          difficulty: 3,
          isPreview: false,
          noRomaji: true,
        });
      }
    });
  }

  const basicReviewItems = soundModules.flatMap((module) => module.items.slice(0, 3).map(([romaji, hira, kata]) => ({ module, romaji, hira, kata })));
  for (const item of basicReviewItems.filter((item, index) => !isLongVowel(item.romaji) && index % 3 === 0)) {
    questions.push({
      id: `q-basic-final-hira-${item.module.key}-${item.romaji}`,
      levelId: "level-basic-sounds-review",
      questionType: "audio-to-kana-review",
      knowledgeIds: [soundId(item.module.hiraPrefix, item.romaji)],
      questionText: "听声音，选假名。",
      audioKey: `kana.${item.romaji}`,
      audioSrc: kanaAudioSrc(item.romaji),
      options: getOptions(item.module.items.map(([romaji, hira]) => [romaji, hira]), item.romaji),
      correctAnswer: item.hira,
      difficulty: 4,
      isPreview: false,
      noRomaji: true,
    });
  }

  questions.push(
    buildLongVowelRuleQuestion({
      id: "q-basic-final-special-long-vowel-rule",
      levelId: "level-basic-sounds-review",
      knowledgeId: soundId("hira-special", "long-vowel"),
      prompt: "ー",
      difficulty: 4,
    }),
  );

  questions.push({
    id: "q-basic-final-yoon-pair",
    levelId: "level-basic-sounds-review",
    questionType: "pair-match",
    knowledgeIds: ["kana-hira-yoon-kya", "kana-kata-yoon-kya", "kana-hira-yoon-sha", "kana-kata-yoon-sha"],
    questionText: "把平假名和片假名连起来。",
    pairLabel: "平假名 ↔ 片假名",
    pairs: [
      { left: "きゃ", right: "キャ" },
      { left: "しゃ", right: "シャ" },
      { left: "ちゃ", right: "チャ" },
    ],
    options: [],
    correctAnswer: "全部配对",
    difficulty: 4,
    isPreview: false,
    noRomaji: true,
  });

  return questions;
}

export const generatedKnowledge = buildKnowledge();
export const generatedLevels = buildLevels();
export const generatedQuestions = buildQuestions();
export const generatedKanaSpeech = Object.fromEntries(
  generatedKnowledge.filter((item) => item.audioKey).map((item) => [item.audioKey, item.kana]),
);


