package com.chirow.rootswing;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // never dim while playing
        WindowCompat.setDecorFitsSystemWindows(w, false);
        tuneWebView();
        goImmersive();
    }

    private void tuneWebView() {
        WebView wv = getBridge().getWebView();
        if (wv == null) return;
        wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setLongClickable(false);
        wv.setHapticFeedbackEnabled(false);
        wv.setOnLongClickListener(v -> true);
        wv.setBackgroundColor(0xFF1A1230);
        WebSettings s = wv.getSettings();
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
    }

    private void goImmersive() {
        Window w = getWindow();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
        if (c == null) return;
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goImmersive(); // re-hide bars after a swipe / dialog / app switch
    }

    @Override
    public void onResume() {
        super.onResume();
        goImmersive();
    }
}
