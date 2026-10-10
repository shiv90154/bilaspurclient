import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/update_check.dart';

/// The signed-in frame: a bottom bar that switches between the main tabs. Each tab keeps its own
/// scroll position and stack. Full-screen flows (a note, an exam, a doubt thread) sit outside it.
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  /// Ask about a new version once per app start, not on every sign-in.
  static bool _updateChecked = false;

  @override
  void initState() {
    super.initState();
    if (_updateChecked) return;
    _updateChecked = true;
    checkForUpdate().then((update) {
      if (update != null && mounted) showUpdateDialog(context, update);
    });
  }

  @override
  Widget build(BuildContext context) {
    final shell = widget.shell;
    return PopScope(
      // Back from any other tab returns to Home first; only Home lets the app close.
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(0);
      },
      child: Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.menu_book_outlined),
              selectedIcon: Icon(Icons.menu_book),
              label: 'Study',
            ),
            NavigationDestination(
              icon: Icon(Icons.quiz_outlined),
              selectedIcon: Icon(Icons.quiz),
              label: 'Tests',
            ),
            NavigationDestination(
              icon: Icon(Icons.help_outline),
              selectedIcon: Icon(Icons.help),
              label: 'Doubts',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}
