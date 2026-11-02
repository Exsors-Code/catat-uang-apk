package app.catatuang.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;

/**
 * Menerima aksi tombol dari notifikasi konfirmasi deteksi (Konfirmasi / Abaikan)
 * dan mentransproseskannya sebagai event notificationReceived ke JavaScript,
 * sehingga app.js dapat memanggil confirmDetectedById / dismissDetectedById.
 * Memerlukan pengujian pada perangkat fisik (tidak dapat disimulasikan di sini).
 */
public class NotificationActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null || NotificationPlugin.instance == null) {
            return;
        }
        String action = intent.getAction();
        String id = intent.getStringExtra(NotificationPlugin.EXTRA_NOTIF_ID);

        if (NotificationPlugin.ACTION_SHORTCUT_CALLBACK.equals(action)) {
            // Hasil pemasangan pintasan tidak memerlukan aksi ke JavaScript.
            return;
        }

        if (id == null) {
            return;
        }

        try {
            JSObject ret = new JSObject();
            ret.put("id", id);
            if (NotificationPlugin.ACTION_NOTIF_CONFIRM.equals(action)) {
                ret.put("action", "confirm");
            } else if (NotificationPlugin.ACTION_NOTIF_DISMISS.equals(action)) {
                ret.put("action", "dismiss");
            } else {
                return;
            }
            NotificationPlugin.instance.notifyListeners("notificationReceived", ret);
        } catch (Exception ignored) {}
    }
}
