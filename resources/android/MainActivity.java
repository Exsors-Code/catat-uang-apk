package app.catatuang.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationPlugin.class);
        registerPlugin(SecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
