import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// FCM push: registers this device's token with the backend and reports notification taps.
///
/// Firebase needs `android/app/google-services.json` (Firebase console → Android app). Without
/// it [init] quietly turns push off and the rest of the app works as before.
class PushService {
  PushService._();
  static final instance = PushService._();

  bool _ready = false;
  StreamSubscription<String>? _refreshSub;

  final _taps = StreamController<Map<String, dynamic>>.broadcast();

  /// `data` of a notification the user tapped (app in background or launched from it).
  Stream<Map<String, dynamic>> get taps => _taps.stream;

  Future<void> init() async {
    try {
      await Firebase.initializeApp();
      _ready = true;
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _taps.add(m.data));
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _taps.add(initial.data);
    } catch (e) {
      debugPrint('Push disabled (Firebase not configured): $e');
    }
  }

  /// Call once signed in. Asks for the Android 13+ notification permission, then keeps the
  /// backend's copy of the token current. Never throws.
  Future<void> register(Dio dio, String deviceId) async {
    if (!_ready) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      Future<void> send(String? token) => dio.put<void>(
            '/notifications/token',
            data: {'deviceId': deviceId, 'fcmToken': token},
          );

      await send(await FirebaseMessaging.instance.getToken());
      await _refreshSub?.cancel();
      _refreshSub = FirebaseMessaging.instance.onTokenRefresh.listen((t) {
        send(t).catchError((Object e) => debugPrint('Push token refresh failed: $e'));
      });
    } catch (e) {
      debugPrint('Push registration failed: $e');
    }
  }

  /// Call before logout (while the session is still valid) so the phone stops getting pushes.
  Future<void> unregister(Dio dio, String deviceId) async {
    await _refreshSub?.cancel();
    _refreshSub = null;
    if (!_ready) return;
    try {
      await dio.put<void>('/notifications/token', data: {'deviceId': deviceId, 'fcmToken': null});
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('Push unregister failed: $e');
    }
  }
}
