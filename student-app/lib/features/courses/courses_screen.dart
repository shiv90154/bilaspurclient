import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

/// Every open course of the institute, so students see what else is taught.
///
/// Play payments policy: the app sells nothing. No price, offer, "buy" button or link/WhatsApp
/// that leads to paying may appear on these screens. A course the student is not in only says so.
final catalogProvider = FutureProvider<List<CatalogCourse>>((ref) => ref.watch(contentApiProvider).catalog());

const _otherCategory = 'Other courses';

String _categoryOf(CatalogCourse c) => (c.category ?? '').trim().isEmpty ? _otherCategory : c.category!.trim();

/// Card colours, picked per course so the same course always looks the same.
const _covers = [
  [AppTheme.forest, Color(0xFF2F6B40)],
  [Color(0xFF2D6A68), Color(0xFF3F8C88)],
  [Color(0xFF8A6420), AppTheme.gold],
  [AppTheme.forestDeep, Color(0xFF285A3A)],
];

List<Color> _coverOf(CatalogCourse c) => _covers[c.id.codeUnits.fold<int>(0, (a, b) => a + b) % _covers.length];

String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

/// "6 subjects · 112 topics", or what else the course has when the syllabus is empty.
String _summary(CatalogCourse c) {
  final parts = <String>[
    if (c.subjectCount > 0) _plural(c.subjectCount, 'subject'),
    if (c.topicCount > 0) _plural(c.topicCount, 'topic'),
    if (c.subjectCount == 0 && c.tests > 0) _plural(c.tests, 'test'),
    if (c.subjectCount == 0 && c.notes > 0) _plural(c.notes, 'note'),
  ];
  return parts.isEmpty ? (c.duration ?? 'Course') : parts.join(' · ');
}

// ───────────── Home section ─────────────

/// "All courses" strip on Home: a few course cards and "See all".
class HomeCoursesSection extends ConsumerWidget {
  const HomeCoursesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courses = ref.watch(catalogProvider).value ?? const <CatalogCourse>[];
    if (courses.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text('Courses',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            ),
            TextButton(onPressed: () => context.push('/courses'), child: const Text('See all')),
          ],
        ),
        SizedBox(
          height: 206,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: courses.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) => SizedBox(width: 220, child: CourseCard(course: courses[i])),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

// ───────────── list ─────────────

class CoursesScreen extends ConsumerStatefulWidget {
  const CoursesScreen({super.key});

  @override
  ConsumerState<CoursesScreen> createState() => _CoursesScreenState();
}

class _CoursesScreenState extends ConsumerState<CoursesScreen> {
  String? _category; // null = all

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(catalogProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('All courses')),
      body: AsyncView(
        value: value,
        onRetry: () => ref.invalidate(catalogProvider),
        builder: (courses) {
          if (courses.isEmpty) {
            return const EmptyState(icon: Icons.school_outlined, text: 'No courses are listed yet.');
          }
          final categories = {for (final c in courses) _categoryOf(c)}.toList()
            ..sort((a, b) => a == _otherCategory ? 1 : (b == _otherCategory ? -1 : a.compareTo(b)));
          final shown = _category == null ? courses : courses.where((c) => _categoryOf(c) == _category).toList();
          return RefreshIndicator(
            onRefresh: () => ref.refresh(catalogProvider.future),
            child: CustomScrollView(
              slivers: [
                if (categories.length > 1)
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 56,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                        children: [
                          for (final cat in [null, ...categories])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(cat ?? 'All'),
                                selected: _category == cat,
                                onSelected: (_) => setState(() => _category = cat),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 260,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      mainAxisExtent: 206,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) => CourseCard(course: shown[i]),
                      childCount: shown.length,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Course thumbnail: coloured cover with the name, then category, name and syllabus size.
class CourseCard extends StatelessWidget {
  const CourseCard({super.key, required this.course});
  final CatalogCourse course;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final cover = _coverOf(course);
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/courses/${course.id}', extra: course),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 96,
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: cover, begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: -18,
                    bottom: -26,
                    child: Icon(Icons.auto_stories, size: 92, color: Colors.white.withValues(alpha: 0.12)),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      course.name.toUpperCase(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, height: 1.2),
                    ),
                  ),
                  Align(alignment: Alignment.topRight, child: _StatusBadge(enrolled: course.enrolled, small: true)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_categoryOf(course),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.labelSmall?.copyWith(color: AppTheme.gold, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(course.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, height: 1.25)),
                  const SizedBox(height: 6),
                  Text(_summary(course),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall?.copyWith(color: AppTheme.forest, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.enrolled, this.small = false});
  final bool enrolled;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final fg = enrolled ? AppTheme.forestDeep : Colors.white;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      decoration: BoxDecoration(
        color: enrolled ? const Color(0xFFDCEADC) : Colors.black.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(enrolled ? Icons.check_circle : Icons.lock_outline, size: small ? 12 : 14, color: fg),
          const SizedBox(width: 4),
          Text(enrolled ? 'Your course' : 'Not in your batch',
              style: TextStyle(fontSize: small ? 10.5 : 12, fontWeight: FontWeight.w700, color: fg)),
        ],
      ),
    );
  }
}

// ───────────── detail ─────────────

class CourseDetailScreen extends ConsumerWidget {
  const CourseDetailScreen({super.key, required this.id, this.initial});
  final String id;

  /// The card's data, so the page opens at once; the list is reloaded when it is missing.
  final CatalogCourse? initial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fromList = ref.watch(catalogProvider).value?.where((c) => c.id == id).firstOrNull;
    final course = fromList ?? initial;
    if (course == null) {
      return Scaffold(
        appBar: AppBar(),
        body: AsyncView(
          value: ref.watch(catalogProvider),
          onRetry: () => ref.invalidate(catalogProvider),
          builder: (_) => const EmptyState(icon: Icons.school_outlined, text: 'This course is no longer listed.'),
        ),
      );
    }
    final text = Theme.of(context).textTheme;
    final cover = _coverOf(course);
    final facts = <(IconData, String)>[
      if (course.subjectCount > 0) (Icons.menu_book_outlined, _plural(course.subjectCount, 'subject')),
      if (course.topicCount > 0) (Icons.list_alt, _plural(course.topicCount, 'topic')),
      if (course.notes > 0) (Icons.picture_as_pdf_outlined, _plural(course.notes, 'PDF note')),
      if (course.tests > 0) (Icons.quiz_outlined, _plural(course.tests, 'test')),
      if (course.videos > 0) (Icons.play_circle_outline, _plural(course.videos, 'video lesson')),
      if (course.duration != null) (Icons.schedule, course.duration!),
      if (course.language != null) (Icons.translate, course.language!),
    ];

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 210,
            foregroundColor: Colors.white,
            backgroundColor: cover.first,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: cover, begin: Alignment.topLeft, end: Alignment.bottomRight),
                ),
                padding: const EdgeInsets.fromLTRB(20, 86, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(_categoryOf(course).toUpperCase(),
                        style: text.labelSmall?.copyWith(color: const Color(0xFFF5E8C8), fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                    const SizedBox(height: 4),
                    Text(course.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    _StatusBadge(enrolled: course.enrolled),
                  ],
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            sliver: SliverList.list(
              children: [
                if (course.tagline != null) ...[
                  Text(course.tagline!, style: text.titleMedium?.copyWith(height: 1.35)),
                  const SizedBox(height: 14),
                ],
                _AccessCard(enrolled: course.enrolled),
                if (facts.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final (icon, label) in facts)
                        Chip(
                          avatar: Icon(icon, size: 16, color: AppTheme.forest),
                          label: Text(label),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                ],
                if (course.highlights.isNotEmpty) _Bullets(title: 'What you’ll learn', items: course.highlights, icon: Icons.check),
                if (course.includes.isNotEmpty) _Bullets(title: 'This course includes', items: course.includes, icon: Icons.star_outline),
                if (course.subjects.isNotEmpty) ...[
                  const _Heading('Syllabus'),
                  Card(
                    margin: EdgeInsets.zero,
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (final s in course.subjects)
                          ExpansionTile(
                            title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(_plural(s.topics.length, 'topic')),
                            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                            expandedCrossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (final t in s.topics)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.article_outlined, size: 16, color: AppTheme.gold),
                                      const SizedBox(width: 8),
                                      Expanded(child: Text(t)),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ],
                if (course.description != null) ...[
                  const _Heading('About this course'),
                  Text(course.description!, style: text.bodyMedium?.copyWith(height: 1.5)),
                ],
                if (course.audience.isNotEmpty) _Bullets(title: 'Who this course is for', items: course.audience, icon: Icons.person_outline),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Your course: a way into the study material. Not yours: says so, and nothing more (no price,
/// no buy, no link out; see the note at the top of this file).
class _AccessCard extends StatelessWidget {
  const _AccessCard({required this.enrolled});
  final bool enrolled;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (enrolled) {
      return Card(
        margin: EdgeInsets.zero,
        color: scheme.primaryContainer,
        child: ListTile(
          leading: Icon(Icons.check_circle, color: scheme.onPrimaryContainer),
          title: Text('You are in this course', style: TextStyle(fontWeight: FontWeight.w700, color: scheme.onPrimaryContainer)),
          subtitle: Text('Open your notes, tests and classes.', style: TextStyle(color: scheme.onPrimaryContainer)),
          trailing: Icon(Icons.chevron_right, color: scheme.onPrimaryContainer),
          onTap: () => context.go('/notes'),
        ),
      );
    }
    return Card(
      margin: EdgeInsets.zero,
      color: scheme.surfaceContainerHigh,
      child: const ListTile(
        leading: Icon(Icons.lock_outline),
        title: Text('Not part of your batches', style: TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('The study material of this course opens once the institute adds you to one of its batches.'),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      );
}

class _Bullets extends StatelessWidget {
  const _Bullets({required this.title, required this.items, required this.icon});
  final String title;
  final List<String> items;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(title),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 18, color: AppTheme.forest),
                  const SizedBox(width: 10),
                  Expanded(child: Text(item, style: const TextStyle(height: 1.4))),
                ],
              ),
            ),
        ],
      );
}
