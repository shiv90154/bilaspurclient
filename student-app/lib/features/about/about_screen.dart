import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';

/// Founder profile, the same facts as the website's About page (from Dr. Pardeuman Singh, Oct 2026).
abstract final class Founder {
  static const name = 'Dr. Pardeuman Singh';
  static const degrees = 'BAMS, MS (Shalya Tantra)';
  static const role = 'Associate Professor, Shalya Tantra';
  static const photo = 'assets/founder-portrait.jpg';

  static const stats = [
    ('15+', 'Years of teaching'),
    ('400+', 'Students selected in AIAPGET & AMO'),
    ('6', 'AMO exams cleared (5 State + 1 Central)'),
    ('15+', 'Years in clinical surgery'),
  ];
  static const education = [
    ('MS, Shalya Tantra (Surgery)', null, 'Rajiv Gandhi Ayurvedic Medical College & Hospital, Paprola (H.P.)'),
    ('BAMS', '2011', 'Guru Nanak Ayurvedic Medical College & Hospital, Gopalpur, Ludhiana (Punjab)'),
  ];
  static const achievements = [
    'Cleared the State AMO exam all five times he appeared',
    'Cleared a central-level AMO exam',
    'Prepared students for AIAPGET (PG entrance) and AMO exams for 15 years',
    'About 400 students selected in AIAPGET and AMO exams',
  ];
  static const clinical =
      'For 15 years he has served in the Shalya Tantra (surgery) department, conducting a wide range of surgeries '
      'and giving patients relief. That daily clinical work is why his classes connect every concept to real patients.';

  static const links = [
    (Icons.call, 'Call', 'tel:+918091334667'),
    (Icons.chat, 'WhatsApp', 'https://wa.me/918091334667'),
    (Icons.smart_display, 'YouTube', 'https://youtube.com/@ayurveda-classroom'),
    (Icons.camera_alt, 'Instagram', 'https://www.instagram.com/pardeumansingh'),
    (Icons.facebook, 'Facebook', 'https://www.facebook.com/share/1AoyiXEE2W/'),
  ];
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('About DHĪ')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
        children: [
          _Hero(),
          const SizedBox(height: 18),
          Text(
            '${Founder.name} is an ${Founder.role} with an MS in Shalya Tantra from Paprola. For more than 15 years '
            'he has prepared students for AIAPGET and AMO exams; about 400 of them have been selected.\n\n'
            'He has cleared the State AMO exam all five times he sat it, and a central-level AMO exam as well, so he '
            'teaches from inside the exam, not from the outside.',
            style: text.bodyMedium?.copyWith(height: 1.55),
          ),
          const SizedBox(height: 18),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.55,
            children: [
              for (final (value, label) in Founder.stats)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(value,
                          style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppTheme.gold, height: 1)),
                      const SizedBox(height: 6),
                      Text(label, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(height: 1.25)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 22),
          _Block(
            icon: Icons.school,
            title: 'Education',
            children: [
              for (final (degree, year, place) in Founder.education)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(TextSpan(children: [
                        TextSpan(text: degree, style: const TextStyle(fontWeight: FontWeight.w700)),
                        if (year != null) TextSpan(text: '  $year', style: TextStyle(color: AppTheme.gold, fontSize: 12.5)),
                      ])),
                      const SizedBox(height: 2),
                      Text(place, style: text.bodySmall),
                    ],
                  ),
                ),
            ],
          ),
          _Block(
            icon: Icons.emoji_events,
            title: 'Achievements',
            children: [
              for (final a in Founder.achievements)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Icon(Icons.check_circle, size: 16, color: scheme.primary),
                      ),
                      const SizedBox(width: 8),
                      Expanded(child: Text(a, style: text.bodyMedium)),
                    ],
                  ),
                ),
            ],
          ),
          _Block(
            icon: Icons.medical_services,
            title: 'Clinical work',
            children: [Text(Founder.clinical, style: text.bodyMedium?.copyWith(height: 1.5))],
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: AppTheme.forest, borderRadius: BorderRadius.circular(18)),
            child: Column(
              children: [
                const Text('धी', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w700, color: AppTheme.gold, height: 1.1)),
                const SizedBox(height: 6),
                Text(
                  'Dhī is the Sanskrit word for intellect: the power to truly understand. '
                  'Concepts first, so they stay with you.',
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(color: Colors.white, height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text('Get in touch', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (icon, label, url) in Founder.links)
                ActionChip(
                  avatar: Icon(icon, size: 18, color: scheme.primary),
                  label: Text(label),
                  onPressed: () => _open(context, url),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static Future<void> _open(BuildContext context, String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open it on this phone.')));
    }
  }
}

class _Hero extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: AspectRatio(
        aspectRatio: 4 / 4.4,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(Founder.photo, fit: BoxFit.cover, alignment: const Alignment(0, -0.6)),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0.5, 1],
                  colors: [Colors.transparent, Color(0xE60D301C)],
                ),
              ),
            ),
            Positioned(
              left: 18,
              right: 18,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(color: AppTheme.gold, borderRadius: BorderRadius.circular(20)),
                    child: const Text('Meet your teacher',
                        style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 8),
                  Text(Founder.name,
                      style: text.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
                  Text('${Founder.degrees} · ${Founder.role}',
                      style: text.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.9))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.icon, required this.title, required this.children});
  final IconData icon;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, size: 18, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Home-screen card that opens the founder profile.
class MeetTeacherCard extends StatelessWidget {
  const MeetTeacherCard({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Material(
      color: AppTheme.forest,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            Image.asset(Founder.photo, width: 96, height: 112, fit: BoxFit.cover, alignment: const Alignment(0, -0.7)),
            const SizedBox(width: 14),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('MEET YOUR TEACHER',
                        style: text.labelSmall?.copyWith(color: AppTheme.gold, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                    const SizedBox(height: 4),
                    Text(Founder.name, style: text.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text('15+ years teaching · 400+ selections',
                        style: text.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.85))),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.chevron_right, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
