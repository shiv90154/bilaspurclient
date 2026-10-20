import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/config.dart';
import '../../core/theme.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final _idCardProvider = FutureProvider.autoDispose<IdCard>((ref) => ref.watch(contentApiProvider).idCard());

/// Digital student ID. The QR opens the website's check page, which says whether the card is
/// still valid (so a screenshot of an old card does not pass).
class IdCardScreen extends ConsumerWidget {
  const IdCardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final card = ref.watch(_idCardProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Student ID card')),
      body: AsyncView(
        value: card,
        onRetry: () => ref.invalidate(_idCardProvider),
        builder: (c) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _Card(c: c),
            const SizedBox(height: 16),
            Text(
              'Show this card at the institute. Anyone can scan the QR code to check that it is valid.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.c});
  final IdCard c;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final initial = c.name.trim().isEmpty ? '?' : c.name.trim()[0].toUpperCase();
    final date = DateFormat('d MMM yyyy');

    // Label above the value: next to the photo there is no room for both on one line, and a
    // phone or admission number split over two lines is hard to read.
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: text.bodySmall?.copyWith(color: Colors.black54)),
              Text(value, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
        );

    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [AppTheme.forest, AppTheme.forestDeep]),
            ),
            child: Column(
              children: [
                Text(c.instituteName,
                    style: text.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 1)),
                Text('STUDENT IDENTITY CARD',
                    style: text.labelSmall?.copyWith(color: const Color(0xFFE9C987), letterSpacing: 1.6)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 96,
                  height: 116,
                  decoration: BoxDecoration(
                    color: AppTheme.cream,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.gold, width: 2),
                    image: c.photoUrl == null
                        ? null
                        : DecorationImage(image: NetworkImage(c.photoUrl!), fit: BoxFit.cover),
                  ),
                  alignment: Alignment.center,
                  child: c.photoUrl == null
                      ? Text(initial, style: text.headlineLarge?.copyWith(color: AppTheme.forest, fontWeight: FontWeight.w800))
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.name, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      if (c.admissionNo != null) row('Adm. no', c.admissionNo!),
                      row('Phone', c.phone),
                      row('Joined', date.format(c.memberSince)),
                      if (c.validTill != null) row('Valid till', date.format(c.validTill!)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (c.courses.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: row('Course', c.courses.join('\n')),
            ),
          if (c.photoUrl == null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Text('Add your photo in Profile so it shows on the card.',
                  style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error)),
            ),
          const Divider(height: 24, indent: 20, endIndent: 20),
          Center(
            child: QrImageView(
              data: '$webUrl/verify/${c.verifyCode}',
              size: 150,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: AppTheme.forestDeep),
              dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: AppTheme.forestDeep),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Text(
              c.contactPhone == null ? 'Scan to verify' : 'Scan to verify · Office ${c.contactPhone}',
              textAlign: TextAlign.center,
              style: text.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
