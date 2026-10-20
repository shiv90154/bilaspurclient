import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/api_client.dart';
import 'core/maintenance.dart';
import 'core/push_service.dart';
import 'core/security.dart';
import 'core/theme.dart';
import 'data/content_api.dart';
import 'data/models.dart';
import 'features/about/about_screen.dart';
import 'features/auth/auth_controller.dart';
import 'features/auth/consent_screen.dart';
import 'features/auth/forgot_password_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/classes/classes_screen.dart';
import 'features/courses/courses_screen.dart';
import 'features/doubts/doubts_screen.dart';
import 'features/home/home_screen.dart';
import 'features/notes/note_viewer_screen.dart';
import 'features/notes/notes_screen.dart';
import 'features/profile/devices_screen.dart';
import 'features/profile/documents_screen.dart';
import 'features/profile/fee_payments_screen.dart';
import 'features/profile/id_card_screen.dart';
import 'features/profile/notification_settings_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/search/search_screen.dart';
import 'features/shell/main_shell.dart';
import 'features/tests/result_screen.dart';
import 'features/tests/take_test_screen.dart';
import 'features/tests/tests_screen.dart';
import 'features/videos/video_player_screen.dart';
import 'features/videos/videos_screen.dart';
import 'widgets/async_view.dart';
import 'widgets/watermark.dart';

/// Null = device OK, otherwise the reason it is refused.
/// Checked again every time the app comes back to the front (e.g. after turning on Developer options).
final deviceProblemProvider = FutureProvider<String?>((ref) {
  final lifecycle = AppLifecycleListener(onResume: ref.invalidateSelf);
  ref.onDispose(lifecycle.dispose);
  return Security.deviceProblem();
});

final routerProvider = Provider<GoRouter>((ref) {
  // Re-evaluate redirects when the login state or the consent requirement changes. Not on every
  // profile refresh (each time the app comes back to the front): a refresh re-parses the open
  // route, and screens opened with `extra` (video, note, test) used to lose it and go grey.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider.select((s) => (s.status, s.user?.consentRequired)), (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final router = _buildRouter(ref, refresh);
  // Tapping a push opens what it is about: a doubt reply opens that thread, a class reminder /
  // reschedule / cancel opens the classes list, a checked test opens its result, a reviewed
  // document opens the documents list.
  final tapSub = PushService.instance.taps.listen((data) {
    if (ref.read(authProvider).status != AuthStatus.loggedIn) return;
    final doubtId = data['doubtId'];
    final type = data['type'];
    router.go('/home');
    if (type == 'doubt_reply' && doubtId is String) {
      router.push('/doubts/$doubtId');
    } else if (type is String && type.startsWith('class_')) {
      router.push('/classes');
    } else if (type == 'video_ready') {
      router.push('/videos');
    } else if (type == 'test_result' && data['attemptId'] is String) {
      router.go('/tests/result/${data['attemptId']}');
    } else if (type == 'document_review') {
      router.push('/profile/documents');
    }
  });
  ref.onDispose(tapSub.cancel);
  return router;
});

/// Screens that work without being logged in.
const _publicScreens = {'/login', '/register', '/forgot', '/about'};

GoRouter _buildRouter(Ref ref, ValueNotifier<int> refresh) {
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
          return _publicScreens.contains(at) ? null : '/login';
        case AuthStatus.loggedIn:
          // Nothing opens until the current terms are accepted (DPDP Act, Play Store).
          if (ref.read(authProvider).user?.consentRequired ?? false) {
            return at == '/consent' ? null : '/consent';
          }
          // Any in-app screen is fine; only the splash, login and consent are off limits once signed in.
          return at == '/' || at == '/consent' || (_publicScreens.contains(at) && at != '/about') ? '/home' : null;
      }
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const _Splash()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/consent', builder: (_, _) => const ConsentScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/forgot', builder: (_, _) => const ForgotPasswordScreen()),
      // The five main tabs share one bottom bar. Everything below the shell is full screen.
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MainShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/notes', builder: (_, _) => const NotesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/tests', builder: (_, _) => const TestsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/doubts', builder: (_, _) => const DoubtsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      GoRoute(
        path: '/notes/:id',
        builder: (_, state) => _OpenById<Note>(
          initial: state.extra as Note?,
          load: (ref) async => _byId<Note>(await ref.read(contentApiProvider).notes(), state.pathParameters['id']!, (n) => n.id),
          builder: (note) => NoteViewerScreen(note: note),
        ),
      ),
      GoRoute(
        path: '/tests/take/:attemptId',
        builder: (_, state) => _OpenById<Paper>(
          initial: state.extra as Paper?,
          load: (ref) => ref.read(contentApiProvider).resumeAttempt(state.pathParameters['attemptId']!),
          builder: (paper) => TakeTestScreen(paper: paper),
        ),
      ),
      GoRoute(
        path: '/tests/result/:attemptId',
        builder: (_, state) => ResultScreen(attemptId: state.pathParameters['attemptId']!),
      ),
      GoRoute(
        path: '/doubts/:id',
        builder: (_, state) => DoubtThreadScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(path: '/classes', builder: (_, _) => const ClassesScreen()),
      GoRoute(path: '/videos', builder: (_, _) => const VideosScreen()),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
      GoRoute(
        path: '/videos/:id',
        builder: (_, state) => _OpenById<VideoItem>(
          initial: state.extra as VideoItem?,
          load: (ref) async => _byId<VideoItem>(await ref.read(contentApiProvider).videos(), state.pathParameters['id']!, (v) => v.id),
          builder: (video) => VideoPlayerScreen(video: video),
        ),
      ),
      GoRoute(path: '/courses', builder: (_, _) => const CoursesScreen()),
      GoRoute(
        path: '/courses/:id',
        builder: (_, state) => CourseDetailScreen(id: state.pathParameters['id']!, initial: state.extra as CatalogCourse?),
      ),
      GoRoute(path: '/about', builder: (_, _) => const AboutScreen()),
      GoRoute(path: '/profile/id-card', builder: (_, _) => const IdCardScreen()),
      GoRoute(path: '/profile/documents', builder: (_, _) => const DocumentsScreen()),
      GoRoute(path: '/profile/fees', builder: (_, _) => const FeePaymentsScreen()),
      GoRoute(path: '/profile/notifications', builder: (_, _) => const NotificationSettingsScreen()),
      GoRoute(path: '/profile/devices', builder: (_, _) => const DevicesScreen()),
    ],
  );
}

class EduManageApp extends ConsumerWidget {
  const EduManageApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = AppTheme.light();

    final problem = ref.watch(deviceProblemProvider).value;
    if (problem != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: _Blocked(reason: problem, onRetry: () => ref.invalidate(deviceProblemProvider)),
      );
    }
    final maintenance = ref.watch(maintenanceProvider);
    if (maintenance != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'DHĪ',
        theme: theme,
        home: MaintenanceScreen(message: maintenance, onRetry: ref.read(maintenanceProvider.notifier).check),
      );
    }
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'DHĪ',
      theme: theme,
      routerConfig: ref.watch(routerProvider),
      // One watermark over every screen once signed in (notes, tests, doubts, ...), so no screen
      // can forget it. Student name + phone make a leaked photo traceable. The admin turns it
      // on or off in the panel's Settings (off by default).
      builder: (context, child) => Consumer(
        builder: (context, ref, _) {
          final user = ref.watch(authProvider.select((s) => s.user));
          final content = child ?? const SizedBox.shrink();
          return user == null || !user.watermarkEnabled
              ? content
              : Watermark(text: '${user.name} · ${user.phone}', child: content);
        },
      ),
    );
  }
}

T _byId<T>(List<T> items, String id, String Function(T) idOf) {
  for (final item in items) {
    if (idOf(item) == id) return item;
  }
  throw ApiException('NOT_FOUND', 'This is no longer available.');
}

/// A screen that needs an object (video, note, test paper). It normally comes along with the
/// navigation (`extra`); when it does not (the route was rebuilt or restored without it), it is
/// loaded by id instead of crashing into a grey screen. Once shown, the screen keeps its object,
/// so a later rebuild without `extra` never restarts a video or a test.
class _OpenById<T extends Object> extends ConsumerStatefulWidget {
  const _OpenById({required this.initial, required this.load, required this.builder, super.key});
  final T? initial;
  final Future<T> Function(WidgetRef ref) load;
  final Widget Function(T value) builder;

  @override
  ConsumerState<_OpenById<T>> createState() => _OpenByIdState<T>();
}

class _OpenByIdState<T extends Object> extends ConsumerState<_OpenById<T>> {
  late T? _value = widget.initial;
  Future<T>? _loading;

  @override
  void didUpdateWidget(_OpenById<T> old) {
    super.didUpdateWidget(old);
    if (widget.initial != null) _value = widget.initial;
  }

  @override
  Widget build(BuildContext context) {
    final value = _value;
    if (value != null) return widget.builder(value);
    final loading = _loading ??= widget.load(ref).then((v) {
      if (mounted) setState(() => _value = v);
      return v;
    });
    return FutureBuilder<T>(
      future: loading,
      builder: (context, snap) => Scaffold(
        appBar: AppBar(),
        body: snap.hasError
            ? ErrorRetry(message: snap.error.toString(), onRetry: () => setState(() => _loading = null))
            : const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset('assets/logo.png', width: 150),
              const SizedBox(height: 20),
              const CircularProgressIndicator(),
            ],
          ),
        ),
      );
}

class _Blocked extends StatelessWidget {
  const _Blocked({required this.reason, required this.onRetry});
  final String reason;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.gpp_bad_outlined, size: 56, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 16),
              Text('This phone is not safe for DHĪ', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              Text(reason, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Check again')),
            ],
          ),
        ),
      ),
    );
  }
}
