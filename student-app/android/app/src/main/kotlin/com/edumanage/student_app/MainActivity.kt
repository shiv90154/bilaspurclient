package com.edumanage.student_app

import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // FLAG_SECURE for the whole app, set before the first frame is drawn: blocks screenshots and
        // screen recording, and blanks the app in the recents screen (docs/10-android-protection.md).
        // Only a debuggable (developer) build skips it so the screens can be screenshotted during
        // development. Release builds are never debuggable, so students always get the protection.
        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (!debuggable) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            // Android 12+: other apps' floating windows (fake buttons, overlay recorders) are hidden
            // while DHĪ is on screen. Needs HIDE_OVERLAY_WINDOWS in the manifest.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) window.setHideOverlayWindows(true)
        }
        super.onCreate(savedInstanceState)
    }
}
