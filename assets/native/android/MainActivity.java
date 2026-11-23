package com.workset.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * WorkSet Android edge-to-edge system navigation clearance.
 * Keeps Capacitor's WebView full-size but supplies real navigation/system
 * gesture insets to CSS. The stylesheet moves interactive bottom tabs above
 * Android's system buttons. No change to the browser/PWA experience.
 */
public class MainActivity extends BridgeActivity {
    private int navBottomPx = 0;
    private int navLeftPx = 0;
    private int navRightPx = 0;

    @Override
    public void onCreate(Bundle state) {
        registerPlugin(WorkSetAutofillPlugin.class);
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && bridge != null && bridge.getWebView() != null)
            bridge.getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            if (Build.VERSION.SDK_INT >= 35) {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                Insets gestures = insets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures());
                navBottomPx = Math.max(bars.bottom, gestures.bottom);
                navLeftPx = Math.max(bars.left, gestures.left);
                navRightPx = Math.max(bars.right, gestures.right);
            } else {
                // Android <=14 normally fits the WebView above the nav bar.
                navBottomPx = navLeftPx = navRightPx = 0;
            }
            publishSafeInsets();
            return insets;
        });
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            ViewCompat.requestApplyInsets(getWindow().getDecorView());
            publishSafeInsets();
        }
    }

    private void publishSafeInsets() {
        if (bridge == null || bridge.getWebView() == null) return;
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;
        final String script = "(function(){var e=document.documentElement;if(!e)return;"
            + "e.style.setProperty('--workset-native-bottom-inset','" + (navBottomPx / density) + "px');"
            + "e.style.setProperty('--workset-native-left-inset','" + (navLeftPx / density) + "px');"
            + "e.style.setProperty('--workset-native-right-inset','" + (navRightPx / density) + "px');"
            + "})()";
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(script, null));
        // Insets can arrive before the initial WebView HTML. Retry once after
        // load to ensure a correct inset even on cold start and screen unlock.
        bridge.getWebView().postDelayed(() -> bridge.getWebView().evaluateJavascript(script, null), 900);
    }
}
