import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final _devicesProvider = FutureProvider.autoDispose<MyDevices>((ref) => ref.watch(contentApiProvider).myDevices());

/// Phones and browsers this account signed in from. Only one stays signed in at a time, and only a
/// few new ones are allowed a month, so students see why a new phone may be refused.
class DevicesScreen extends ConsumerWidget {
  const DevicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_devicesProvider);
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final when = DateFormat('d MMM yyyy, h:mm a');

    return Scaffold(
      appBar: AppBar(title: const Text('My devices')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_devicesProvider.future),
        child: AsyncView(
          value: data,
          onRetry: () => ref.invalidate(_devicesProvider),
          builder: (d) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Card(
                color: scheme.secondaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.phonelink_lock_outlined, color: scheme.onSecondaryContainer),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Your account works on one device at a time: signing in on a new one logs out the old one. '
                          'You can add ${d.remaining} more new device${d.remaining == 1 ? '' : 's'} this month '
                          '(limit ${d.limit} in 30 days).',
                          style: text.bodyMedium?.copyWith(color: scheme.onSecondaryContainer),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              for (final dev in d.devices)
                Card(
                  child: ListTile(
                    leading: Icon(
                      dev.platform == 'WEB' ? Icons.language : Icons.phone_android,
                      color: dev.blocked ? scheme.error : scheme.primary,
                    ),
                    title: Text(dev.name?.isNotEmpty == true ? dev.name! : (dev.platform == 'WEB' ? 'Web browser' : 'Android phone')),
                    subtitle: Text(
                      dev.blocked
                          ? 'Blocked by the institute'
                          : 'Last used ${when.format(dev.lastSeenAt)}\nFirst used ${DateFormat('d MMM yyyy').format(dev.firstSeenAt)}',
                    ),
                    isThreeLine: !dev.blocked,
                    trailing: dev.current
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.forest.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text('This device',
                                style: text.labelSmall?.copyWith(color: AppTheme.forest, fontWeight: FontWeight.w700)),
                          )
                        : null,
                  ),
                ),
              const SizedBox(height: 8),
              Text('Lost your phone or need more devices? Ask the institute office to reset your devices.',
                  style: text.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
