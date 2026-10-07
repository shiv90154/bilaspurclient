import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';

/// Opens one of the public legal pages (privacy, terms, delete-account) in the browser.
Future<void> openLegalPage(BuildContext context, String path) async {
  final ok = await launchUrl(Uri.parse('$webUrl/$path'), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open the page.')));
  }
}
