# 音频资源

当前阶段已加入日语读音 WAV 文件。日语读音只能播放打包内的 WAV 资源。

硬性规则：

- 运行时禁止使用 TTS、Web Speech、拼接音或系统合成语音作为日语读音兜底。
- `audioKey` 只能用于映射本地 WAV 路径，不能触发合成读音。
- Android 端必须通过 `NativeSpeech.playAsset` 播放 APK 内置 WAV；播放失败就是回归问题，不能静默降级到 TTS。
- 默认声音必须开启，默认音量不得低于 80%。
- 每次 UI、课程、布局或 Android 同步后，都要跑声音回归验证。

当前资源命名：

```text
assets/audio/kana/a.wav
assets/audio/kana/i.wav
assets/audio/kana/u.wav
assets/audio/kana/e.wav
assets/audio/kana/o.wav
assets/audio/words/ai.wav
assets/audio/words/ii.wav
assets/audio/words/aa.wav
assets/audio/words/ao.wav
assets/audio/words/au.wav
assets/audio/words/e.wav
assets/audio/words/ie.wav
assets/audio/words/iie.wav
assets/audio/words/iu.wav
assets/audio/words/oi.wav
assets/audio/words/ue.wav
```

UI 点击、答对、答错、完成音效当前使用浏览器音频合成；这只用于游戏反馈音效，不用于日语读音。
