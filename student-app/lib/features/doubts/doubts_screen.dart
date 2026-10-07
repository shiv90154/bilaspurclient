import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';
import '../auth/auth_controller.dart';

final doubtsProvider = FutureProvider.autoDispose<List<Doubt>>((ref) => ref.watch(contentApiProvider).doubts());
final doubtThreadProvider =
    FutureProvider.autoDispose.family<DoubtThread, String>((ref, id) => ref.watch(contentApiProvider).doubt(id));

(String, Color) _statusLook(DoubtStatus s, ColorScheme c) => switch (s) {
      DoubtStatus.open => ('Waiting for a teacher', c.error),
      DoubtStatus.assigned => ('With a teacher', c.primary),
      DoubtStatus.answered => ('Answered', Colors.orange.shade800),
      DoubtStatus.resolved => ('Resolved', Colors.green.shade700),
    };

class DoubtsScreen extends ConsumerWidget {
  const DoubtsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(authProvider.select((s) => s.user?.demo ?? false))) {
      return Scaffold(
        appBar: AppBar(title: const Text('My doubts')),
        body: const EmptyState(
          icon: Icons.lock_clock,
          title: 'Opens after approval',
          text: 'You can ask your teachers doubts once the institute approves your admission.',
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('My doubts')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final asked = await showModalBottomSheet<bool>(
            context: context,
            isScrollControlled: true,
            builder: (_) => const _AskSheet(),
          );
          if (asked == true) ref.invalidate(doubtsProvider);
        },
        icon: const Icon(Icons.add),
        label: const Text('Ask a doubt'),
      ),
      body: AsyncView<List<Doubt>>(
        value: ref.watch(doubtsProvider),
        onRetry: () => ref.invalidate(doubtsProvider),
        builder: (doubts) {
          if (doubts.isEmpty) {
            return const EmptyState(
              icon: Icons.help_outline,
              title: 'No doubts yet',
              text: 'Stuck on something? Tap "Ask a doubt" and your teachers will reply here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(doubtsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
              itemCount: doubts.length,
              itemBuilder: (context, i) {
                final d = doubts[i];
                final (label, color) = _statusLook(d.status, Theme.of(context).colorScheme);
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    title: Text(d.title),
                    subtitle: Text('${d.subject ?? 'General'} · ${DateFormat('d MMM, h:mm a').format(d.updatedAt)}'),
                    trailing: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
                    onTap: () => context.push('/doubts/${d.id}'),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _AskSheet extends ConsumerStatefulWidget {
  const _AskSheet();

  @override
  ConsumerState<_AskSheet> createState() => _AskSheetState();
}

class _AskSheetState extends ConsumerState<_AskSheet> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _text = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _title.dispose();
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _sending = true);
    try {
      await ref.read(contentApiProvider).askDoubt(_title.text.trim(), _text.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        showError(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Ask a doubt', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            TextFormField(
              controller: _title,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Short title', border: OutlineInputBorder()),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a title' : null,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _text,
              maxLines: 5,
              maxLength: 4000,
              decoration: const InputDecoration(labelText: 'Describe your doubt', border: OutlineInputBorder()),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Describe your doubt' : null,
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _sending ? null : _send,
              child: Text(_sending ? 'Sending…' : 'Send'),
            ),
          ],
        ),
      ),
    );
  }
}

class DoubtThreadScreen extends ConsumerStatefulWidget {
  const DoubtThreadScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<DoubtThreadScreen> createState() => _DoubtThreadScreenState();
}

class _DoubtThreadScreenState extends ConsumerState<DoubtThreadScreen> {
  final _text = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _do(Future<void> Function() action, {bool clear = false}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (clear) _text.clear();
      ref.invalidate(doubtThreadProvider(widget.id));
      ref.invalidate(doubtsProvider);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(contentApiProvider);
    final thread = ref.watch(doubtThreadProvider(widget.id));
    final resolved = thread.value?.doubt.status == DoubtStatus.resolved;

    return Scaffold(
      appBar: AppBar(
        title: Text(thread.value?.doubt.title ?? 'Doubt', overflow: TextOverflow.ellipsis),
        actions: [
          if (thread.value != null)
            TextButton(
              onPressed: _busy ? null : () => _do(() => api.setResolved(widget.id, resolved: !resolved)),
              child: Text(resolved ? 'Reopen' : 'Mark resolved'),
            ),
        ],
      ),
      body: AsyncView<DoubtThread>(
        value: thread,
        onRetry: () => ref.invalidate(doubtThreadProvider(widget.id)),
        builder: (t) => Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final m in t.messages)
                    Align(
                      alignment: m.fromStudent ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: m.fromStudent
                              ? Theme.of(context).colorScheme.primaryContainer
                              : Theme.of(context).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.text),
                            const SizedBox(height: 4),
                            Text(
                              '${m.fromStudent ? 'You' : m.sender} · ${DateFormat('d MMM, h:mm a').format(m.at)}',
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (!resolved)
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _text,
                          minLines: 1,
                          maxLines: 4,
                          maxLength: 4000,
                          decoration: const InputDecoration(hintText: 'Add a follow-up…', counterText: '', border: OutlineInputBorder()),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        tooltip: 'Send',
                        onPressed: _busy
                            ? null
                            : () {
                                final text = _text.text.trim();
                                if (text.isNotEmpty) _do(() => api.reply(widget.id, text), clear: true);
                              },
                        icon: const Icon(Icons.send),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
