import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final myDocumentsProvider = FutureProvider.autoDispose<List<MyDocument>>((ref) => ref.watch(contentApiProvider).myDocuments());

const _maxBytes = 10 * 1024 * 1024;

/// ID proof, marksheet and other papers. The student uploads; the institute approves or rejects.
class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docs = ref.watch(myDocumentsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My documents')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (_) => const _UploadSheet(),
        ),
        icon: const Icon(Icons.upload_file),
        label: const Text('Upload'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myDocumentsProvider.future),
        child: AsyncView(
          value: docs,
          onRetry: () => ref.invalidate(myDocumentsProvider),
          builder: (list) => list.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 80),
                  EmptyState(
                    icon: Icons.folder_open_outlined,
                    title: 'No documents yet',
                    text: 'Upload your ID proof (Aadhaar etc.) and marksheet. The institute checks and approves them.',
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _DocTile(doc: list[i]),
                ),
        ),
      ),
    );
  }
}

class _DocTile extends ConsumerWidget {
  const _DocTile({required this.doc});
  final MyDocument doc;

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    try {
      final url = await ref.read(contentApiProvider).documentUrl(doc.id);
      final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!ok && context.mounted) showError(context, 'Could not open the file.');
    } on ApiException catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Delete this document?'),
        content: Text(doc.fileName),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(contentApiProvider).removeDocument(doc.id);
      ref.invalidate(myDocumentsProvider);
    } on ApiException catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final (label, color, icon) = switch (doc.status) {
      DocStatus.pending => ('Waiting for approval', AppTheme.gold, Icons.hourglass_top),
      DocStatus.approved => ('Approved', AppTheme.forest, Icons.verified_outlined),
      DocStatus.rejected => ('Not accepted', scheme.error, Icons.error_outline),
    };
    final isPdf = doc.fileName.toLowerCase().endsWith('.pdf');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _open(context, ref),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(isPdf ? Icons.picture_as_pdf_outlined : Icons.image_outlined, color: scheme.primary, size: 30),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.fileName, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text('${doc.typeLabel} · ${DateFormat('d MMM yyyy').format(doc.createdAt)}', style: text.bodySmall),
                    const SizedBox(height: 6),
                    Row(children: [
                      Icon(icon, size: 15, color: color),
                      const SizedBox(width: 4),
                      Text(label, style: text.bodySmall?.copyWith(color: color, fontWeight: FontWeight.w600)),
                    ]),
                    if (doc.status == DocStatus.rejected && doc.reviewNote != null) ...[
                      const SizedBox(height: 4),
                      Text('Reason: ${doc.reviewNote}', style: text.bodySmall),
                    ],
                  ],
                ),
              ),
              if (doc.canDelete)
                IconButton(
                  tooltip: 'Delete',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => _delete(context, ref),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UploadSheet extends ConsumerStatefulWidget {
  const _UploadSheet();

  @override
  ConsumerState<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends ConsumerState<_UploadSheet> {
  String _type = 'ID_PROOF';
  final _label = TextEditingController();
  Uint8List? _bytes;
  String? _fileName;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  void _use(Uint8List bytes, String name) {
    if (bytes.length > _maxBytes) {
      setState(() => _error = 'The file is larger than 10 MB. Choose a smaller one.');
      return;
    }
    setState(() {
      _bytes = bytes;
      _fileName = name;
      _error = null;
    });
  }

  Future<void> _photo() async {
    try {
      final shot = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2000, maxHeight: 2000, imageQuality: 80);
      if (shot != null) _use(await shot.readAsBytes(), 'document.jpg');
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not open the camera.');
    }
  }

  Future<void> _file() async {
    try {
      final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp']);
      if (f != null) _use(await f.readAsBytes(), f.name);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not open the file.');
    }
  }

  Future<void> _upload() async {
    if (_bytes == null) return setState(() => _error = 'Take a photo or choose a file first');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(contentApiProvider).uploadDocument(
            bytes: _bytes!,
            fileName: _fileName!,
            type: _type,
            label: _label.text.trim(),
          );
      ref.invalidate(myDocumentsProvider);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Uploaded. The institute will check it soon.')),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Upload a document', style: text.titleLarge),
            const SizedBox(height: 4),
            Text('PDF or photo, up to 10 MB.', style: text.bodySmall),
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'ID_PROOF', label: Text('ID proof')),
                ButtonSegment(value: 'MARKSHEET', label: Text('Marksheet')),
                ButtonSegment(value: 'OTHER', label: Text('Other')),
              ],
              selected: {_type},
              showSelectedIcon: false,
              onSelectionChanged: (s) => setState(() => _type = s.first),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _label,
              maxLength: 100,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Name (optional)', hintText: 'e.g. Aadhaar card', counterText: ''),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _photo,
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const Text('Take photo'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _file,
                  icon: const Icon(Icons.attach_file),
                  label: const Text('Choose file'),
                ),
              ),
            ]),
            if (_fileName != null) ...[
              const SizedBox(height: 10),
              Row(children: [
                const Icon(Icons.check_circle, color: AppTheme.forest, size: 18),
                const SizedBox(width: 6),
                Expanded(
                  child: Text('$_fileName · ${(_bytes!.length / 1024 / 1024).toStringAsFixed(1)} MB',
                      overflow: TextOverflow.ellipsis, style: text.bodySmall),
                ),
              ]),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _upload,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: Text(_busy ? 'Uploading…' : 'Upload'),
            ),
          ],
        ),
      ),
    );
  }
}
