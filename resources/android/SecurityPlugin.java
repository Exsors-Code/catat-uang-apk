package app.catatuang.mobile;

import android.app.Activity;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "CatatUangSecurity")
public class SecurityPlugin extends Plugin {
    @PluginMethod
    public void isBiometricAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            call.reject("Biometrik memerlukan Android 9 atau yang lebih baru.");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Aktivitas Android tidak tersedia.");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                Executor executor = activity.getMainExecutor();
                BiometricPrompt prompt = new BiometricPrompt.Builder(activity)
                    .setTitle("Buka CatatUang")
                    .setSubtitle("Verifikasi identitas Anda")
                    .setNegativeButton("Gunakan PIN", executor, (dialog, which) -> call.reject("Dibatalkan"))
                    .build();
                prompt.authenticate(new CancellationSignal(), executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        call.resolve();
                    }
                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errorString) {
                        call.reject(errorString.toString());
                    }
                    @Override
                    public void onAuthenticationFailed() {
                        // Sistem Android membiarkan pengguna mencoba ulang pada dialog yang sama.
                    }
                });
            } catch (Exception e) {
                call.reject("Biometrik tidak tersedia: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setScreenProtection(PluginCall call) {
        final boolean enabled = call.getBoolean("enabled", true);
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Aktivitas Android tidak tersedia.");
            return;
        }
        activity.runOnUiThread(() -> {
            if (enabled) activity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
