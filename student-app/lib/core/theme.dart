import 'package:flutter/material.dart';

/// DHĪ look, taken from the logo: deep forest green and warm gold on a cream page.
/// Poppins is bundled (assets/fonts) so text looks the same offline and during an exam.
abstract final class AppTheme {
  static const forest = Color(0xFF1F4D2C); // primary: logo leaves / letters
  static const forestDeep = Color(0xFF0D301C); // darkest green, for headings
  static const gold = Color(0xFFAB803B); // logo gold
  static const cream = Color(0xFFFDFAF3); // logo background
  static const line = Color(0xFFE6E0CC); // hairline borders

  static final ColorScheme _scheme = ColorScheme.fromSeed(seedColor: forest).copyWith(
    primary: forest,
    onPrimary: Colors.white,
    primaryContainer: const Color(0xFFDCEADC),
    onPrimaryContainer: forestDeep,
    secondary: gold,
    onSecondary: Colors.white,
    secondaryContainer: const Color(0xFFF5E8C8),
    onSecondaryContainer: const Color(0xFF4A3410),
    tertiary: const Color(0xFF2D6A68),
    onTertiary: Colors.white,
    tertiaryContainer: const Color(0xFFD5EBE8),
    onTertiaryContainer: const Color(0xFF0B3B38),
    surface: Colors.white,
    onSurface: const Color(0xFF1A2B20),
    onSurfaceVariant: const Color(0xFF5A6659),
    surfaceContainerLowest: Colors.white,
    surfaceContainerLow: const Color(0xFFF8F5EA),
    surfaceContainer: const Color(0xFFF3EFE0),
    surfaceContainerHigh: const Color(0xFFEFEBDA),
    surfaceContainerHighest: const Color(0xFFEAE5D2),
    outline: const Color(0xFF8A9486),
    outlineVariant: line,
  );

  static ThemeData light() {
    final s = _scheme;
    final radius = BorderRadius.circular(12);
    OutlineInputBorder border(Color c, [double w = 1]) =>
        OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c, width: w));

    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Poppins',
      colorScheme: s,
      scaffoldBackgroundColor: cream,
      appBarTheme: const AppBarTheme(
        backgroundColor: cream,
        foregroundColor: forestDeep,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: 'Poppins',
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: forestDeep,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: line),
        ),
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        iconColor: s.primary,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, 46),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 46),
          shape: RoundedRectangleBorder(borderRadius: radius),
          side: const BorderSide(color: Color(0xFFCBC4AB)),
          textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: gold,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: border(const Color(0xFFCBC4AB)),
        enabledBorder: border(const Color(0xFFCBC4AB)),
        focusedBorder: border(s.primary, 2),
        errorBorder: border(s.error),
        focusedErrorBorder: border(s.error, 2),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: s.primaryContainer,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? s.primary : s.onSurfaceVariant,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? s.primary : s.onSurfaceVariant),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: s.secondaryContainer,
        labelStyle: TextStyle(fontFamily: 'Poppins', fontSize: 12, fontWeight: FontWeight.w600, color: s.onSecondaryContainer),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: forestDeep,
        contentTextStyle: const TextStyle(fontFamily: 'Poppins', color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: s.primary,
        linearTrackColor: s.primaryContainer,
      ),
      dividerTheme: const DividerThemeData(color: line, space: 1),
    );
  }
}
