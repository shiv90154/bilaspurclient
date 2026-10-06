import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Faint diagonal tiled text (student name + phone) laid over protected content.
/// A deterrent against photos of the screen; it never blocks touches.
class Watermark extends StatelessWidget {
  const Watermark({super.key, required this.text, required this.child});

  final String text;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.passthrough,
      children: [
        child,
        Positioned.fill(
          child: IgnorePointer(
            child: ClipRect(
              child: CustomPaint(painter: _WatermarkPainter(text)),
            ),
          ),
        ),
      ],
    );
  }
}

class _WatermarkPainter extends CustomPainter {
  _WatermarkPainter(this.text);
  final String text;

  @override
  void paint(Canvas canvas, Size size) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        // Small and light: it has to survive a photo of the screen without getting in the way of reading.
        style: const TextStyle(color: Color(0x1A000000), fontSize: 11, fontWeight: FontWeight.w500),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    // Space the repeats by the text's own width so a long name never runs into the next copy.
    final stepX = math.max(painter.width + 90, 220.0);
    const stepY = 170.0;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-math.pi / 7);
    final reach = size.longestSide;
    var row = 0;
    for (var y = -reach; y < reach; y += stepY, row++) {
      final offset = row.isEven ? 0.0 : stepX / 2;
      for (var x = -reach + offset; x < reach; x += stepX) {
        painter.paint(canvas, Offset(x, y));
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_WatermarkPainter old) => old.text != text;
}
