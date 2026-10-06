import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/models.dart';
import '../auth/auth_controller.dart';
import '../doubts/doubts_screen.dart';
import '../tests/tests_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(testsProvider);
    ref.invalidate(doubtsProvider);
    try {
      await Future.wait([ref.read(testsProvider.future), ref.read(doubtsProvider.future)]);
    } catch (_) {
      // Each tab shows its own error with a retry; Home just stays quiet.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider.select((s) => s.user))!;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final liveTests = (ref.watch(testsProvider).value ?? const <TestSummary>[])
        .where((t) => t.state == TestState.open || t.state == TestState.inProgress)
        .take(3)
        .toList();
    final doubts = ref.watch(doubtsProvider).value ?? const <Doubt>[];
    final replied = doubts.where((d) => d.status == DoubtStatus.answered).length;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.asset('assets/logo.png', width: 56, height: 56),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Welcome back,', style: text.bodyMedium),
                        Text(user.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: scheme.primary)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: _QuickTile(
                      icon: Icons.menu_book,
                      label: 'Study\nmaterial',
                      background: scheme.primaryContainer,
                      foreground: scheme.onPrimaryContainer,
                      onTap: () => context.go('/notes'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickTile(
                      icon: Icons.quiz,
                      label: 'Tests',
                      background: scheme.tertiaryContainer,
                      foreground: scheme.onTertiaryContainer,
                      onTap: () => context.go('/tests'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickTile(
                      icon: Icons.help,
                      label: 'Ask a\ndoubt',
                      background: scheme.secondaryContainer,
                      foreground: scheme.onSecondaryContainer,
                      onTap: () => context.go('/doubts'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              _SectionTitle('Tests for you', actionLabel: 'See all', onAction: () => context.go('/tests')),
              if (liveTests.isEmpty)
                const _InfoCard(icon: Icons.event_available_outlined, text: 'No test is open right now.')
              else
                for (final t in liveTests)
                  Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: scheme.tertiaryContainer,
                        foregroundColor: scheme.onTertiaryContainer,
                        child: const Icon(Icons.quiz_outlined),
                      ),
                      title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(_testLine(t)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.go('/tests'),
                    ),
                  ),
              const SizedBox(height: 16),
              _SectionTitle('Your doubts', actionLabel: 'Open', onAction: () => context.go('/doubts')),
              _InfoCard(
                icon: replied > 0 ? Icons.mark_chat_unread_outlined : Icons.forum_outlined,
                text: replied > 0
                    ? '$replied of your doubts ${replied == 1 ? 'has' : 'have'} a reply from a teacher.'
                    : doubts.isEmpty
                        ? 'Stuck on something? Ask your teachers a doubt.'
                        : 'No new replies right now.',
                onTap: () => context.go('/doubts'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _testLine(TestSummary t) {
    if (t.state == TestState.inProgress) return 'In progress · tap to resume';
    final end = t.endAt;
    final when = end == null ? 'Open now' : 'Open until ${DateFormat('d MMM, h:mm a').format(end)}';
    return '${t.durationMin} min · $when';
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 30, color: foreground),
              const SizedBox(height: 14),
              Text(label,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700, color: foreground, height: 1.2)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {required this.actionLabel, required this.onAction});
  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),
          TextButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.text, this.onTap});
  final IconData icon;
  final String text;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(text),
        onTap: onTap,
      ),
    );
  }
}
