import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/auth_controller.dart';
import 'config.dart';

/// Maintenance mode, switched by the admin in the panel's Settings.
/// State: null = open; otherwise the admin's note for the maintenance screen ('' = default text).
/// Checked at start and every time the app comes back to the front; any API call that answers
/// MAINTENANCE switches it on at once.
final maintenanceProvider = NotifierProvider<MaintenanceController, String?>(MaintenanceController.new);

class MaintenanceController extends Notifier<String?> {
  @override
  String? build() {
    Future.microtask(check);
    final lifecycle = AppLifecycleListener(onResume: () => unawaited(check()));
    ref.onDispose(lifecycle.dispose);
    return null;
  }

  /// Asks the server. A network error leaves the current state alone.
  Future<void> check() async {
    try {
      final res = await Dio(BaseOptions(
        baseUrl: apiUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
      )).get<Map<String, dynamic>>('/privacy/info');
      final on = res.data?['maintenanceMode'] == true;
      final wasOn = state != null;
      state = on ? (res.data?['maintenanceMessage'] as String? ?? '') : null;
      // Over: sign the student back in with the saved session (it failed during maintenance).
      if (wasOn && !on) ref.invalidate(authProvider);
    } catch (_) {}
  }

  /// An API call answered MAINTENANCE.
  void report(String message) => state = message;
}

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key, required this.message, required this.onRetry});
  final String message;
  final Future<void> Function() onRetry;

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  bool _checking = false;

  Future<void> _retry() async {
    setState(() => _checking = true);
    await widget.onRetry();
    if (mounted) setState(() => _checking = false);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.asset('assets/logo.png', width: 96, height: 96),
                ),
                const SizedBox(height: 26),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: scheme.secondaryContainer, borderRadius: BorderRadius.circular(18)),
                  child: Icon(Icons.construction, size: 34, color: scheme.onSecondaryContainer),
                ),
                const SizedBox(height: 18),
                Text("We'll be back soon",
                    textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                Text(
                  widget.message.isNotEmpty
                      ? widget.message
                      : 'We are doing some maintenance on the app. Please check back in a little while.',
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(height: 1.5),
                ),
                const SizedBox(height: 8),
                Text('Your account and progress are safe.', textAlign: TextAlign.center, style: text.bodySmall),
                const SizedBox(height: 26),
                FilledButton.icon(
                  onPressed: _checking ? null : _retry,
                  icon: _checking
                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.refresh),
                  label: const Text('Check again'),
                  style: FilledButton.styleFrom(minimumSize: const Size(200, 48)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
