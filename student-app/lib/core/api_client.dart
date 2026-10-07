import 'dart:async';

import 'package:dio/dio.dart';

import 'config.dart';
import 'secure_store.dart';

/// Error with the backend's machine readable `code` (see backend/src/common/errors.ts).
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.status});
  final String code;
  final String message;
  final int? status;

  @override
  String toString() => message;

  factory ApiException.from(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['code'] != null) {
        final msg = data['message'];
        return ApiException(
          data['code'] as String,
          friendlyMessage(
            data['code'] as String,
            msg is List ? msg.join(', ') : msg?.toString(),
          ),
          status: error.response?.statusCode,
        );
      }
      if (error.response == null) {
        return ApiException('NETWORK', 'Cannot reach the server. Check your internet.');
      }
      return ApiException('HTTP_${error.response!.statusCode}', 'Something went wrong. Try again.',
          status: error.response!.statusCode);
    }
    return ApiException('UNKNOWN', 'Something went wrong. Try again.');
  }
}

String friendlyMessage(String code, String? fallback) => switch (code) {
      'INVALID_CREDENTIALS' => 'Wrong phone/email or password.',
      'WRONG_PASSWORD' => 'Your current password is wrong.',
      'STAFF_USE_WEB' => 'This app is for students. Admins and teachers please use the web panel.',
      'DEMO_ACCOUNT' => 'This opens once the institute approves your admission.',
      'PASSWORD_UNCHANGED' => 'Choose a password different from the current one.',
      'ACCOUNT_LOCKED' => 'Too many wrong attempts. Try again after 15 minutes.',
      'ACCOUNT_DISABLED' => 'This account is disabled. Contact the institute.',
      'STUDENT_NOT_ACTIVE' => 'Your account is not active. Contact the institute (fees/approval pending).',
      'DEVICE_LIMIT_REACHED' => 'Too many device changes. Ask the institute to reset your device.',
      'DEVICE_BLOCKED' => 'This device is blocked. Contact the institute.',
      'SESSION_REPLACED' => 'You were logged out because you signed in on another device.',
      'SESSION_REVOKED' => 'Your session was ended. Please log in again.',
      'SESSION_EXPIRED' || 'INVALID_REFRESH_TOKEN' => 'Your session expired. Please log in again.',
      _ => fallback ?? 'Something went wrong. Try again.',
    };

/// Codes that mean "this login is dead, go to the login screen".
const _sessionDeadCodes = {
  'SESSION_REPLACED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'INVALID_TOKEN',
  'INVALID_REFRESH_TOKEN',
  'REFRESH_REUSE',
  'STUDENT_NOT_ACTIVE',
  'ACCOUNT_DISABLED',
};

/// Dio wrapper: adds the bearer token, refreshes it on TOKEN_EXPIRED and reports
/// dead sessions (e.g. SESSION_REPLACED after logging in on another device).
class ApiClient {
  ApiClient(this._store, {required this.onSessionLost})
      : dio = Dio(BaseOptions(
          baseUrl: apiUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'accept': 'application/json'},
        )) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final tokens = await _store.readTokens();
        if (tokens != null && options.extra['noAuth'] != true) {
          options.headers['authorization'] = 'Bearer ${tokens.access}';
        }
        handler.next(options);
      },
      onError: _onError,
    ));
  }

  final SecureStore _store;
  final void Function(String code) onSessionLost;
  final Dio dio;

  // Refresh tokens rotate and a replayed one revokes the whole session, so
  // concurrent 401s must share ONE refresh call.
  Future<bool>? _refreshing;

  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    final data = err.response?.data;
    final code = data is Map ? data['code'] as String? : null;
    final isAuthCall = err.requestOptions.extra['noAuth'] == true;

    if (err.response?.statusCode == 401 && !isAuthCall) {
      if (code == 'TOKEN_EXPIRED' && err.requestOptions.extra['retried'] != true) {
        final ok = await (_refreshing ??= _refresh().whenComplete(() => _refreshing = null));
        if (ok) {
          try {
            final opts = err.requestOptions..extra['retried'] = true;
            return handler.resolve(await dio.fetch(opts));
          } on DioException catch (e) {
            return handler.next(e);
          }
        }
        return handler.next(err); // _refresh already reported the lost session
      }
      if (code != null && _sessionDeadCodes.contains(code)) {
        await _store.clearTokens();
        onSessionLost(code);
      }
    }
    handler.next(err);
  }

  Future<bool> _refresh() async {
    final tokens = await _store.readTokens();
    if (tokens == null) {
      onSessionLost('SESSION_EXPIRED');
      return false;
    }
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': tokens.refresh},
        options: Options(extra: {'noAuth': true}),
      );
      await _store.writeTokens(
          Tokens(res.data!['accessToken'] as String, res.data!['refreshToken'] as String));
      return true;
    } on DioException catch (e) {
      if (e.response == null) return false; // offline: keep the session, fail this request
      final data = e.response?.data;
      final code = data is Map ? data['code'] as String? : null;
      await _store.clearTokens();
      onSessionLost(code ?? 'SESSION_EXPIRED');
      return false;
    }
  }
}
