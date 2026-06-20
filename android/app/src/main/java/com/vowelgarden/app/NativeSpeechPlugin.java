package com.vowelgarden.app;

import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeSpeech")
public class NativeSpeechPlugin extends Plugin {
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private MediaPlayer mediaPlayer;
    private int playbackToken = 0;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(getContext().AUDIO_SERVICE);
    }

    @PluginMethod
    public void playAsset(PluginCall call) {
        String src = call.getString("src", "");
        float volume = call.getFloat("volume", 1.0f);
        if (src.isEmpty()) {
            call.reject("Missing src");
            return;
        }

        String assetPath = normalizeAssetPath(src);
        AssetFileDescriptor descriptor = null;
        MediaPlayer player = null;
        try {
            stopMediaPlayer();
            requestMediaFocus();
            descriptor = getContext().getAssets().openFd(assetPath);
            player = new MediaPlayer();
            int token = setActiveMediaPlayer(player);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                player.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build());
            } else {
                player.setAudioStreamType(AudioManager.STREAM_MUSIC);
            }
            float safeVolume = Math.max(0.0f, Math.min(1.0f, volume));
            player.setVolume(safeVolume, safeVolume);
            player.setDataSource(descriptor.getFileDescriptor(), descriptor.getStartOffset(), descriptor.getLength());
            descriptor.close();
            descriptor = null;
            final MediaPlayer activePlayer = player;
            final int activeToken = token;
            player.setOnCompletionListener(completedPlayer -> stopMediaPlayerIfCurrent(completedPlayer, activeToken));
            player.setOnErrorListener((failedPlayer, what, extra) -> {
                stopMediaPlayerIfCurrent(failedPlayer, activeToken);
                return true;
            });
            player.prepare();
            player.start();

            JSObject result = new JSObject();
            result.put("played", assetPath);
            call.resolve(result);
        } catch (Exception error) {
            closeDescriptor(descriptor);
            if (player != null) {
                stopMediaPlayerIfCurrent(player, playbackToken);
            } else {
                stopMediaPlayer();
            }
            call.reject("Unable to play asset " + assetPath, error);
        }
    }

    private String normalizeAssetPath(String src) {
        String path = src.trim()
                .replace("https://localhost/", "")
                .replace("http://localhost/", "")
                .replaceFirst("^/+", "")
                .replaceFirst("^\\./+", "");
        if (!path.startsWith("public/")) {
            path = "public/" + path;
        }
        return path;
    }

    private synchronized int setActiveMediaPlayer(MediaPlayer player) {
        mediaPlayer = player;
        playbackToken += 1;
        return playbackToken;
    }

    private void stopMediaPlayerIfCurrent(MediaPlayer player, int token) {
        boolean shouldStop;
        synchronized (this) {
            shouldStop = mediaPlayer == player && playbackToken == token;
            if (shouldStop) {
                mediaPlayer = null;
                playbackToken += 1;
            }
        }
        releaseMediaPlayer(player);
        if (shouldStop) {
            abandonMediaFocus();
        }
    }

    private void stopMediaPlayer() {
        MediaPlayer player;
        synchronized (this) {
            player = mediaPlayer;
            mediaPlayer = null;
            playbackToken += 1;
        }
        releaseMediaPlayer(player);
        abandonMediaFocus();
    }

    private void releaseMediaPlayer(MediaPlayer player) {
        if (player == null) {
            return;
        }
        try {
            player.setOnCompletionListener(null);
            player.setOnErrorListener(null);
            player.stop();
        } catch (Exception ignored) {
        }
        try {
            player.release();
        } catch (Exception ignored) {
        }
    }

    private void closeDescriptor(AssetFileDescriptor descriptor) {
        if (descriptor == null) {
            return;
        }
        try {
            descriptor.close();
        } catch (Exception ignored) {
        }
    }

    private void requestMediaFocus() {
        if (audioManager == null) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attributes)
                    .build();
            audioManager.requestAudioFocus(focusRequest);
        } else {
            audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }
    }

    private void abandonMediaFocus() {
        if (audioManager == null) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
            focusRequest = null;
        } else {
            audioManager.abandonAudioFocus(null);
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopMediaPlayer();
    }
}
