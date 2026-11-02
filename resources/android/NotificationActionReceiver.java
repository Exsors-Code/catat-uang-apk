package app.catatuang.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Menerima aksi tombol dari notifikasi konfirmasi deteksi (Konfirmasi / Abaikan)
 * dan mentransproseskannya sebagai event notificationReceived ke JavaScript,
 * sehingga app.js dapat memanggil confirmDetectedById / dismissDetectedById.
 * Memerlukan pengujian pada perangkat fisik (tidak dapat disimulasikan di sini).
 */
public class NotificationActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
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

        if (NotificationPlugin.ACTION_NOTIF_CONFIRM.equals(action)) {
            NotificationPlugin.dispatchAction(context, id, "confirm");
        } else if (NotificationPlugin.ACTION_NOTIF_DISMISS.equals(action)) {
            NotificationPlugin.dispatchAction(context, id, "dismiss");
        }
    }
}
