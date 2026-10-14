import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final _paymentsProvider = FutureProvider.autoDispose<List<FeePayment>>((ref) => ref.watch(contentApiProvider).myPayments());

final _rupees = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
String _money(double v) => v % 1 == 0 ? _rupees.format(v) : NumberFormat.currency(locale: 'en_IN', symbol: '₹').format(v);

/// Fees the student paid (online or at the office) with the receipt details. History only: fees
/// are paid on the website or at the office, never inside the app.
class FeePaymentsScreen extends ConsumerWidget {
  const FeePaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_paymentsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Fees paid')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_paymentsProvider.future),
        child: AsyncView(
          value: data,
          onRetry: () => ref.invalidate(_paymentsProvider),
          builder: (list) => list.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 80),
                  EmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'No payments yet',
                    text: 'Fees you pay online or at the institute office show up here with their receipt.',
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _PaymentTile(p: list[i]),
                ),
        ),
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.p});
  final FeePayment p;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (_) => _ReceiptSheet(p: p),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppTheme.forest.withValues(alpha: 0.1), shape: BoxShape.circle),
                child: Icon(p.refunded ? Icons.undo : Icons.receipt_long_outlined, color: AppTheme.forest),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.planName, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                    Text(
                      '${DateFormat('d MMM yyyy').format(p.paidAt)} · ${p.modeLabel}'
                      '${p.receiptNo != null ? ' · ${p.receiptNo}' : ''}',
                      style: text.bodySmall,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(_money(p.amount), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  if (p.refunded)
                    Text('Refunded', style: text.labelSmall?.copyWith(color: scheme.error, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReceiptSheet extends StatelessWidget {
  const _ReceiptSheet({required this.p});
  final FeePayment p;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final rows = <(String, String?)>[
      ('Receipt no.', p.receiptNo),
      ('Date', DateFormat('d MMM yyyy, h:mm a').format(p.paidAt)),
      ('Fee', p.planName),
      ('Course', p.course.isEmpty ? null : p.course),
      ('Paid by', p.modeLabel),
      ('Payment ID', p.paymentRef),
      ('Total fee', _money(p.total)),
      if (p.discount > 0) ('Discount', _money(p.discount)),
      ('Status', p.refunded ? 'Refunded' : 'Paid'),
    ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Receipt', style: text.titleLarge),
            const SizedBox(height: 12),
            Center(child: Text(_money(p.amount), style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800))),
            const SizedBox(height: 12),
            for (final (label, value) in rows)
              if (value != null && value.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 110, child: Text(label, style: text.bodySmall)),
                      Expanded(
                        child: GestureDetector(
                          onLongPress: () {
                            Clipboard.setData(ClipboardData(text: value));
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label copied')));
                          },
                          child: Text(value, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                ),
            const SizedBox(height: 12),
            Text('Need a printed receipt? Ask the institute office.',
                style: text.bodySmall),
          ],
        ),
      ),
    );
  }
}
