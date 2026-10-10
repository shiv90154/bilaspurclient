import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';

/// A newer APK than the one installed, as published in the admin panel's Mobile App page.
class AppUpdate {
  const AppUpdate({required this.version, this.notes});
  final String version;
  final String? notes;
}

/// Asks the server for the newest release. Null when this app is up to date or the check fails
/// (offline, nothing uploaded yet): an update prompt must never get in the way.
Future<AppUpdate?> checkForUpdate() async {
  try {
    final res = await Dio(BaseOptions(
      baseUrl: apiUrl,
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
    )).get<Map<String, dynamic>>('/app-releases/latest');
    final latest = res.data?['version'] as String?;
    if (latest == null) return null;
    final installed = (await PackageInfo.fromPlatform()).version;
    if (!_isNewer(latest, installed)) return null;
    return AppUpdate(version: latest, notes: res.data?['notes'] as String?);
  } catch (_) {
    return null;
  }
}

/// "1.10.0" is newer than "1.9.2"; compares the numeric parts, ignoring any "-beta" suffix.
bool _isNewer(String a, String b) {
  List<int> parts(String v) => v.split(RegExp(r'[-+]')).first.split('.').map((p) => int.tryParse(p) ?? 0).toList();
  final x = parts(a), y = parts(b);
  for (var i = 0; i < 3; i++) {
    final p = i < x.length ? x[i] : 0, q = i < y.length ? y[i] : 0;
    if (p != q) return p > q;
  }
  return false;
}

/// The website's "Download app" page, which always serves the newest APK
/// (`api.example.com` -> `example.com`; local dev falls back to the API host).
Uri _downloadPage() {
  final api = Uri.parse(apiUrl);
  final host = api.host.startsWith('api.') ? api.host.substring(4) : api.host;
  final port = api.hasPort && api.port == 3000 ? 3001 : (api.hasPort ? api.port : null);
  return Uri(scheme: api.scheme, host: host, port: port, path: '/download');
}

/// Shows the "update available" dialog once; "Later" closes it until the next app start.
Future<void> showUpdateDialog(BuildContext context, AppUpdate update) {
  final notes = update.notes?.trim();
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Update available'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('DHĪ ${update.version} is ready. Update now to get the latest fixes and features.'),
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(notes, style: Theme.of(ctx).textTheme.bodySmall),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Later')),
        FilledButton(
          onPressed: () {
            launchUrl(_downloadPage(), mode: LaunchMode.externalApplication);
            Navigator.of(ctx).pop();
          },
          child: const Text('Update'),
        ),
      ],
    ),
  );
}
