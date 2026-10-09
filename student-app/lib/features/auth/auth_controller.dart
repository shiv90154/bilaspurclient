import 'dart:async';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/maintenance.dart';
import '../../core/push_service.dart';
import '../../core/secure_store.dart';

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.role,
    this.watermarkEnabled = false,
    this.consentRequired = false,
    this.demo = false,
    this.requestedCourse,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as String,
        name: j['name'] as String,
        phone: j['phone'] as String,
        email: j['email'] as String?,
        role: j['role'] as String,
        // The admin switches this in Settings. Older servers do not send it: treat as off.
        watermarkEnabled: (j['watermark'] as Map?)?['enabled'] == true,
        consentRequired: j['consentRequired'] == true,
        demo: j['demo'] == true,
        requestedCourse: (j['requestedCourse'] as Map?)?['name'] as String?,
      );

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String role;

  /// Show the name + phone overlay on every screen.
  final bool watermarkEnabled;

  /// The current terms + privacy policy are not accepted yet: the app shows the consent screen.
  final bool consentRequired;

  /// Registered in the app but not approved yet: only free demo notes/tests, no doubts.
  final bool demo;

  /// The course a demo student asked to join.
  final String? requestedCourse;
}

enum AuthStatus { loading, loggedOut, loggedIn }

class AuthState {
  const AuthState({required this.status, this.user, this.notice});
  final AuthStatus status;
  final AppUser? user;

  /// Shown on the login screen, e.g. "You were logged out because you signed in elsewhere".
  final String? notice;
}

final secureStoreProvider = Provider<SecureStore>((_) => SecureStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    ref.watch(secureStoreProvider),
    onSessionLost: (code) => ref.read(authProvider.notifier).sessionLost(code),
    onMaintenance: (message) => ref.read(maintenanceProvider.notifier).report(message),
  );
});

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(_restore);
    // Pick up admin changes (e.g. the watermark switch) when the app comes back to the front.
    final lifecycle = AppLifecycleListener(onResume: () => unawaited(refreshProfile()));
    ref.onDispose(lifecycle.dispose);
    return const AuthState(status: AuthStatus.loading);
  }

  /// Re-reads /auth/me quietly. A network error keeps the current profile; a dead session
  /// is handled by the API client (sessionLost).
  Future<void> refreshProfile() async {
    if (state.status != AuthStatus.loggedIn) return;
    try {
      final res = await _dio.get<Map<String, dynamic>>('/auth/me');
      if (state.status == AuthStatus.loggedIn) {
        state = AuthState(status: AuthStatus.loggedIn, user: AppUser.fromJson(res.data!));
      }
    } catch (_) {}
  }

  SecureStore get _store => ref.read(secureStoreProvider);
  Dio get _dio => ref.read(apiClientProvider).dio;

  Future<void> _restore() async {
    if (await _store.readTokens() == null) {
      state = const AuthState(status: AuthStatus.loggedOut);
      return;
    }
    try {
      final res = await _dio.get<Map<String, dynamic>>('/auth/me');
      final user = AppUser.fromJson(res.data!);
      // The app is for students; a staff session (from an older build) is dropped.
      if (user.role != 'STUDENT') {
        await logout();
        return;
      }
      state = AuthState(status: AuthStatus.loggedIn, user: user);
      unawaited(_registerPush());
    } catch (e) {
      // sessionLost() may already have set a notice; keep it.
      if (state.status != AuthStatus.loggedOut) {
        state = const AuthState(status: AuthStatus.loggedOut);
      }
    }
  }

  /// Throws [ApiException] with a user-friendly message on failure.
  Future<void> login(String identifier, String password) async {
    final deviceId = await _store.deviceId();
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {
          'identifier': identifier.trim(),
          'password': password,
          'deviceId': deviceId,
          'deviceName': await _deviceName(),
          'platform': 'ANDROID',
        },
        options: Options(extra: {'noAuth': true}),
      );
      final d = res.data!;
      await _store.writeTokens(Tokens(d['accessToken'] as String, d['refreshToken'] as String));
      state = AuthState(
        status: AuthStatus.loggedIn,
        user: AppUser.fromJson(d['user'] as Map<String, dynamic>),
      );
      unawaited(_registerPush());
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> _registerPush() async =>
      PushService.instance.register(_dio, await _store.deviceId());

  Future<void> logout() async {
    try {
      await PushService.instance.unregister(_dio, await _store.deviceId());
      await _dio.post<void>('/auth/logout');
    } catch (_) {
      // Even if the server is unreachable we still drop the local session.
    }
    await _store.clearTokens();
    state = const AuthState(status: AuthStatus.loggedOut);
  }

  void sessionLost(String code) {
    state = AuthState(
      status: AuthStatus.loggedOut,
      notice: friendlyMessage(code, null),
    );
  }

  Future<String> _deviceName() async {
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      return '${info.manufacturer} ${info.model}';
    } catch (_) {
      return 'Android device';
    }
  }
}
