import 'package:flutter/foundation.dart';
import 'package:safe_device/safe_device.dart';

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
    } catch (e) {
      // If the check itself fails we do not lock students out.
      debugPrint('Device check failed: $e');
    }
    return null;
  }
}
