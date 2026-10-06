import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/security.dart';
import 'data/models.dart';
import 'features/auth/auth_controller.dart';
import 'features/auth/login_screen.dart';
import 'features/doubts/doubts_screen.dart';
import 'features/home/home_screen.dart';
import 'features/notes/note_viewer_screen.dart';
import 'features/notes/notes_screen.dart';
import 'features/tests/result_screen.dart';
import 'features/tests/take_test_screen.dart';
import 'features/tests/tests_screen.dart';
import 'widgets/watermark.dart';

/// Null = device OK, otherwise the reason it is refused.
final deviceProblemProvider = FutureProvider<String?>((_) => Security.deviceProblem());

final routerProvider = Provider<GoRouter>((ref) {
  // Re-evaluate redirects whenever login state changes.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authProvider).status;
      final at = state.matchedLocation;
      switch (status) {
        case AuthStatus.loading:
          return at == '/' ? null : '/';
        case AuthStatus.loggedOut:
          return at == '/login' ? null : '/login';
        case AuthStatus.loggedIn:
          // Any in-app screen is fine; only the splash and login are off limits once signed in.
          return at == '/' || at == '/login' ? '/home' : null;
      }
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const _Splash()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/notes', builder: (_, _) => const NotesScreen()),
      GoRoute(
        path: '/notes/:id',
        builder: (_, state) => NoteViewerScreen(note: state.extra! as Note),
      ),
      GoRoute(path: '/tests', builder: (_, _) => const TestsScreen()),
      GoRoute(
        path: '/tests/take',
        builder: (_, state) => TakeTestScreen(paper: state.extra! as Paper),
      ),
      GoRoute(
        path: '/tests/result/:attemptId',
        builder: (_, state) => ResultScreen(attemptId: state.pathParameters['attemptId']!),
      ),
      GoRoute(path: '/doubts', builder: (_, _) => const DoubtsScreen()),
      GoRoute(
        path: '/doubts/:id',
        builder: (_, state) => DoubtThreadScreen(id: state.pathParameters['id']!),
      ),
    ],
  );
});

class EduManageApp extends ConsumerWidget {
  const EduManageApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const primary = Color(0xFF3949AB);
    final theme = ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: primary),
      scaffoldBackgroundColor: const Color(0xFFF6F5F2),
      useMaterial3: true,
    );

    final problem = ref.watch(deviceProblemProvider).value;
    if (problem != null) {
      return MaterialApp(theme: theme, home: _Blocked(reason: problem));
    }
    return MaterialApp.router(
      title: 'DHĪ',
      theme: theme,
      routerConfig: ref.watch(routerProvider),
      // One watermark over every screen once signed in (notes, tests, doubts, ...), so no screen
      // can forget it. Student name + phone make a leaked photo traceable.
      builder: (context, child) => Consumer(
        builder: (context, ref, _) {
          final user = ref.watch(authProvider.select((s) => s.user));
          final content = child ?? const SizedBox.shrink();
          return user == null ? content : Watermark(text: '${user.name} · ${user.phone}', child: content);
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class _Blocked extends StatelessWidget {
  const _Blocked({required this.reason});
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.gpp_bad_outlined, size: 56),
              const SizedBox(height: 16),
              Text(reason, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
