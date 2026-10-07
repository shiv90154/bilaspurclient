import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:safe_device/safe_device.dart';

import 'config.dart';

/// Android content protection (docs/10-android-protection.md).
class Security {
  /// Screenshot / screen-recording protection (FLAG_SECURE) is applied natively in MainActivity.kt,
  /// before the first frame, for the whole app. Nothing to do from Dart.
  static Future<void> enableScreenProtection() async {}

  /// Returns a reason string when the device must be refused, or null if OK.
  /// Emulators are allowed in debug builds so development stays possible.
  static Future<String?> deviceProblem() async {
    try {
      if (await SafeDevice.isJailBroken) {
        return 'This device is rooted. For content safety the app cannot run on rooted devices.';
      }
      if (!kDebugMode && !await SafeDevice.isRealDevice) {
        return 'Emulators are not supported. Please use a real phone.';
      }
      // Developer options / USB debugging let tools record or inspect the screen and fake the
      // device. Debug builds skip this so development on a phone stays possible.
      final blockDev = !kDebugMode && await _blockDeveloperOptions();
      if (blockDev && await SafeDevice.isDevelopmentModeEnable) {
        return 'Developer options are turned on.\n\nTo use the app, open Settings → System → '
            'Developer options and switch it off, then tap "Check again".';
      }
      if (blockDev && await SafeDevice.isUsbDebuggingEnabled) {
        return 'USB debugging is turned on.\n\nTurn off USB debugging (and Developer options) in '
            'Settings, then tap "Check again".';
      }
    } catch (e) {
      // If the check itself fails we do not lock students out.
      debugPrint('Device check failed: $e');
    }
    return null;
  }

  /// The admin can switch the Developer options block off in Settings. If the server cannot be
  /// reached the block stays on (safer; the app needs the server anyway).
  static Future<bool> _blockDeveloperOptions() async {
    try {
      final res = await Dio(BaseOptions(baseUrl: apiUrl, connectTimeout: const Duration(seconds: 8), receiveTimeout: const Duration(seconds: 8)))
          .get<Map<String, dynamic>>('/privacy/info');
      return res.data?['blockDeveloperOptions'] != false;
    } catch (_) {
      return true;
    }
  }
}
