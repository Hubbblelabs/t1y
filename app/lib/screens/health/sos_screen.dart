import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/sos_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_loader.dart';

/// Emergency contacts, one tap from dialling. Reached from the Home tab and
/// from Profile; not behind the PIN — in an emergency nothing should be in the
/// way.
class SosScreen extends StatefulWidget {
  const SosScreen({super.key});

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> {
  static const _red = Color(0xFFC62828);

  List<SosContact>? _contacts;

  @override
  void initState() {
    super.initState();
    // Show the saved list immediately, then replace it with the fresh one.
    SosService.instance.cached().then((saved) {
      if (mounted && _contacts == null && saved.isNotEmpty) {
        setState(() => _contacts = saved);
      }
    });
    _load();
  }

  Future<void> _load() async {
    final contacts = await SosService.instance.load();
    if (mounted) setState(() => _contacts = contacts);
  }

  Future<void> _call(SosContact contact) async {
    final opened = await SosService.instance.dial(contact);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(S.cannotCall(contact.phone)),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final contacts = _contacts;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(title: Text(S.sosContacts)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: contacts == null
            ? ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: AppLoader()),
                ],
              )
            : contacts.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(28),
                children: [
                  const SizedBox(height: 60),
                  const Icon(
                    Icons.phone_disabled_outlined,
                    size: 44,
                    color: AppTheme.inkSoft,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    S.noSosContacts,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14.5,
                      height: 1.45,
                      color: AppTheme.inkSoft,
                    ),
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                    child: Text(
                      S.sosHint,
                      style: const TextStyle(
                        fontSize: 13.5,
                        height: 1.4,
                        color: AppTheme.inkSoft,
                      ),
                    ),
                  ),
                  for (final c in contacts)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppTheme.lightest,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    c.label,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.deep,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  c.name,
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: AppTheme.ink,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  c.phone,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: AppTheme.inkSoft,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            tooltip: S.callName(c.name),
                            onPressed: () => _call(c),
                            style: IconButton.styleFrom(
                              backgroundColor: _red,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(52, 52),
                            ),
                            icon: const Icon(Icons.call_rounded, size: 26),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
