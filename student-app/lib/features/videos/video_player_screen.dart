import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';

const _speeds = [1.0, 1.25, 1.5, 1.75, 2.0];

/// Plays one of our own recorded lectures inside the app, so FLAG_SECURE (no screenshots or
/// screen recording) and the name watermark cover it. The stream link is signed for a few hours.
class VideoPlayerScreen extends ConsumerStatefulWidget {
  const VideoPlayerScreen({super.key, required this.video});

  final VideoItem video;

  @override
  ConsumerState<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends ConsumerState<VideoPlayerScreen> {
  VideoPlayerController? _controller;
  String? _error;
  bool _fullscreen = false;
  // Whether the status and navigation bars are hidden right now (fullscreen button or phone turned sideways).
  bool _immersive = false;
  bool _controlsVisible = true;
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final url = await ref.read(contentApiProvider).videoPlayUrl(widget.video.id);
      final controller = VideoPlayerController.networkUrl(url);
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onTick);
      setState(() => _controller = controller);
      await controller.play();
      _scheduleHide();
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Could not load this video. Check your internet and try again.');
    }
  }

  void _onTick() {
    final c = _controller;
    if (c != null && c.value.hasError && _error == null) {
      setState(() => _error = 'Playback stopped. Check your internet and try again.');
    }
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && (_controller?.value.isPlaying ?? false)) setState(() => _controlsVisible = false);
    });
  }

  void _toggleControls() {
    setState(() => _controlsVisible = !_controlsVisible);
    if (_controlsVisible) _scheduleHide();
  }

  void _seekBy(int seconds) {
    final c = _controller!;
    final target = c.value.position + Duration(seconds: seconds);
    c.seekTo(target < Duration.zero ? Duration.zero : (target > c.value.duration ? c.value.duration : target));
    _scheduleHide();
  }

  bool get _landscape => MediaQuery.orientationOf(context) == Orientation.landscape;

  /// Fullscreen when the button was pressed or the phone is turned sideways. In landscape the normal
  /// page has no room, so the controls would end up below the screen.
  bool get _isFull => _fullscreen || _landscape;

  Future<void> _toggleFullscreen() async {
    if (_isFull) {
      // Back to portrait. Stay there while this screen is open, otherwise a phone held sideways
      // would flip straight back into fullscreen.
      setState(() => _fullscreen = false);
      await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    } else {
      setState(() => _fullscreen = true);
      await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
    }
    _scheduleHide();
  }

  void _syncSystemBars(bool full) {
    if (full == _immersive) return;
    _immersive = full;
    SystemChrome.setEnabledSystemUIMode(full ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge);
  }

  @override
  Widget build(BuildContext context) {
    final full = _isFull;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncSystemBars(full);
    });
    final player = _buildPlayer();
    return PopScope(
      canPop: !full,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && full) _toggleFullscreen();
      },
      child: Scaffold(
        backgroundColor: full ? Colors.black : null,
        appBar: full ? null : AppBar(title: Text(widget.video.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
        body: full
            ? Center(child: player)
            : ListView(
                children: [
                  player,
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.video.title, style: Theme.of(context).textTheme.titleMedium),
                        if (widget.video.description != null) ...[
                          const SizedBox(height: 6),
                          Text(widget.video.description!, style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildPlayer() {
    final c = _controller;
    if (_error != null) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: ColoredBox(
          color: Colors.black,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
                ),
                const SizedBox(height: 12),
                FilledButton.tonal(
                  onPressed: () {
                    _controller?.removeListener(_onTick);
                    _controller?.dispose();
                    _controller = null;
                    _load();
                  },
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    if (c == null) {
      return const AspectRatio(
        aspectRatio: 16 / 9,
        child: ColoredBox(color: Colors.black, child: Center(child: CircularProgressIndicator())),
      );
    }
    return AspectRatio(
      aspectRatio: c.value.aspectRatio > 0 ? c.value.aspectRatio : 16 / 9,
      child: GestureDetector(
        onTap: _toggleControls,
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
                  AnimatedOpacity(
                    opacity: _controlsVisible || !v.isPlaying ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: IgnorePointer(ignoring: !(_controlsVisible || !v.isPlaying), child: _controls(c, v)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _controls(VideoPlayerController c, VideoPlayerValue v) {
    const white = Colors.white;
    return DecoratedBox(
      decoration: const BoxDecoration(color: Color(0x66000000)),
      child: Column(
        children: [
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(iconSize: 36, color: white, tooltip: 'Back 10 seconds', icon: const Icon(Icons.replay_10), onPressed: () => _seekBy(-10)),
              const SizedBox(width: 16),
              IconButton(
                iconSize: 52,
                color: white,
                tooltip: v.isPlaying ? 'Pause' : 'Play',
                icon: Icon(v.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled),
                onPressed: () {
                  v.isPlaying ? c.pause() : c.play();
                  _scheduleHide();
                },
              ),
              const SizedBox(width: 16),
              IconButton(iconSize: 36, color: white, tooltip: 'Forward 10 seconds', icon: const Icon(Icons.forward_10), onPressed: () => _seekBy(10)),
            ],
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: VideoProgressIndicator(
              c,
              allowScrubbing: true,
              padding: const EdgeInsets.symmetric(vertical: 8),
              colors: const VideoProgressColors(playedColor: white, bufferedColor: Color(0x88FFFFFF), backgroundColor: Color(0x33FFFFFF)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 4, 4),
            child: Row(
              children: [
                Text('${_fmt(v.position)} / ${_fmt(v.duration)}', style: const TextStyle(color: white, fontSize: 12)),
                const Spacer(),
                PopupMenuButton<double>(
                  tooltip: 'Speed',
                  initialValue: v.playbackSpeed,
                  onSelected: (s) => c.setPlaybackSpeed(s),
                  itemBuilder: (_) => [for (final s in _speeds) PopupMenuItem(value: s, child: Text('${_speedLabel(s)}x'))],
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    child: Text('${_speedLabel(v.playbackSpeed)}x', style: const TextStyle(color: white, fontWeight: FontWeight.w600)),
                  ),
                ),
                IconButton(
                  color: white,
                  tooltip: _isFull ? 'Exit full screen' : 'Full screen',
                  icon: Icon(_isFull ? Icons.fullscreen_exit : Icons.fullscreen),
                  onPressed: _toggleFullscreen,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _speedLabel(double s) => s == s.roundToDouble() ? s.toStringAsFixed(0) : s.toString();

String _fmt(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return h > 0 ? '$h:$m:$s' : '$m:$s';
}
