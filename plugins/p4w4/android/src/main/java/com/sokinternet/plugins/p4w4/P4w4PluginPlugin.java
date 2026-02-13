package com.sokinternet.plugins.p4w4;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.view.View;
import android.view.ViewGroup;
import android.util.Log;
import android.graphics.Color;

import android.content.Context;

import android.os.Process;

import android.webkit.WebView;

import com.getcapacitor.Bridge;

import android.os.Handler;
import android.os.Looper;
import android.content.res.AssetManager;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;


@CapacitorPlugin(name = "P4w4Plugin")
public class P4w4PluginPlugin extends Plugin {

    private P4w4Plugin implementation = new P4w4Plugin();
    private static final String DEFAULT_VOSK_MODEL = "vosk-model-small-en-us-0.15";
    private static final String PREFERRED_VOSK_MODEL = "vosk-model-large-en-us-0.22";
    private static final Object VOSK_LOCK = new Object();
    private static Model voskModel = null;
    private static String voskModelPath = null;

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");

        JSObject ret = new JSObject();
        ret.put("value", implementation.echo(value));
        call.resolve(ret);
    }
    
    @PluginMethod
    public void reverse(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("Falta el valor.");
            return;
        }

        String reversed = new StringBuilder(value).reverse().toString();
        JSObject result = new JSObject();
        result.put("value", reversed);
        call.resolve(result);
    }

    @PluginMethod
    public void resizeWebView(PluginCall call) {
        Integer offset = call.getInt("offset");
        if (offset == null) {
            Log.i("P4w4Plugin", ">#P4w4Plugin#> resizeWebView: Falta el offset.");
            call.reject("Falta el offset.");
            return;
        }

        Log.i("P4w4Plugin", String.format(">#P4w4Plugin#> resizeWebView: Reduciendo altura del WebView en %d px.",offset ) );
        // Ejecutamos en el hilo principal porque manipulamos UI
        getActivity().runOnUiThread(() -> {
            View webView = bridge.getWebView();
            ViewGroup.LayoutParams params = webView.getLayoutParams();

            if (params != null) {

                int originalHeight = webView.getHeight();

                // Convertir el offset (que viene en dp (density-independent pixels) ) según la densidad en pixeles de verdad, que es lo que manejan las funciones que tratan el WebView.
                //float density = getContext().getResources().getDisplayMetrics().density;
                //int offsetPx = Math.round(offset * density);

                // Viene en px (Píxeles reales)
                int offsetPx = offset;

                int newHeight = originalHeight - offsetPx;

                Log.i("P4w4Plugin", ">#P4w4Plugin#> resizeWebView: WebView height original: " + originalHeight + ", nuevo: " + newHeight);

                // Forzamos altura absoluta en píxeles
                params.height = newHeight;
                //webView.setBackgroundColor(Color.RED);                
                webView.setLayoutParams(params);
                webView.requestLayout();

                Log.i("P4w4Plugin", ">#P4w4Plugin#> resizeWebView: Hecho.");
            } 
            else 
            {
                Log.i("P4w4Plugin", ">#P4w4Plugin#> resizeWebView: webView.getLayoutParams() devolvió null.");
            }

            call.resolve();
        });
    }

    @PluginMethod
    public void offsetTopWebView(PluginCall call) {
        Integer offset = call.getInt("offset");
        if (offset == null) {
            Log.i("P4w4Plugin", ">#P4w4Plugin#> offsetTopWebView: Falta el offset.");
            call.reject("Falta el offset.");
            return;
        }

        Log.i("P4w4Plugin", String.format(">#P4w4Plugin#> offsetTopWebView: Desplazando WebView en %d px.",offset ) );
        getActivity().runOnUiThread(() -> {
            View webView = getBridge().getWebView();
            ViewGroup.LayoutParams params = webView.getLayoutParams();

            // Convertir el offset (que viene en dp (density-independent pixels) ) según la densidad en pixeles de verdad, que es lo que manejan las funciones que tratan el WebView.
            //float density = getContext().getResources().getDisplayMetrics().density;
            //int offsetPx = Math.round(offset * density);

            // Viene en px (Píxeles reales)
            int offsetPx = offset;

            if (params != null) {
                if (offset >= 0) {
                    int newHeight = webView.getHeight() - offsetPx;
                    webView.setTranslationY(offsetPx);
                    params.height = newHeight;
                    webView.setLayoutParams(params);
                    webView.requestLayout();

                    Log.i("P4w4Plugin", ">#P4w4Plugin#> offsetTopWebView: WebView desplazado hacia abajo " + offsetPx + "px y altura reducida a " + newHeight);
                } else {
                    webView.setTranslationY(0);
                    params.height = ViewGroup.LayoutParams.MATCH_PARENT;
                    webView.setLayoutParams(params);
                    webView.requestLayout();

                    Log.i("P4w4Plugin", ">#P4w4Plugin#> offsetTopWebView: WebView restaurado a altura completa");
                }

                call.resolve();
            } else {
                call.reject(">#P4w4Plugin#> offsetTopWebView: No se pudo obtener LayoutParams del WebView.");
            }
        });
    }


    @PluginMethod
    public void getStatusBarHeight(PluginCall call) {
        int result = 0;
        int resourceId = getContext().getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            Log.i("P4w4Plugin", ">#P4w4Plugin#> getStatusBarHeight: resourceId:" + resourceId);
            result = getContext().getResources().getDimensionPixelSize(resourceId);
        }
        else
        {
            Log.i("P4w4Plugin", ">#P4w4Plugin#> getStatusBarHeight: no se pudo obtener resourceId.");
        }
        JSObject ret = new JSObject();
        ret.put("height", result);
        Log.i("P4w4Plugin", ">#P4w4Plugin#> getStatusBarHeight: StatusBar height: " + result + "px");
        call.resolve(ret);
    }


    @PluginMethod
    public void setStartupHtml(PluginCall call) {
        String file = call.getString("file");
        if (file == null || file.isEmpty()) {
            Log.i("P4w4Plugin", ">#P4w4Plugin#> setStartupHtml: Falta el parámetro 'file'.");
            call.reject("Falta el parámetro 'file'.");
            return;
        }

        getContext()
            .getSharedPreferences("reload_html", Context.MODE_PRIVATE)
            .edit()
            .putString("startup_file", file)
            .apply();

        Log.i("P4w4Plugin", ">#P4w4Plugin#> setStartupHtml: SharedPreferences('reload_html'): " + file);

        call.resolve();
    }

    @PluginMethod
    public void reloadWebView(PluginCall call) {
        String file = getContext()
            .getSharedPreferences("reload_html", Context.MODE_PRIVATE)
            .getString("startup_file", "index.html");

        WebView webView = (WebView) getBridge().getWebView();

        // Ejecutar en el hilo principal
        new Handler(Looper.getMainLooper()).post(() -> {

            Log.i("P4w4Plugin", ">#P4w4Plugin#> reloadWebView: SharedPreferences('reload_html'): " + file);

            webView.loadUrl("file:///android_asset/public/" + file);

            Log.i("P4w4Plugin", ">#P4w4Plugin#> reloadWebView: Nuevo html cargado.");

            call.resolve();
        });
    }

    private static class WavInfo {
        final int sampleRate;
        final int dataOffset;
        final int dataLength;

        WavInfo(int sampleRate, int dataOffset, int dataLength) {
            this.sampleRate = sampleRate;
            this.dataOffset = dataOffset;
            this.dataLength = dataLength;
        }
    }

    private String normalizePath(String path) {
        if (path == null) return "";
        if (path.startsWith("file://")) {
            Uri uri = Uri.parse(path);
            String decoded = uri.getPath();
            return decoded != null ? decoded : path.replace("file://", "");
        }
        return path;
    }

    private InputStream openInputStream(String path) throws IOException {
        if (path == null || path.isEmpty()) {
            throw new FileNotFoundException("Ruta vacia");
        }
        if (path.startsWith("content://")) {
            InputStream stream = getContext().getContentResolver().openInputStream(Uri.parse(path));
            if (stream == null) {
                throw new FileNotFoundException("No se pudo abrir el audio");
            }
            return stream;
        }
        String resolved = normalizePath(path);
        return new FileInputStream(resolved);
    }

    private byte[] readAllBytes(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private int readIntLE(byte[] data, int offset) {
        return (data[offset] & 0xff) |
            ((data[offset + 1] & 0xff) << 8) |
            ((data[offset + 2] & 0xff) << 16) |
            ((data[offset + 3] & 0xff) << 24);
    }

    private WavInfo parseWav(byte[] data) {
        if (data.length < 44) return null;
        String riff = new String(data, 0, 4, StandardCharsets.US_ASCII);
        String wave = new String(data, 8, 4, StandardCharsets.US_ASCII);
        if (!"RIFF".equals(riff) || !"WAVE".equals(wave)) return null;
        int pos = 12;
        int sampleRate = 16000;
        int dataOffset = -1;
        int dataLength = -1;
        while (pos + 8 <= data.length) {
            String chunkId = new String(data, pos, 4, StandardCharsets.US_ASCII);
            int chunkSize = readIntLE(data, pos + 4);
            int nextPos = pos + 8 + chunkSize;
            if ("fmt ".equals(chunkId) && pos + 24 <= data.length) {
                sampleRate = readIntLE(data, pos + 12);
            } else if ("data".equals(chunkId)) {
                dataOffset = pos + 8;
                dataLength = Math.min(chunkSize, data.length - dataOffset);
                break;
            }
            if (chunkSize % 2 == 1) {
                nextPos += 1;
            }
            pos = nextPos;
        }
        if (dataOffset < 0 || dataLength <= 0) return null;
        return new WavInfo(sampleRate, dataOffset, dataLength);
    }

    private String extractTextFromResult(String json) {
        if (json == null || json.isEmpty()) return "";
        try {
            JSONObject obj = new JSONObject(json);
            return obj.optString("text", "");
        } catch (JSONException e) {
            return "";
        }
    }

    private void copyAssetFile(AssetManager assets, String assetPath, File destFile) throws IOException {
        if (destFile.exists()) return;
        File parent = destFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        try (InputStream input = assets.open(assetPath); OutputStream output = new FileOutputStream(destFile)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        }
    }

    private void copyAssetDir(AssetManager assets, String assetPath, File destDir) throws IOException {
        String[] entries = assets.list(assetPath);
        if (entries == null) {
            throw new IOException("No se encontro el modelo en assets: " + assetPath);
        }
        if (entries.length == 0) {
            copyAssetFile(assets, assetPath, destDir);
            return;
        }
        if (!destDir.exists() && !destDir.mkdirs()) {
            throw new IOException("No se pudo crear " + destDir.getAbsolutePath());
        }
        for (String entry : entries) {
            String childAsset = assetPath + "/" + entry;
            File childDest = new File(destDir, entry);
            String[] childEntries = assets.list(childAsset);
            if (childEntries != null && childEntries.length > 0) {
                copyAssetDir(assets, childAsset, childDest);
            } else {
                copyAssetFile(assets, childAsset, childDest);
            }
        }
    }

    private boolean assetDirExists(AssetManager assets, String assetPath) {
        try {
            String[] entries = assets.list(assetPath);
            return entries != null && entries.length > 0;
        } catch (IOException e) {
            return false;
        }
    }

    private String resolveDefaultModelName() {
        AssetManager assets = getContext().getAssets();
        if (assetDirExists(assets, PREFERRED_VOSK_MODEL)) {
            return PREFERRED_VOSK_MODEL;
        }
        return DEFAULT_VOSK_MODEL;
    }

    private boolean looksLikePath(String modelPath) {
        return modelPath.contains("/") || modelPath.startsWith("file://") || modelPath.startsWith("content://");
    }

    private File ensureBundledModel(String modelName) throws IOException {
        AssetManager assets = getContext().getAssets();
        if (!assetDirExists(assets, modelName)) {
            throw new IOException("No se encontro el modelo en assets: " + modelName);
        }
        File modelDir = new File(getContext().getFilesDir(), modelName);
        if (modelDir.exists() && modelDir.isDirectory()) {
            return modelDir;
        }
        copyAssetDir(assets, modelName, modelDir);
        return modelDir;
    }

    private File ensureModelDir(String modelPath) throws IOException {
        if (modelPath != null && !modelPath.isEmpty()) {
            if (looksLikePath(modelPath)) {
                File modelDir = new File(normalizePath(modelPath));
                if (!modelDir.exists()) {
                    throw new IOException("No se encontro el modelo en " + modelDir.getAbsolutePath());
                }
                return modelDir;
            }
            return ensureBundledModel(modelPath);
        }
        return ensureBundledModel(resolveDefaultModelName());
    }

    private Model getVoskModel(String modelPath) throws IOException {
        File modelDir = ensureModelDir(modelPath);
        String resolvedPath = modelDir.getAbsolutePath();
        synchronized (VOSK_LOCK) {
            if (voskModel != null && resolvedPath.equals(voskModelPath)) {
                return voskModel;
            }
        }
        Model model = new Model(resolvedPath);
        synchronized (VOSK_LOCK) {
            voskModel = model;
            voskModelPath = resolvedPath;
        }
        return model;
    }

    @PluginMethod
    public void transcribeAudio(PluginCall call) {
        String path = call.getString("path");
        String modelPath = call.getString("modelPath");
        Integer sampleRateOverride = call.getInt("sampleRate");
        if (path == null || path.isEmpty()) {
            call.reject("Falta el path del audio.");
            return;
        }

        getBridge().execute(() -> {
            Recognizer recognizer = null;
            try {
                Model model = getVoskModel(modelPath);
                byte[] audioBytes;
                try (InputStream input = openInputStream(path)) {
                    audioBytes = readAllBytes(input);
                }
                WavInfo wav = parseWav(audioBytes);
                int sampleRate = sampleRateOverride != null
                    ? sampleRateOverride
                    : (wav != null ? wav.sampleRate : 16000);
                int offset = wav != null ? wav.dataOffset : 0;
                int length = wav != null ? wav.dataLength : audioBytes.length;
                recognizer = new Recognizer(model, (float) sampleRate);
                int remaining = length;
                int position = offset;
                byte[] buffer = new byte[4096];
                while (remaining > 0) {
                    int chunk = Math.min(buffer.length, remaining);
                    System.arraycopy(audioBytes, position, buffer, 0, chunk);
                    recognizer.acceptWaveForm(buffer, chunk);
                    position += chunk;
                    remaining -= chunk;
                }
                String resultJson = recognizer.getFinalResult();
                String text = extractTextFromResult(resultJson);
                JSObject ret = new JSObject();
                ret.put("text", text);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error de transcripcion: " + e.getMessage());
            } finally {
                if (recognizer != null) {
                    recognizer.close();
                }
            }
        });
    }







    @PluginMethod
    public void restartApp(PluginCall call) {
        // Reinicia la app matando el proceso
        Process.killProcess(Process.myPid());

        Log.i("P4w4Plugin", ">#P4w4Plugin#> restartApp: Cerrando la App.");

        // No se llama a call.resolve(); porque la app se cierra
    }



    
}
