package com.sokinternet.speak;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.graphics.Color;
import android.view.Window;
import android.view.WindowManager;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

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

    private int getStatusBarHeight() {
        int result = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }
    
}
