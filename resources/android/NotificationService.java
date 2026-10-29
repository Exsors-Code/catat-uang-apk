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
import java.util.HashSet;
import java.util.Set;

public class NotificationService extends NotificationListenerService {
    private static final String TAG = "CatatUangNotif";
    public static final String PREFS_NAME = "catatuang_captured_notifs";
    public static final String KEY_NOTIFS = "pending_list";
    public static final String KEY_IGNORED = "ignored_fingerprints";
    public static final String KEY_SAVED = "saved_fingerprints";

    private static final String[] WHITELIST = new String[] {
        "com.bca.mybca",
        "com.bca.mobile",
        "com.bri.brimo",
        "com.bni.mbnk",
        "com.bankmandiri.mandirionline",
        "id.co.bankbri.brimobile",
        "com.cimbniaga.mobile",
        "com.permata.mobile",
        "com.jago.digitalbanking",
        "co.id.bankbkemobile",
        "com.seabank.seabank",
        "com.neobank.bankjago",
        "com.jenius.jenius",
        "com.gojek.app",
        "com.gojek.gopay",
        "com.ovo.id",
        "id.dana",
        "com.shopee.id",
        "com.shopee.pay",
        "com.linkaja.android"
    };

    private static boolean isWhitelisted(String pkg) {
        if (pkg == null) return false;
        String p = pkg.toLowerCase();
        for (String w : WHITELIST) {
            if (p.equals(w)) return true;
        }
        if (p.contains("mybca")) return true;
        if (p.contains("brimo")) return true;
        if (p.contains("livin") || p.contains("mandiri")) return true;
        if (p.contains("bni")) return true;
        if (p.contains("jago")) return true;
        if (p.contains("jenius")) return true;
        if (p.contains("seabank")) return true;
        if (p.contains("gopay") || p.contains("gojek")) return true;
        if (p.equals("ovo.id") || p.contains(".ovo")) return true;
        if (p.equals("id.dana")) return true;
        if (p.contains("shopeepay") || p.contains("shopee.pay")) return true;
        return false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;
        String pkg = sbn.getPackageName();
        if (pkg == null) return;
        if (pkg.equals(getPackageName())) return;
        if (pkg.startsWith("android") || pkg.startsWith("com.android.systemui")) return;
        if (!isWhitelisted(pkg)) return;

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
        boolean looksLikeTransaction = combined.contains("rp") || combined.contains("idr") || combined.contains("berhasil") || combined.contains("pembayaran") || combined.contains("transfer") || combined.contains("transaksi") || combined.contains("debit") || combined.contains("kredit") || combined.contains("qris") || combined.contains("sukses") || combined.contains("top up") || combined.contains("topup") || combined.contains("bayar") || combined.contains("tagihan");
        if (!looksLikeTransaction) return;
        String fp = createFingerprint(pkg, combined, postTime);
        if (isDuplicate(fp)) return;
        saveNotification(pkg, title, text, subText, postTime, fp);
        NotificationPlugin.onNotificationCaptured(pkg, title, text, subText, postTime);
    }

    private String createFingerprint(String pkg, String combined, long postTime) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("rp\\s*([0-9][0-9.,]*)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(combined);
        String amt = "";
        if (m.find()) {
            amt = m.group(1).replaceAll("[^0-9]", "");
        }
        long minute = postTime / 60000L;
        String merchant = extractMerchant(combined);
        String base = (pkg == null ? "" : pkg.toLowerCase()) + "|" + amt + "|" + merchant + "|" + minute;
        return String.valueOf(base.hashCode());
    }

    private String extractMerchant(String combined) {
        String[] patterns = new String[] {"ke ", "di ", "dari ", "pada "};
        for (String p : patterns) {
            int idx = combined.indexOf(p);
            if (idx >= 0) {
                String rest = combined.substring(idx + p.length());
                String[] parts = rest.split("[.\\n\\r,;|]");
                if (parts.length > 0) {
                    return parts[0].trim().replaceAll("[^a-z0-9 ]", "").substring(0, Math.min(30, parts[0].trim().length()));
                }
            }
        }
        return "";
    }

    private synchronized boolean isDuplicate(String fp) {
        if (fp == null) return false;
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> saved = prefs.getStringSet(KEY_SAVED, new HashSet<String>());
            Set<String> ignored = prefs.getStringSet(KEY_IGNORED, new HashSet<String>());
            if (saved.contains(fp) || ignored.contains(fp)) return true;
        } catch (Exception e) {}
        return false;
    }

    private synchronized void saveNotification(String pkg, String title, String text, String subText, long timestamp, String fp) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String current = prefs.getString(KEY_NOTIFS, "[]");
            JSONArray arr = new JSONArray(current);
            JSONObject obj = new JSONObject();
            obj.put("id", fp + "_" + timestamp);
            obj.put("pkg", pkg);
            obj.put("title", title);
            obj.put("text", text);
            obj.put("subText", subText);
            obj.put("time", timestamp);
            obj.put("fp", fp);
            arr.put(obj);
            while (arr.length() > 80) {
                arr.remove(0);
            }
            prefs.edit().putString(KEY_NOTIFS, arr.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Gagal menyimpan notifikasi", e);
        }
    }

    public static void markSaved(Context ctx, String fp) {
        if (fp == null || ctx == null) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> saved = new HashSet<String>(prefs.getStringSet(KEY_SAVED, new HashSet<String>()));
            saved.add(fp);
            if (saved.size() > 200) {
                String[] arr = saved.toArray(new String[0]);
                Set<String> trimmed = new HashSet<String>();
                for (int i = Math.max(0, arr.length - 200); i < arr.length; i++) trimmed.add(arr[i]);
                saved = trimmed;
            }
            prefs.edit().putStringSet(KEY_SAVED, saved).apply();
        } catch (Exception ignored) {}
    }

    public static void markIgnored(Context ctx, String fp) {
        if (fp == null || ctx == null) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> ignored = new HashSet<String>(prefs.getStringSet(KEY_IGNORED, new HashSet<String>()));
            ignored.add(fp);
            if (ignored.size() > 200) {
                String[] arr = ignored.toArray(new String[0]);
                Set<String> trimmed = new HashSet<String>();
                for (int i = Math.max(0, arr.length - 200); i < arr.length; i++) trimmed.add(arr[i]);
                ignored = trimmed;
            }
            prefs.edit().putStringSet(KEY_IGNORED, ignored).apply();
        } catch (Exception ignored) {}
    }
}
