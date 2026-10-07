import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../features/auth/auth_controller.dart';

final accountApiProvider = Provider<AccountApi>((ref) => AccountApi(ref.watch(apiClientProvider).dio));

typedef PublicCourse = ({String id, String name, String? description});

/// Sign-up and forgot password: public calls (no token), errors as [ApiException].
class AccountApi {
  AccountApi(this._dio);
  final Dio _dio;

  static final _public = Options(extra: {'noAuth': true});

  Future<T> _run<T>(Future<T> Function() call) async {
    try {
      return await call();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<List<PublicCourse>> courses() => _run(() async {
        final res = await _dio.get<List<dynamic>>('/account/courses', options: _public);
        return [
          for (final c in res.data!)
            (id: c['id'] as String, name: c['name'] as String, description: c['description'] as String?),
        ];
      });

  /// Emails a code; returns the masked address it went to.
  Future<String> registerStart({
    required String name,
    required String phone,
    required String email,
    required String password,
    required String courseId,
  }) =>
      _run(() async {
        final res = await _dio.post<Map<String, dynamic>>(
          '/account/register/start',
          data: {'name': name, 'phone': phone, 'email': email, 'password': password, 'courseId': courseId, 'via': 'APP'},
          options: _public,
        );
        return res.data!['email'] as String;
      });

  Future<void> registerResend(String email) =>
      _run(() => _dio.post<void>('/account/register/resend', data: {'email': email}, options: _public));

  Future<void> registerVerify(String email, String code) =>
      _run(() => _dio.post<void>('/account/register/verify', data: {'email': email, 'code': code}, options: _public));

  /// Returns the server's message ("If this account has an email ...").
  Future<String> forgot(String identifier) => _run(() async {
        final res = await _dio.post<Map<String, dynamic>>(
          '/account/password/forgot',
          data: {'identifier': identifier},
          options: _public,
        );
        return res.data!['message'] as String;
      });

  Future<void> reset(String identifier, String code, String newPassword) => _run(
        () => _dio.post<void>(
          '/account/password/reset',
          data: {'identifier': identifier, 'code': code, 'newPassword': newPassword},
          options: _public,
        ),
      );
}
