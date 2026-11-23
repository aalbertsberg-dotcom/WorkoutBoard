package com.workset.mobile;

import android.os.Build;
import android.view.autofill.AutofillManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Finalize the WebView's OS-owned autofill context after valid login;
 * no raw account credentials ever pass over this Capacitor plugin bridge. */
@CapacitorPlugin(name = "WorkSetAutofill")
public class WorkSetAutofillPlugin extends Plugin {
    @PluginMethod
    public void commitLogin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AutofillManager manager = getActivity().getSystemService(AutofillManager.class);
                    if (manager != null && manager.isEnabled()) manager.commit();
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to finalize Android autofill", error);
            }
        });
    }
}
