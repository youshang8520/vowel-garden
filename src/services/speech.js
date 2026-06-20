export class SpeechService {
  constructor() {
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.recordedChunks = [];
    this.recordedUrl = "";
    this.startedAt = 0;
  }

  getNativeRecorder() {
    return window.Capacitor?.Plugins?.NativeRecorder || null;
  }

  async startRecording() {
    const nativeRecorder = this.getNativeRecorder();
    if (nativeRecorder?.startRecording) {
      return nativeRecorder.startRecording();
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return { recording: false, unsupported: true, reason: "speech-recording-unavailable" };
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) this.recordedChunks.push(event.data);
    });
    this.mediaRecorder.start();
    this.startedAt = Date.now();
    return { recording: true, platform: "web-media-recorder" };
  }

  async stopRecording() {
    const nativeRecorder = this.getNativeRecorder();
    if (nativeRecorder?.stopRecording) {
      return nativeRecorder.stopRecording();
    }

    if (!this.mediaRecorder) {
      return { recording: false, hasRecording: false, durationMs: 0 };
    }

    const durationMs = Date.now() - this.startedAt;
    await new Promise((resolve) => {
      this.mediaRecorder.addEventListener("stop", resolve, { once: true });
      this.mediaRecorder.stop();
    });
    this.mediaStream?.getTracks?.().forEach((track) => track.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
    if (this.recordedUrl) URL.revokeObjectURL(this.recordedUrl);
    const blob = new Blob(this.recordedChunks, { type: "audio/webm" });
    this.recordedUrl = URL.createObjectURL(blob);
    return { recording: false, hasRecording: blob.size > 0, durationMs, path: this.recordedUrl };
  }

  async playRecording() {
    const nativeRecorder = this.getNativeRecorder();
    if (nativeRecorder?.playRecording) {
      return nativeRecorder.playRecording();
    }
    if (!this.recordedUrl) return { skipped: true, reason: "missing-recording" };
    const audio = new Audio(this.recordedUrl);
    await audio.play();
    return { playing: true, platform: "web-audio" };
  }

  async deleteRecording() {
    const nativeRecorder = this.getNativeRecorder();
    if (nativeRecorder?.deleteRecording) {
      return nativeRecorder.deleteRecording();
    }
    if (this.recordedUrl) URL.revokeObjectURL(this.recordedUrl);
    this.recordedUrl = "";
    this.recordedChunks = [];
    return { deleted: true };
  }

  async recognizeRecording(question = {}, recordingResult = {}) {
    const nativeRecorder = this.getNativeRecorder();
    if (nativeRecorder?.recognizeRecording) {
      const acceptedAnswers = getSpeechAcceptedAnswers(question);
      return nativeRecorder.recognizeRecording({
        questionId: question.id || "",
        target: question.speechTarget || question.prompt || question.correctAnswer || "",
        acceptedAnswers,
        durationMs: recordingResult.durationMs || 0,
      });
    }

    return {
      available: false,
      engine: "web-recording-review",
      modelReady: false,
      transcript: "",
      message: "录音已保存，可以回放对比。",
    };
  }

  evaluateRecording(question, recordingResult = {}, recognitionResult = {}) {
    const minDurationMs = question.minDurationMs || 500;
    const durationMs = Number(recordingResult.durationMs || 0);
    const hasRecording = Boolean(recordingResult.hasRecording);
    const hasTranscript = Boolean(recognitionResult.transcript);
    const asrAvailable = recognitionResult.available !== false;
    const modelReady = recognitionResult.modelReady !== false;
    const acceptedAnswers = getSpeechAcceptedAnswers(question);
    const transcript = normalizeSpeechText(recognitionResult.transcript);
    const normalizedAnswers = acceptedAnswers.map(normalizeSpeechText).filter(Boolean);
    const bestSimilarity = getBestSpeechSimilarity(transcript, normalizedAnswers);
    const recognized = hasTranscript && (normalizedAnswers.includes(transcript) || bestSimilarity >= 0.72);
    const confidence = Number(recognitionResult.confidence || 0);
    const canReviewOnly = !asrAvailable || !modelReady;
    const longEnough = durationMs >= minDurationMs;
    const passed = hasRecording && longEnough && (recognized || canReviewOnly);

    return {
      passed,
      mode: hasTranscript ? "asr-text-match" : canReviewOnly ? "recording-review" : "asr-listened",
      transcript: recognitionResult.transcript || "",
      engine: recognitionResult.engine || "web-recording-review",
      confidence,
      similarity: bestSimilarity,
      durationMs,
      message: getSpeechFeedbackMessage({
        hasRecording,
        longEnough,
        hasTranscript,
        recognized,
        canReviewOnly,
        confidence,
        similarity: bestSimilarity,
        recognitionMessage: recognitionResult.message,
      }),
    };
  }
}

function getSpeechAcceptedAnswers(question = {}) {
  return [
    question.speechTarget,
    question.prompt,
    question.correctAnswer,
    ...(question.acceptedAnswers || []),
  ]
    .filter(Boolean)
    .map((value) => String(value).replace(/\s*\/\s*/g, " "))
    .filter((value, index, values) => values.indexOf(value) === index);
}

function normalizeSpeechText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[、。,.!?！？\s]/g, "")
    .replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function getBestSpeechSimilarity(transcript, answers) {
  if (!transcript || !answers.length) return 0;
  return answers.reduce((best, answer) => Math.max(best, getTextSimilarity(transcript, answer)), 0);
}

function getTextSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = getLevenshteinDistance(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function getLevenshteinDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

function getSpeechFeedbackMessage({
  hasRecording,
  longEnough,
  hasTranscript,
  recognized,
  canReviewOnly,
  confidence,
  similarity,
  recognitionMessage,
}) {
  if (!hasRecording) return "先录一遍。";
  if (!longEnough) return "再读一遍，声音留长一点。";
  if (canReviewOnly) return recognitionMessage || "录音已保存，可以回放对比。";
  if (!hasTranscript) return "这次没听清，再慢一点读。";
  if (recognized && confidence >= 0.78) return "读音对上了，很清楚。";
  if (recognized) return "读音基本对上了。";
  if (similarity >= 0.45) return "接近了，再把每个音读清楚。";
  return "再读一遍，慢一点。";
}

export const speechService = new SpeechService();
