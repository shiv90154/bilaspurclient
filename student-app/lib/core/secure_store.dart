import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Tokens {
  const Tokens(this.access, this.refresh);
  final String access;
  final String refresh;
}

/// Tokens and the device id live in the Android Keystore-backed secure storage.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;
  static const _kAccess = 'access_token';
  static const _kRefresh = 'refresh_token';
  static const _kDevice = 'device_id';

  Future<Tokens?> readTokens() async {
    final access = await _s.read(key: _kAccess);
    final refresh = await _s.read(key: _kRefresh);
    if (access == null || refresh == null) return null;
    return Tokens(access, refresh);
  }

  Future<void> writeTokens(Tokens t) async {
    await _s.write(key: _kAccess, value: t.access);
    await _s.write(key: _kRefresh, value: t.refresh);
  }

  Future<void> clearTokens() async {
    await _s.delete(key: _kAccess);
    await _s.delete(key: _kRefresh);
  }

  /// Random id generated once per install; the backend binds the student to it.
  Future<String> deviceId() async {
    final existing = await _s.read(key: _kDevice);
    if (existing != null) return existing;
    final rnd = Random.secure();
    final id = List.generate(16, (_) => rnd.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    await _s.write(key: _kDevice, value: id);
    return id;
  }
}
