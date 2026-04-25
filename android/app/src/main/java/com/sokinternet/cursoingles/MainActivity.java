package com.sokinternet.cursoingles;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.graphics.Color;
import android.view.Window;
import android.view.WindowManager;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.sokinternet.plugins.p4w4.P4w4PluginPlugin;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;


//import androidx.core.view.WindowCompat;
//import androidx.core.view.WindowInsetsControllerCompat;



public class MainActivity extends BridgeActivity {

    private void applyStatusBarIcons(Window window, boolean lightIcons) {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!lightIcons);
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            int flags = window.getDecorView().getSystemUiVisibility();
            if (lightIcons) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            window.getDecorView().setSystemUiVisibility(flags);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(Color.parseColor("#2d6df0"));
        window.getDecorView().setBackgroundColor(Color.parseColor("#2d6df0"));
        applyStatusBarIcons(window, true);
        Log.i(">#N00#> MainActivity", "set startup chrome bg=#2d6df0 lightIcons=true");



        // Esperamos un poco a que el WebView esté montado
        getWindow().getDecorView().postDelayed(() -> {
            View webView = this.bridge.getWebView();

            if (webView != null) {
                int offsetPx = getStatusBarHeight();
                ViewGroup.LayoutParams params = webView.getLayoutParams();

                if (params != null) {
                    int newHeight = webView.getHeight() - offsetPx;
                    webView.setTranslationY(offsetPx);
                    params.height = newHeight;
                    webView.setLayoutParams(params);
                    webView.requestLayout();

                    Log.i(">#N00#> MainActivity", "✅ WebView desplazado " + offsetPx + "px hacia abajo en onCreate()");
                } else {
                    Log.e(">#N00#> MainActivity", "❌ No se pudo acceder a LayoutParams del WebView");
                }
            } else {
                Log.e(">#N00#> MainActivity", "❌ WebView es null");
            }
        }, 50); // Delay leve para que el WebView esté creado
    }

    private void reapplyStoredChrome(String reason) {
        try {
            SharedPreferences prefs = getSharedPreferences(P4w4PluginPlugin.NATIVE_CHROME_PREFS, Context.MODE_PRIVATE);
            String backgroundColor = prefs.getString(P4w4PluginPlugin.PREF_BG, "");
            boolean lightIcons = prefs.getBoolean(P4w4PluginPlugin.PREF_LIGHT_ICONS, true);
            if (backgroundColor == null || backgroundColor.trim().isEmpty()) {
                Log.i(">#N00#> MainActivity", "reapplyStoredChrome skipped reason=" + reason + " (no stored chrome)");
                return;
            }
            Window window = getWindow();
            window.setStatusBarColor(Color.parseColor(backgroundColor));
            window.getDecorView().setBackgroundColor(Color.parseColor(backgroundColor));
            applyStatusBarIcons(window, lightIcons);
            Log.i(">#N00#> MainActivity", "reapplyStoredChrome reason=" + reason + " bg=" + backgroundColor + " lightIcons=" + lightIcons);
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "reapplyStoredChrome error reason=" + reason + " " + error.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().getDecorView().post(() -> reapplyStoredChrome("onResume"));
        getWindow().getDecorView().postDelayed(() -> reapplyStoredChrome("onResume+250"), 250);
        getWindow().getDecorView().postDelayed(() -> reapplyStoredChrome("onResume+900"), 900);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().post(() -> reapplyStoredChrome("onWindowFocusChanged"));
        }
    }

    private int getStatusBarHeight() {
        int result = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }
    
}
