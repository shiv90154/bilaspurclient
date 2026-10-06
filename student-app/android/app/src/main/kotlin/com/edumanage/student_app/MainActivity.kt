package com.edumanage.student_app

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // FLAG_SECURE for the whole app, set before the first frame is drawn: blocks screenshots and
        // screen recording, and blanks the app in the recents screen (docs/10-android-protection.md).
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        super.onCreate(savedInstanceState)
    }
}
