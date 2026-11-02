package app.catatuang.mobile;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * Widget layar utama CatatUang. Pendaftaran dalam AndroidManifest melalui
 * scripts/patch-android.js. Penempatan widget ke layar utama dilakukan
 * pengguna melalui galeri widget sistem (bindAppWidgetIdIfAllowed hanya
 * berhasil jika widget telah pernah dipasang), sehingga memerlukan uji device.
 */
public class CatatUangAppWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            applyView(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        applyView(context, appWidgetManager, appWidgetId);
    }

    private static void applyView(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.catat_uang_widget);
        views.setTextViewText(R.id.widget_text, "CatatUang");
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
