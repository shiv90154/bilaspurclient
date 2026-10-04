import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/security.dart';
import 'features/auth/auth_controller.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

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
          return at == '/home' ? null : '/home';
      }
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const _Splash()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
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
      title: 'EduManage',
      theme: theme,
      routerConfig: ref.watch(routerProvider),
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
