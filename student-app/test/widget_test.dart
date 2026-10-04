import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/core/secure_store.dart';
import 'package:student_app/features/auth/auth_controller.dart';
import 'package:student_app/features/auth/login_screen.dart';
import 'package:student_app/widgets/watermark.dart';

class _EmptyStore extends SecureStore {
  @override
  Future<Tokens?> readTokens() async => null;
  @override
  Future<void> clearTokens() async {}
}

void main() {
  testWidgets('login screen validates empty input', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [secureStoreProvider.overrideWithValue(_EmptyStore())],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.tap(find.text('Log in'));
    await tester.pump();
    expect(find.text('Enter your phone or email'), findsOneWidget);
    expect(find.text('Password is at least 6 characters'), findsOneWidget);
  });

  testWidgets('watermark does not block taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Watermark(
          text: 'Demo · 9999999997',
          child: Scaffold(
            body: Center(
              child: ElevatedButton(onPressed: () => taps++, child: const Text('Tap')),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Tap'));
    expect(taps, 1);
  });
}
