import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/security.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Security.enableScreenProtection();
  runApp(const ProviderScope(child: EduManageApp()));
}
