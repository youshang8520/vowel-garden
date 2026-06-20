package com.vowelgarden.app;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.StorageService;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "NativeRecorder",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class NativeRecorderPlugin extends Plugin {
    private static final int SAMPLE_RATE = 16000;
    private static final int WAV_HEADER_BYTES = 44;
    private static final String MODEL_ASSET_NAME = "model-ja";
    private static final String MODEL_OUTPUT_NAME = "model-ja";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private AudioRecord recorder;
    private MediaPlayer playback;
    private File outputFile;
    private Thread recordingThread;
    private volatile boolean isRecording = false;
    private long startedAtMs = 0;
    private Model voskModel;

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }

        try {
            stopPlayback();
            stopRecorderSilently();
            outputFile = new File(getContext().getCacheDir(), "vowel-garden-speech.wav");
            if (outputFile.exists()) {
                outputFile.delete();
            }

            int minBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            int bufferSize = Math.max(minBufferSize, SAMPLE_RATE);
            recorder = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            );

            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                releaseRecorder();
                call.reject("Recorder not ready");
                return;
            }

            writeEmptyWavHeader(outputFile);
            isRecording = true;
            startedAtMs = System.currentTimeMillis();
            recorder.startRecording();
            recordingThread = new Thread(() -> writeAudioData(outputFile, bufferSize), "VowelGardenRecorder");
            recordingThread.start();

            JSObject result = new JSObject();
            result.put("recording", true);
            result.put("format", "wav");
            result.put("sampleRate", SAMPLE_RATE);
            call.resolve(result);
        } catch (Exception error) {
            stopRecorderSilently();
            call.reject("Unable to start recording", error);
        }
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecording(call);
            return;
        }
        call.reject("Microphone permission denied");
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        long durationMs = startedAtMs > 0 ? System.currentTimeMillis() - startedAtMs : 0;
        stopRecorderSilently();
        try {
            if (outputFile != null && outputFile.exists()) {
                updateWavHeader(outputFile);
            }
        } catch (Exception ignored) {
        }

        JSObject result = new JSObject();
        result.put("recording", false);
        result.put("durationMs", durationMs);
        result.put("hasRecording", outputFile != null && outputFile.exists() && outputFile.length() > WAV_HEADER_BYTES);
        result.put("path", outputFile != null ? outputFile.getAbsolutePath() : "");
        result.put("format", "wav");
        result.put("sampleRate", SAMPLE_RATE);
        call.resolve(result);
    }

    @PluginMethod
    public void playRecording(PluginCall call) {
        if (outputFile == null || !outputFile.exists() || outputFile.length() <= WAV_HEADER_BYTES) {
            call.reject("No recording available");
            return;
        }

        try {
            stopPlayback();
            playback = new MediaPlayer();
            playback.setDataSource(outputFile.getAbsolutePath());
            playback.setOnCompletionListener(player -> stopPlayback());
            playback.setOnErrorListener((player, what, extra) -> {
                stopPlayback();
                return true;
            });
            playback.prepare();
            playback.start();

            JSObject result = new JSObject();
            result.put("playing", true);
            result.put("path", outputFile.getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            stopPlayback();
            call.reject("Unable to play recording", error);
        }
    }

    @PluginMethod
    public void deleteRecording(PluginCall call) {
        stopPlayback();
        stopRecorderSilently();
        boolean deleted = false;
        if (outputFile != null && outputFile.exists()) {
            deleted = outputFile.delete();
        }
        outputFile = null;
        JSObject result = new JSObject();
        result.put("deleted", deleted);
        call.resolve(result);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("recording", isRecording);
        result.put("hasRecording", outputFile != null && outputFile.exists() && outputFile.length() > WAV_HEADER_BYTES);
        result.put("path", outputFile != null ? outputFile.getAbsolutePath() : "");
        result.put("format", "wav");
        result.put("sampleRate", SAMPLE_RATE);
        result.put("modelReady", isVoskModelAvailable());
        call.resolve(result);
    }

    @PluginMethod
    public void recognizeRecording(PluginCall call) {
        if (outputFile == null || !outputFile.exists() || outputFile.length() <= WAV_HEADER_BYTES) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("engine", "vosk-android");
            result.put("transcript", "");
            result.put("message", "先录一遍。");
            call.resolve(result);
            return;
        }

        executor.execute(() -> ensureModelAndRecognize(call));
    }

    private void ensureModelAndRecognize(PluginCall call) {
        try {
            if (voskModel != null) {
                recognizeWithLoadedModel(call);
                return;
            }

            if (!isVoskModelAvailable()) {
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("engine", "vosk-android");
                result.put("modelReady", false);
                result.put("transcript", "");
                result.put("message", "离线识别模型还没准备好，可以先回放对比。");
                call.resolve(result);
                return;
            }

            StorageService.unpack(
                getContext(),
                MODEL_ASSET_NAME,
                MODEL_OUTPUT_NAME,
                model -> {
                    voskModel = model;
                    executor.execute(() -> recognizeWithLoadedModel(call));
                },
                exception -> {
                    JSObject result = new JSObject();
                    result.put("available", false);
                    result.put("engine", "vosk-android");
                    result.put("modelReady", false);
                    result.put("transcript", "");
                    result.put("message", "离线识别模型还没准备好，可以先回放对比。");
                    result.put("error", exception.getMessage());
                    call.resolve(result);
                }
            );
        } catch (Exception error) {
            call.reject("Unable to recognize recording", error);
        }
    }

    private void recognizeWithLoadedModel(PluginCall call) {
        try {
            String grammar = buildGrammar(call);
            Recognizer recognizer = grammar.isEmpty()
                ? new Recognizer(voskModel, SAMPLE_RATE)
                : new Recognizer(voskModel, SAMPLE_RATE, grammar);
            recognizer.setWords(true);

            byte[] buffer = new byte[4096];
            try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(outputFile))) {
                long skipped = input.skip(WAV_HEADER_BYTES);
                if (skipped != WAV_HEADER_BYTES) {
                    throw new IOException("Recording is too short");
                }
                int read;
                while ((read = input.read(buffer)) > 0) {
                    recognizer.acceptWaveForm(buffer, read);
                }
            }

            String finalJson = recognizer.getFinalResult();
            recognizer.close();
            JSObject parsed = parseRecognition(finalJson);
            parsed.put("available", true);
            parsed.put("engine", "vosk-android");
            parsed.put("modelReady", true);
            parsed.put("message", parsed.getString("transcript").isEmpty() ? "声音收到了，再慢一点读。" : "识别完成。");
            call.resolve(parsed);
        } catch (Exception error) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("engine", "vosk-android");
            result.put("modelReady", voskModel != null);
            result.put("transcript", "");
            result.put("message", "这次没听清，再读一遍。");
            result.put("error", error.getMessage());
            call.resolve(result);
        }
    }

    private String buildGrammar(PluginCall call) {
        if (!Boolean.TRUE.equals(call.getBoolean("useGrammar"))) return "";
        JSArray answers = call.getArray("acceptedAnswers");
        if (answers == null || answers.length() == 0) return "";
        JSONArray grammar = new JSONArray();
        for (int index = 0; index < answers.length(); index += 1) {
            String value = answers.optString(index, "").trim();
            if (!value.isEmpty()) {
                grammar.put(value);
            }
        }
        grammar.put("[unk]");
        return grammar.toString();
    }

    private JSObject parseRecognition(String finalJson) throws Exception {
        JSONObject json = new JSONObject(finalJson == null ? "{}" : finalJson);
        String transcript = json.optString("text", "");
        JSONArray words = json.optJSONArray("result");
        double confidenceSum = 0.0;
        int confidenceCount = 0;
        if (words != null) {
            for (int index = 0; index < words.length(); index += 1) {
                JSONObject word = words.optJSONObject(index);
                if (word != null && word.has("conf")) {
                    confidenceSum += word.optDouble("conf", 0.0);
                    confidenceCount += 1;
                }
            }
        }
        double confidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0.0;
        JSObject result = new JSObject();
        result.put("transcript", transcript);
        result.put("confidence", confidence);
        result.put("raw", finalJson == null ? "{}" : finalJson);
        return result;
    }

    private boolean isVoskModelAvailable() {
        try {
            String[] files = getContext().getAssets().list(MODEL_ASSET_NAME);
            return files != null && files.length > 0;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void writeAudioData(File file, int bufferSize) {
        byte[] buffer = new byte[bufferSize];
        try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(file, true))) {
            while (isRecording && recorder != null) {
                int read = recorder.read(buffer, 0, buffer.length);
                if (read > 0) {
                    output.write(buffer, 0, read);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void writeEmptyWavHeader(File file) throws IOException {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(new byte[WAV_HEADER_BYTES]);
        }
    }

    private void updateWavHeader(File file) throws IOException {
        long audioLength = Math.max(0, file.length() - WAV_HEADER_BYTES);
        long dataLength = audioLength + 36;
        int byteRate = SAMPLE_RATE * 2;
        byte[] header = new byte[WAV_HEADER_BYTES];
        writeAscii(header, 0, "RIFF");
        writeLittleEndian(header, 4, dataLength, 4);
        writeAscii(header, 8, "WAVE");
        writeAscii(header, 12, "fmt ");
        writeLittleEndian(header, 16, 16, 4);
        writeLittleEndian(header, 20, 1, 2);
        writeLittleEndian(header, 22, 1, 2);
        writeLittleEndian(header, 24, SAMPLE_RATE, 4);
        writeLittleEndian(header, 28, byteRate, 4);
        writeLittleEndian(header, 32, 2, 2);
        writeLittleEndian(header, 34, 16, 2);
        writeAscii(header, 36, "data");
        writeLittleEndian(header, 40, audioLength, 4);
        try (RandomAccessFile output = new RandomAccessFile(file, "rw")) {
            output.seek(0);
            output.write(header);
        }
    }

    private void writeAscii(byte[] target, int offset, String value) {
        byte[] bytes = value.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(bytes, 0, target, offset, bytes.length);
    }

    private void writeLittleEndian(byte[] target, int offset, long value, int byteCount) {
        for (int index = 0; index < byteCount; index += 1) {
            target[offset + index] = (byte) ((value >> (8 * index)) & 0xff);
        }
    }

    private void stopRecorderSilently() {
        isRecording = false;
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (Exception ignored) {
            }
        }
        if (recordingThread != null) {
            try {
                recordingThread.join(800);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
        }
        releaseRecorder();
    }

    private void releaseRecorder() {
        if (recorder != null) {
            try {
                recorder.release();
            } catch (Exception ignored) {
            }
        }
        recorder = null;
        recordingThread = null;
        startedAtMs = 0;
    }

    private void stopPlayback() {
        if (playback == null) {
            return;
        }
        try {
            playback.stop();
        } catch (Exception ignored) {
        }
        try {
            playback.release();
        } catch (Exception ignored) {
        }
        playback = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopPlayback();
        stopRecorderSilently();
        if (voskModel != null) {
            try {
                voskModel.close();
            } catch (Exception ignored) {
            }
            voskModel = null;
        }
        executor.shutdownNow();
    }
}
