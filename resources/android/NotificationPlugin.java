package app.catatuang.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "CatatUangNotification")
public class NotificationPlugin extends Plugin {
    private static NotificationPlugin instance;

    public static final String ACTION_NOTIF_CONFIRM = "app.catatuang.mobile.NOTIF_CONFIRM";
    public static final String ACTION_NOTIF_DISMISS = "app.catatuang.mobile.NOTIF_DISMISS";
    public static final String ACTION_SHORTCUT_CALLBACK = "app.catatuang.mobile.SHORTCUT_CALLBACK";
    public static final String EXTRA_NOTIF_ID = "notif_id";
    public static final String SHORTCUT_ID = "catatuang_quick_add";

    private static final String CHANNEL_ID = "catatuang_detected";
    private static final int WIDGET_HOST_ID = 0xCAFE01;

    @Override
    public void load() {
        super.load();
        instance = this;
        ensureNotificationChannel();
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "CatatUang Deteksi Transaksi", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Notifikasi konfirmasi transaksi yang terdeteksi dari bank/e-wallet");
            nm.createNotificationChannel(channel);
        } catch (Exception ignored) {}
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
    public void isBatteryExempted(PluginCall call) {
        try {
            Context ctx = getContext();
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            boolean exempted = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                exempted = pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            }
            JSObject ret = new JSObject();
            ret.put("exempted", exempted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal memeriksa pengecualian baterai: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal membuka pengaturan baterai: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isShortcutPinned(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("pinned", false);
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
                ShortcutManager sm = ctx.getSystemService(ShortcutManager.class);
                if (sm != null) {
                    List<ShortcutInfo> shortcuts = sm.getShortcuts();
                    for (ShortcutInfo si : shortcuts) {
                        if (SHORTCUT_ID.equals(si.getId())) {
                            ret.put("pinned", true);
                            break;
                        }
                    }
                }
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal memeriksa pintasan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pinShortcut(PluginCall call) {
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                call.reject("Pintasan layar utama memerlukan Android 8.0 atau yang lebih baru.");
                return;
            }
            ShortcutManager sm = ctx.getSystemService(ShortcutManager.class);
            if (sm == null) {
                call.reject("ShortcutManager tidak tersedia.");
                return;
            }
            boolean pinned = false;
            for (ShortcutInfo si : sm.getShortcuts()) {
                if (SHORTCUT_ID.equals(si.getId())) {
                    pinned = true;
                    break;
                }
            }
            if (pinned) {
                JSObject ret = new JSObject();
                ret.put("pinned", true);
                call.resolve(ret);
                return;
            }
            PackageManager pm = ctx.getPackageManager();
            Intent launch = pm.getLaunchIntentForPackage(ctx.getPackageName());
            if (launch == null) {
                launch = new Intent(Intent.ACTION_MAIN);
                launch.setPackage(ctx.getPackageName());
                launch.addCategory(Intent.CATEGORY_LAUNCHER);
            }
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            ShortcutInfo info = new ShortcutInfo.Builder(ctx, SHORTCUT_ID)
                    .setShortLabel("Tambah Transaksi")
                    .setLongLabel("Buka CatatUang dan tambah transaksi baru")
                    .setIcon(IconCompat.createWithResource(ctx, R.mipmap.ic_launcher))
                    .setIntent(launch)
                    .build();
            IntentSender callback = null;
            Intent cb = new Intent(ctx, NotificationActionReceiver.class);
            cb.setAction(ACTION_SHORTCUT_CALLBACK);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
            callback = PendingIntent.getBroadcast(ctx, 0, cb, flags).getIntentSender();
            sm.requestPinShortcut(info, callback);
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal memasang pintasan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void postDetectedConfirmation(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title");
        String amt = call.getString("amt");
        if (id == null) {
            call.reject("ID notifikasi diperlukan.");
            return;
        }
        try {
            Context ctx = getContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                call.reject("NotificationManager tidak tersedia.");
                return;
            }
            Intent confirm = new Intent(ctx, NotificationActionReceiver.class);
            confirm.setAction(ACTION_NOTIF_CONFIRM);
            confirm.putExtra(EXTRA_NOTIF_ID, id);
            Intent dismiss = new Intent(ctx, NotificationActionReceiver.class);
            dismiss.setAction(ACTION_NOTIF_DISMISS);
            dismiss.putExtra(EXTRA_NOTIF_ID, id);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent confirmPi = PendingIntent.getBroadcast(ctx, 0, confirm, flags);
            PendingIntent dismissPi = PendingIntent.getBroadcast(ctx, 1, dismiss, flags);
            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_catatuang)
                    .setContentTitle(title != null ? title : "Transaksi terdeteksi")
                    .setContentText(amt != null ? "Konfirmasi transaksi " + amt : "Konfirmasi atau abaikan transaksi ini")
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .addAction(R.drawable.ic_stat_catatuang, "Konfirmasi", confirmPi)
                    .addAction(R.drawable.ic_stat_catatuang, "Abaikan", dismissPi);
            nm.notify(Math.abs(id.hashCode()), builder.build());
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menampilkan notifikasi konfirmasi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void addWidget(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("added", false);
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
                AppWidgetHost host = new AppWidgetHost(ctx, WIDGET_HOST_ID);
                int appWidgetId = host.allocateAppWidgetId();
                boolean bound = mgr.bindAppWidgetIdIfAllowed(appWidgetId, new ComponentName(ctx, CatatUangAppWidget.class));
                ret.put("added", bound);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal menambahkan widget: " + e.getMessage());
        }
    }
}
