package app.catatuang.mobile;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;

public class NotificationService extends NotificationListenerService {
    private static final String TAG = "CatatUangNotif";
    public static final String PREFS_NAME = "catatuang_captured_notifs";
    public static final String KEY_NOTIFS = "pending_list";
    private static final long DEDUP_WINDOW_MS = 60000;
    private static final Object LOCK = new Object();

    private static boolean isAllowedPackage(String pkg) {
        if (pkg == null) return false;
        String p = pkg.toLowerCase();
        return p.contains("gojek") || p.contains("gopay")
                || p.contains("ovo")
                || p.contains("dana")
                || p.contains("shopee")
                || p.contains("bca")
                || p.contains("seabank")
                || p.contains("jago")
                || p.contains("mandiri")
                || p.contains("bri")
                || p.contains("bni")
                || p.contains("jenius")
                || p.contains("blu")
                || p.contains("linkaja")
                || p.contains("doku")
                || p.contains("sakuku")
                || p.contains("flip")
                || p.contains("midtrans")
                || p.contains("digibank")
                || p.contains("neobank")
                || p.contains("oy");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        String pkg = sbn.getPackageName();
        if (pkg == null) return;

        if (pkg.equals(getPackageName())) return;
        if (pkg.startsWith("android") || pkg.startsWith("com.android.systemui")) return;

        if (!isAllowedPackage(pkg)) return;

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence subTextCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

        String title = titleCs != null ? titleCs.toString() : "";
        String text = bigTextCs != null ? bigTextCs.toString() : (textCs != null ? textCs.toString() : "");
        String subText = subTextCs != null ? subTextCs.toString() : "";
        long postTime = sbn.getPostTime();

        if (title.isEmpty() && text.isEmpty()) return;

        String combined = (title + " " + text + " " + subText).toLowerCase();
        boolean looksLikeTransaction = combined.contains("rp") ||
                combined.contains("idr") ||
                combined.contains("berhasil") ||
                combined.contains("pembayaran") ||
                combined.contains("transfer") ||
                combined.contains("transaksi") ||
                combined.contains("debit") ||
                combined.contains("kredit") ||
                combined.contains("qris") ||
                combined.contains("sukses") ||
                combined.contains("top up") ||
                combined.contains("topup") ||
                combined.contains("bayar") ||
                combined.contains("tagihan");

        if (!looksLikeTransaction) return;

        if ((combined.contains("saldo") || combined.contains("available balance"))
                && !combined.contains("transfer")
                && !combined.contains("pembayaran")
                && !combined.contains("bayar")
                && !combined.contains("qris")) {
            return;
        }

        Log.d(TAG, "Notifikasi transaksi terdeteksi [" + pkg + "]: " + title + " | " + text);

        saveNotification(pkg, title, text, subText, postTime);
        NotificationPlugin.onNotificationCaptured(pkg, title, text, subText, postTime);
    }

    private void saveNotification(String pkg, String title, String text, String subText, long timestamp) {
        synchronized (LOCK) {
            try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String current = prefs.getString(KEY_NOTIFS, "[]");
            JSONArray arr = new JSONArray(current);
            for (int i = 0; i < arr.length(); i++) {
                try {
                    JSONObject o = arr.getJSONObject(i);
                    if (o.optString("pkg").equals(pkg) &&
                        o.optString("title").equals(title) &&
                        o.optString("text").equals(text)) {
                        long t = o.optLong("time", 0);
                        if (timestamp - t < DEDUP_WINDOW_MS) {
                            return;
                        }
                    }
                } catch (Exception ignored) {}
            }
            JSONObject obj = new JSONObject();
            obj.put("id", UUID.randomUUID().toString());
            obj.put("pkg", pkg);
            obj.put("title", title);
            obj.put("text", text);
            obj.put("subText", subText);
            obj.put("time", timestamp);
            arr.put(obj);

            while (arr.length() > 80) {
                arr.remove(0);
            }
            prefs.edit().putString(KEY_NOTIFS, arr.toString()).apply();
        }
        catch (Exception e) {
            Log.e(TAG, "Gagal menyimpan notifikasi ke SharedPreferences", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
    }
}
}