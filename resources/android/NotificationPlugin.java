package app.catatuang.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

@CapacitorPlugin(name = "CatatUangNotification")
public class NotificationPlugin extends Plugin {
    private static NotificationPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void onNotificationCaptured(String pkg, String title, String text, String subText, long time) {
        if (instance != null) {
            try {
                JSObject ret = new JSObject();
                ret.put("pkg", pkg);
                ret.put("title", title);
                ret.put("text", text);
                ret.put("subText", subText);
                ret.put("time", time);
                instance.notifyListeners("notificationReceived", ret);
            } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void isPermissionGranted(PluginCall call) {
        try {
            Context ctx = getContext();
            Set<String> enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(ctx);
            boolean isGranted = enabledPackages != null && enabledPackages.contains(ctx.getPackageName());
            JSObject ret = new JSObject();
            ret.put("granted", isGranted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal memeriksa izin: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal membuka pengaturan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(NotificationService.PREFS_NAME, Context.MODE_PRIVATE);
            String current = prefs.getString(NotificationService.KEY_NOTIFS, "[]");
            JSONArray arr = new JSONArray(current);
            JSArray jsArray = new JSArray();
            for (int i = 0; i < arr.length(); i++) {
                jsArray.put(arr.getJSONObject(i));
            }
            JSObject ret = new JSObject();
            ret.put("notifications", jsArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membaca notifikasi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingNotifications(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(NotificationService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(NotificationService.KEY_NOTIFS, "[]").apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal membersihkan notifikasi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void removeNotification(PluginCall call) {
        String targetId = call.getString("id");
        if (targetId == null) {
            call.reject("ID notifikasi diperlukan.");
            return;
        }
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(NotificationService.PREFS_NAME, Context.MODE_PRIVATE);
            String current = prefs.getString(NotificationService.KEY_NOTIFS, "[]");
            JSONArray arr = new JSONArray(current);
            JSONArray updated = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                if (!targetId.equals(obj.optString("id"))) {
                    updated.put(obj);
                }
            }
            prefs.edit().putString(NotificationService.KEY_NOTIFS, updated.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menghapus notifikasi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void markSaved(PluginCall call) {
        String fp = call.getString("fp");
        try {
            NotificationService.markSaved(getContext(), fp);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menandai: " + e.getMessage());
        }
    }

    @PluginMethod
    public void markIgnored(PluginCall call) {
        String fp = call.getString("fp");
        try {
            NotificationService.markIgnored(getContext(), fp);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menandai: " + e.getMessage());
        }
    }
}
