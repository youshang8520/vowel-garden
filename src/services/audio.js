export class AudioService {
  constructor() {
    this.enabled = true;
    this.volume = 1;
    this.toneGain = 0.12;
    this.toneDuration = 0.14;
    this.useBundledUi = false;
    this.nativePlayId = 0;
    this.audioContext = null;
    this.uiCueMap = {
      click: { sequence: [{ frequency: 520, duration: 0.055, gain: 0.05 }] },
      correct: {
        sequence: [
          { frequency: 720, duration: 0.075, gain: 0.12 },
          { frequency: 960, duration: 0.11, gain: 0.13, offset: 0.07 },
        ],
      },
      wrong: {
        sequence: [
          { frequency: 240, duration: 0.12, gain: 0.14 },
          { frequency: 160, duration: 0.18, gain: 0.12, offset: 0.1 },
        ],
      },
      complete: {
        sequence: [
          { frequency: 660, duration: 0.08, gain: 0.12 },
          { frequency: 880, duration: 0.08, gain: 0.13, offset: 0.07 },
          { frequency: 1175, duration: 0.1, gain: 0.13, offset: 0.14 },
          { frequency: 1568, duration: 0.16, gain: 0.1, offset: 0.23 },
          { frequency: 1318, duration: 0.09, gain: 0.08, offset: 0.31 },
          { frequency: 1760, duration: 0.12, gain: 0.08, offset: 0.38 },
        ],
      },
    };
  }

  play(src, audioKey = null) {
    if (!this.enabled) {
      return Promise.resolve({ skipped: true });
    }

    const audioSrc = typeof src === "string" ? src.trim() : src;
    const nativeBridge = window.Capacitor?.Plugins?.NativeSpeech;

    if (!audioSrc) {
      return Promise.resolve({ skipped: true, reason: "missing-audio-src", audioKey });
    }

    if (nativeBridge?.playAsset) {
      const playId = ++this.nativePlayId;
      return nativeBridge
        .playAsset({ src: audioSrc, volume: this.volume })
        .then((result) => ({ ...(result || {}), played: "native-asset", src: audioSrc, playId }))
        .catch((error) => {
          const failure = {
            skipped: true,
            reason: "native-asset-failed",
            audioKey,
            src: audioSrc,
            playId,
            errorName: error?.name || "NativeAudioError",
            errorMessage: error?.message || String(error || ""),
          };
          if (this.isNativeRuntime()) {
            return failure;
          }
          return this.playWithHtmlAudio(audioSrc, audioKey);
        });
    }

    return this.playWithHtmlAudio(audioSrc, audioKey);
  }

  playWithHtmlAudio(audioSrc, audioKey = null) {
    const audio = new Audio(audioSrc);
    audio.volume = this.volume;

    return audio
      .play()
      .then(() => ({ played: "audio", src: audioSrc }))
      .catch((error) => ({
        skipped: true,
        reason: "audio-play-failed",
        audioKey,
        errorName: error?.name || "AudioError",
        errorMessage: error?.message || "",
      }));
  }

  playUiCue(type) {
    const cue = this.uiCueMap[type];
    if (!cue || !this.enabled) {
      return Promise.resolve({ skipped: true });
    }

    if (!this.useBundledUi) {
      return this.playCueSequence(cue.sequence || [{ frequency: cue.frequency }]);
    }

    const audio = new Audio(cue.src);
    audio.volume = this.volume;

    return audio
      .play()
      .then(() => ({ played: "audio", src: cue.src }))
      .catch((error) =>
        this.playCueSequence(cue.sequence || [{ frequency: cue.frequency }]).then((result) => ({
          ...(result || {}),
          fallbackFrom: "ui-audio",
          errorName: error?.name || "AudioError",
        })),
      );
  }

  unlock() {
    if (!this.enabled) {
      return Promise.resolve({ skipped: true, reason: "disabled" });
    }

    const context = this.getAudioContext();
    if (!context) {
      return Promise.resolve({ skipped: true, reason: "no-audio-context" });
    }

    if (context.state === "running") {
      return Promise.resolve({ unlocked: true, state: context.state });
    }

    return context.resume().then(() => ({ unlocked: true, state: context.state }));
  }

  playTone(frequency) {
    return this.playCueSequence([{ frequency, duration: this.toneDuration, gain: this.toneGain }]);
  }

  playCueSequence(sequence) {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return Promise.resolve({ skipped: true });
    }

    const context = this.getAudioContext();
    if (!context) {
      return Promise.resolve({ skipped: true });
    }

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const startTime = context.currentTime;

    sequence.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const offset = note.offset || 0;
      const duration = note.duration || this.toneDuration;
      const noteGain = (note.gain || this.toneGain) * this.volume;

      oscillator.type = note.type || "sine";
      oscillator.frequency.setValueAtTime(note.frequency, startTime + offset);
      gain.gain.setValueAtTime(noteGain, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime + offset);
      oscillator.stop(startTime + offset + duration);
    });

    return Promise.resolve({ fallback: "tone-sequence", count: sequence.length });
  }

  getAudioContext() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    return this.audioContext;
  }

  isNativeRuntime() {
    return Boolean(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === "android");
  }
}

export const audioService = new AudioService();
