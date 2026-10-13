import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import 'models.dart';

final offlineNotesProvider = Provider<OfflineNotes>((_) => OfflineNotes());

/// What the notes list shows for a saved PDF without asking the server.
class OfflineNote {
  const OfflineNote({
    required this.id,
    required this.title,
    this.subject,
    this.topic,
    required this.size,
    required this.version,
    required this.savedAt,
  });

  factory OfflineNote.fromJson(Map<String, dynamic> j) => OfflineNote(
        id: j['id'] as String,
        title: j['title'] as String,
        subject: j['subject'] as String?,
        topic: j['topic'] as String?,
        size: j['size'] as int,
        version: j['version'] as int,
        savedAt: DateTime.parse(j['savedAt'] as String),
      );

  final String id;
  final String title;
  final String? subject;
  final String? topic;
  final int size;
  final int version;
  final DateTime savedAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'subject': subject,
        'topic': topic,
        'size': size,
        'version': version,
        'savedAt': savedAt.toIso8601String(),
      };

  /// Enough of a [Note] to open the viewer offline.
  Note toNote() => Note(
        id: id,
        title: title,
        description: null,
        subject: subject,
        topic: topic,
        size: size,
        version: version,
        allowDownload: false,
      );
}

/// Notes saved for reading without internet. Each PDF is AES-256-GCM encrypted in the app's
/// private folder; the key lives in the Android Keystore (secure storage), so a copied file is
/// useless and nothing is ever handed to another app. Copies belong to one student: they are
/// wiped on logout, when another student signs in, and when the teacher removes the note.
class OfflineNotes {
  OfflineNotes([FlutterSecureStorage? storage]) : _secure = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secure;
  final _aes = AesGcm.with256bits();
  static const _kKey = 'offline_notes_key';

  Directory? _dirCache;
  Future<Directory> get _dir async {
    if (_dirCache != null) return _dirCache!;
    final base = await getApplicationSupportDirectory(); // private to the app, not shared storage
    final dir = Directory('${base.path}/offline_notes');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return _dirCache = dir;
  }

  Future<SecretKey> _key() async {
    final stored = await _secure.read(key: _kKey);
    if (stored != null) return SecretKey(base64Decode(stored));
    final rnd = Random.secure();
    final bytes = List<int>.generate(32, (_) => rnd.nextInt(256));
    await _secure.write(key: _kKey, value: base64Encode(bytes));
    return SecretKey(bytes);
  }

  Future<File> _index() async => File('${(await _dir).path}/index.json');
  Future<File> _file(String id) async => File('${(await _dir).path}/${id.replaceAll(RegExp(r'[^\w-]'), '')}.bin');

  Future<Map<String, dynamic>> _readIndex() async {
    final f = await _index();
    if (!f.existsSync()) return {'user': null, 'notes': <String, dynamic>{}};
    try {
      return jsonDecode(await f.readAsString()) as Map<String, dynamic>;
    } catch (_) {
      return {'user': null, 'notes': <String, dynamic>{}};
    }
  }

  Future<void> _writeIndex(Map<String, dynamic> index) async => (await _index()).writeAsString(jsonEncode(index));

  /// Call when a student is known: copies saved by someone else on this phone are deleted.
  Future<void> bindUser(String userId) async {
    final index = await _readIndex();
    if (index['user'] != null && index['user'] != userId) await clear();
    final fresh = await _readIndex();
    if (fresh['user'] != userId) await _writeIndex({...fresh, 'user': userId});
  }

  Future<List<OfflineNote>> list() async {
    final notes = (await _readIndex())['notes'] as Map<String, dynamic>;
    return [for (final n in notes.values) OfflineNote.fromJson(n as Map<String, dynamic>)]
      ..sort((a, b) => (a.subject ?? '').compareTo(b.subject ?? '') == 0
          ? a.title.compareTo(b.title)
          : (a.subject ?? '').compareTo(b.subject ?? ''));
  }

  Future<OfflineNote?> get(String id) async {
    final n = ((await _readIndex())['notes'] as Map<String, dynamic>)[id];
    return n == null ? null : OfflineNote.fromJson(n as Map<String, dynamic>);
  }

  Future<void> save(Note note, Uint8List pdf) async {
    final box = await _aes.encrypt(pdf, secretKey: await _key());
    // nonce | ciphertext | mac, in one file.
    await (await _file(note.id)).writeAsBytes(box.concatenation(), flush: true);
    final index = await _readIndex();
    final notes = Map<String, dynamic>.from(index['notes'] as Map);
    notes[note.id] = OfflineNote(
      id: note.id,
      title: note.title,
      subject: note.subject,
      topic: note.topic,
      size: note.size,
      version: note.version,
      savedAt: DateTime.now(),
    ).toJson();
    await _writeIndex({...index, 'notes': notes});
  }

  /// The decrypted PDF, or null when there is no (readable) copy.
  Future<Uint8List?> read(String id) async {
    final f = await _file(id);
    if (!f.existsSync()) return null;
    try {
      final box = SecretBox.fromConcatenation(
        await f.readAsBytes(),
        nonceLength: _aes.nonceLength,
        macLength: _aes.macAlgorithm.macLength,
      );
      return Uint8List.fromList(await _aes.decrypt(box, secretKey: await _key()));
    } catch (_) {
      await remove(id); // tampered or from an old key: drop it
      return null;
    }
  }

  Future<void> remove(String id) async {
    final f = await _file(id);
    if (f.existsSync()) await f.delete();
    final index = await _readIndex();
    final notes = Map<String, dynamic>.from(index['notes'] as Map)..remove(id);
    await _writeIndex({...index, 'notes': notes});
  }

  /// After a successful online list: drop copies of notes the student can no longer see.
  Future<void> keepOnly(Iterable<String> visibleIds) async {
    final keep = visibleIds.toSet();
    for (final n in await list()) {
      if (!keep.contains(n.id)) await remove(n.id);
    }
  }

  Future<void> clear() async {
    final dir = await _dir;
    if (dir.existsSync()) await dir.delete(recursive: true);
    _dirCache = null;
    await _secure.delete(key: _kKey);
  }
}
