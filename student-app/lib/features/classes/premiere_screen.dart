import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';

/// How far a phone may drift from the live moment before it is pulled back.
const _maxDrift = Duration(seconds: 5);

/// A recorded video played like a live class: everyone sees the same moment (now - start time),
/// latecomers come in mid-way, and there is no skipping ahead. Pausing is allowed, but Play always
/// returns to the live moment. Before the start the student waits on a countdown.
class PremiereScreen extends ConsumerStatefulWidget {
  const PremiereScreen({super.key, required this.classId, required this.title});

  final String classId;
  final String title;

  @override
  ConsumerState<PremiereScreen> createState() => _PremiereScreenState();
}

class _PremiereScreenState extends ConsumerState<PremiereScreen> {
  PremiereInfo? _info;
  VideoPlayerController? _controller;
  String? _error;
  bool _ended = false;
  bool _starting = false;
  bool _pausedByStudent = false;
  bool _fullscreen = false;
  bool _immersive = false;
  bool _screenKeptOn = false;
  int _retries = 0;
  Timer? _ticker;
  late final ContentApi _api;

  static const _screen = MethodChannel('dhi/screen');

  @override
  void initState() {
    super.initState();
    _api = ref.read(contentApiProvider);
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  /// Joins the premiere (marks attendance) and gets a fresh signed link and the server time.
  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final info = await _api.premiere(widget.classId);
      if (!mounted) return;
      setState(() => _info = info);
      _tick();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = _messageFor(e));
    }
  }

  String _messageFor(Object e) {
    if (e is ApiException) {
      return switch (e.code) {
        'CLASS_ENDED' => 'This premiere has ended.',
        'CLASS_CANCELLED' => 'This premiere was cancelled.',
        'CLASS_NOT_OPEN' => 'You can open the premiere from 15 minutes before it starts.',
        _ => e.message,
      };
    }
    return 'Could not open the premiere. Check your internet and try again.';
  }

  /// Every second: start when the time comes, keep in step with the live moment, notice the end.
  void _tick() {
    final info = _info;
    if (info == null || !mounted || _ended) return;
    final now = info.serverNow;
    final c = _controller;
    final duration = c != null && c.value.isInitialized ? c.value.duration : null;
    if (!now.isBefore(info.endAt) || (duration != null && duration > Duration.zero && info.livePosition >= duration)) {
      _finish();
      return;
    }
    if (now.isBefore(info.startAt)) {
      setState(() {}); // countdown
      return;
    }
    if (c == null) {
      if (!_starting && _error == null) _startPlayer(info);
      return;
    }
    final v = c.value;
    if (v.isPlaying && !v.isBuffering && !_pausedByStudent) {
      final drift = v.position - info.livePosition;
      if (drift.abs() > _maxDrift) c.seekTo(info.livePosition);
    }
  }

  Future<void> _startPlayer(PremiereInfo info) async {
    _starting = true;
    try {
      final controller = VideoPlayerController.networkUrl(info.url);
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      await controller.seekTo(info.livePosition);
      controller.addListener(_onPlayerChange);
      setState(() => _controller = controller);
      if (!_pausedByStudent) await controller.play();
    } catch (_) {
      if (mounted) _recover();
    } finally {
      _starting = false;
    }
  }

  void _onPlayerChange() {
    final c = _controller;
    if (c == null || !mounted) return;
    _keepScreenOn(c.value.isPlaying);
    if (c.value.hasError) _recover();
  }

  /// A network or decoder hiccup: throw the player away and come back in at the live moment
  /// with a fresh link. After a few failures the student gets a Try again button.
  void _recover() {
    _dropPlayer();
    if (_retries < 3) {
      _retries++;
      _load();
    } else {
      setState(() => _error = 'Playback stopped. Check your internet and try again.');
    }
  }

  void _dropPlayer() {
    final old = _controller;
    old?.removeListener(_onPlayerChange);
    _keepScreenOn(false);
    if (mounted) setState(() => _controller = null);
    WidgetsBinding.instance.addPostFrameCallback((_) => old?.dispose());
  }

  void _finish() {
    _dropPlayer();
    _ticker?.cancel();
    setState(() => _ended = true);
    if (_isFull) _toggleFullscreen();
  }

  void _togglePlay() {
    final c = _controller;
    final info = _info;
    if (c == null || info == null) return;
    if (c.value.isPlaying) {
      _pausedByStudent = true;
      c.pause();
    } else {
      // Play always rejoins the live moment, like a live stream.
      _pausedByStudent = false;
      c.seekTo(info.livePosition).then((_) => c.play());
    }
    setState(() {});
  }

  void _keepScreenOn(bool on) {
    if (on == _screenKeptOn) return;
    _screenKeptOn = on;
    _screen.invokeMethod<void>('keepOn', on).catchError((Object _) {});
  }

  bool get _isFull => _fullscreen || MediaQuery.orientationOf(context) == Orientation.landscape;

  Future<void> _toggleFullscreen() async {
    if (_isFull) {
      setState(() => _fullscreen = false);
      await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    } else {
      setState(() => _fullscreen = true);
      await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
    }
  }

  void _syncSystemBars(bool full) {
    if (full == _immersive) return;
    _immersive = full;
    SystemChrome.setEnabledSystemUIMode(full ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _keepScreenOn(false);
    _controller?.removeListener(_onPlayerChange);
    _controller?.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    // Attendance minutes; a failure here must not bother the student.
    _api.leaveClass(widget.classId).catchError((Object _) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final full = _isFull && _controller != null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncSystemBars(full);
    });
    final stage = AspectRatio(aspectRatio: _aspect, child: _stage());
    return PopScope(
      canPop: !full,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && full) _toggleFullscreen();
      },
      child: Scaffold(
        backgroundColor: full ? Colors.black : null,
        appBar: full ? null : AppBar(title: Text(_info?.title ?? widget.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
        body: full
            ? Center(child: stage)
            : ListView(
                children: [
                  stage,
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_info?.title ?? widget.title, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Text(
                          'Premiere: everyone watches together, like a live class. If you join late you start from where the class is now.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  double get _aspect {
    final c = _controller;
    return c != null && c.value.isInitialized && c.value.aspectRatio > 0 ? c.value.aspectRatio : 16 / 9;
  }

  Widget _stage() {
    const white = TextStyle(color: Colors.white);
    if (_ended) {
      return _BlackPanel(children: [
        const Icon(Icons.check_circle_outline, color: Colors.white, size: 40),
        const SizedBox(height: 10),
        const Text('The premiere has ended.', style: white),
        const SizedBox(height: 12),
        FilledButton.tonal(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Back')),
      ]);
    }
    if (_error != null) {
      return _BlackPanel(children: [
        Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(_error!, textAlign: TextAlign.center, style: white)),
        const SizedBox(height: 12),
        FilledButton.tonal(
          onPressed: () {
            _retries = 0;
            _load();
          },
          child: const Text('Try again'),
        ),
      ]);
    }
    final info = _info;
    if (info != null && info.serverNow.isBefore(info.startAt)) {
      return _BlackPanel(children: [
        const Text('Premiere starts in', style: white),
        const SizedBox(height: 6),
        Text(_clock(info.startAt.difference(info.serverNow)),
            style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
        const SizedBox(height: 6),
        const Text('Keep this screen open. It starts by itself.', style: TextStyle(color: Colors.white70, fontSize: 12)),
      ]);
    }
    final c = _controller;
    if (c == null) return const _BlackPanel(children: [CircularProgressIndicator()]);
    return GestureDetector(
      onTap: _togglePlay,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: Colors.black, child: VideoPlayer(c)),
          ValueListenableBuilder<VideoPlayerValue>(
            valueListenable: c,
            builder: (context, v, _) => Stack(
              fit: StackFit.expand,
              children: [
                if (v.isBuffering) const Center(child: CircularProgressIndicator()),
                if (!v.isPlaying && !v.isBuffering)
                  Center(
                    child: FilledButton.icon(
                      onPressed: _togglePlay,
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Back to live'),
                    ),
                  ),
                Positioned(left: 10, top: 10, child: _LiveBadge(live: v.isPlaying && !_pausedByStudent)),
                Positioned(
                  right: 4,
                  bottom: 0,
                  child: Row(
                    children: [
                      if (v.duration > Duration.zero)
                        Text('${_clock(v.position)} / ${_clock(v.duration)}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                      IconButton(
                        color: Colors.white,
                        tooltip: _isFull ? 'Exit full screen' : 'Full screen',
                        icon: Icon(_isFull ? Icons.fullscreen_exit : Icons.fullscreen),
                        onPressed: _toggleFullscreen,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BlackPanel extends StatelessWidget {
  const _BlackPanel({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: Colors.black,
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: children)),
      );
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge({required this.live});
  final bool live;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(color: live ? Colors.red : Colors.black54, borderRadius: BorderRadius.circular(4)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          child: Text(live ? 'LIVE' : 'PAUSED', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
        ),
      );
}

String _clock(Duration d) {
  if (d.isNegative) d = Duration.zero;
  final h = d.inHours;
  final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return h > 0 ? '$h:$m:$s' : '$m:$s';
}
