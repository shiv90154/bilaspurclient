import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../features/auth/auth_controller.dart';
import 'models.dart';

final contentApiProvider = Provider<ContentApi>((ref) => ContentApi(ref.watch(apiClientProvider).dio));

/// Every call maps Dio errors to [ApiException] so screens only handle one error type.
class ContentApi {
  ContentApi(this._dio);
  final Dio _dio;

  Future<T> _run<T>(Future<T> Function() call) async {
    try {
      return await call();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  // ── notes ──
  Future<List<Note>> notes() => _run(() async {
        final res = await _dio.get<Map<String, dynamic>>('/materials', queryParameters: {'limit': 100});
        return [for (final m in res.data!['items'] as List) Note.fromJson(m as Map<String, dynamic>)];
      });

  /// Downloads the PDF into memory only (never to shared storage) through a 3-minute signed link.
  Future<Uint8List> noteBytes(String id) => _run(() async {
        final link = await _dio.get<Map<String, dynamic>>('/materials/$id/view-url');
        final url = link.data!['url'] as String; // "/api/files/...": relative to the server origin
        final origin = Uri.parse(apiUrl).replace(path: '', query: '').toString();
        final res = await Dio().get<List<int>>(
          '$origin$url',
          options: Options(responseType: ResponseType.bytes, receiveTimeout: const Duration(minutes: 2)),
        );
        return Uint8List.fromList(res.data!);
      });

  // ── tests ──
  Future<List<TestSummary>> tests() => _run(() async {
        final res = await _dio.get<List<dynamic>>('/my/tests');
        return [for (final t in res.data!) TestSummary.fromJson(t as Map<String, dynamic>)];
      });

  Future<Paper> startTest(String testId) => _run(() async {
        final res = await _dio.post<Map<String, dynamic>>('/my/tests/$testId/start');
        return Paper.fromJson(res.data!);
      });

  Future<Paper> resumeAttempt(String attemptId) => _run(() async {
        final res = await _dio.get<Map<String, dynamic>>('/attempts/$attemptId');
        return Paper.fromJson(res.data!);
      });

  Future<void> saveAnswers(String attemptId, List<PaperQuestion> changed) => _run(() async {
        await _dio.put<void>('/attempts/$attemptId/answers', data: {
          'answers': [
            for (final q in changed)
              {'questionId': q.id, 'selectedOptionIds': q.selected.toList(), 'markedForReview': q.marked},
          ],
        });
      });

  Future<void> reportBackground(String attemptId) async {
    try {
      await _dio.post<void>('/attempts/$attemptId/background');
    } catch (_) {
      // Best effort: a failed anti-cheat ping must never disturb the student.
    }
  }

  Future<TestResult> submit(String attemptId) => _run(() async {
        final res = await _dio.post<Map<String, dynamic>>('/attempts/$attemptId/submit');
        return TestResult.fromJson(res.data!);
      });

  Future<TestResult> result(String attemptId) => _run(() async {
        final res = await _dio.get<Map<String, dynamic>>('/attempts/$attemptId/result');
        return TestResult.fromJson(res.data!);
      });

  // ── doubts ──
  Future<List<Doubt>> doubts() => _run(() async {
        final res = await _dio.get<Map<String, dynamic>>('/doubts', queryParameters: {'limit': 50});
        return [for (final d in res.data!['items'] as List) Doubt.fromJson(d as Map<String, dynamic>)];
      });

  Future<DoubtThread> doubt(String id) => _run(() async {
        final res = await _dio.get<Map<String, dynamic>>('/doubts/$id');
        return DoubtThread.fromJson(res.data!);
      });

  Future<void> askDoubt(String title, String text) => _run(() async {
        await _dio.post<void>('/doubts', data: {'title': title, 'text': text});
      });

  Future<void> reply(String id, String text) => _run(() async {
        await _dio.post<void>('/doubts/$id/messages', data: {'text': text});
      });

  Future<void> setResolved(String id, {required bool resolved}) => _run(() async {
        await _dio.post<void>('/doubts/$id/${resolved ? 'resolve' : 'reopen'}');
      });
}
