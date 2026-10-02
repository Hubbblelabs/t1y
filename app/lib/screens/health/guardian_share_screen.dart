import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../l10n/strings.dart';
import '../../services/api_client.dart';
import '../../services/guardian_share_service.dart';
import '../../services/health_access.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_loader.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/pin_gate.dart';

/// Lets a parent who is away from their child give a guardian — a teacher, say
/// — a one-time link to record readings, with a 6-digit code to share
/// separately. Behind the parent PIN like every other health screen.
class GuardianShareScreen extends StatelessWidget {
  const GuardianShareScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      PinGate(title: S.shareWithGuardian, child: const _Body());
}

class _Body extends StatefulWidget {
  const _Body();

  @override
  State<_Body> createState() => _BodyState();
}

class _BodyState extends State<_Body> {
  static const _durations = [30, 60, 180, 360, 720, 1440];

  int _minutes = 180;

  /// What this child is asked for, and what the parent has ticked for the link.
  HealthAccess? _access;
  final Set<String> _collect = {};
  final _note = TextEditingController();
  bool _creating = false;
  String? _error;
  List<GuardianShare>? _shares;
  CreatedShare? _fresh;

  @override
  void initState() {
    super.initState();
    _load();
    HealthAccess.load().then((access) {
      if (!mounted) return;
      setState(() {
        _access = access;
        // Everything the child is asked for starts ticked.
        _collect.addAll(_kinds(access).map((k) => k.$1));
      });
    });
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  /// (api key, label, icon) for each thing this child can be asked to record.
  static List<(String, String, IconData)> _kinds(HealthAccess a) => [
    if (a.glucose) ('GLUCOSE', S.glucose, Icons.water_drop_outlined),
    if (a.insulin) ('INSULIN', S.insulin, Icons.vaccines_outlined),
    if (a.carbs) ('CARBS', S.carbs, Icons.restaurant_outlined),
    if (a.exercise) ('EXERCISE', S.exercise, Icons.directions_run_rounded),
  ];

  Future<void> _load() async {
    try {
      final shares = await GuardianShareService.instance.list();
      // Looking at this screen counts as having been told about used links.
      await GuardianShareService.instance.markSeen(
        shares.where((s) => s.isUsed),
      );
      if (mounted) setState(() => _shares = shares);
    } catch (_) {
      if (mounted) setState(() => _shares = const []);
    }
  }

  Future<void> _create() async {
    if (_collect.isEmpty) {
      setState(() => _error = S.chooseSomething);
      return;
    }
    setState(() {
      _creating = true;
      _error = null;
    });
    try {
      final created = await GuardianShareService.instance.create(
        expiresInMinutes: _minutes,
        collect: _collect.toList(),
        purpose: _note.text,
      );
      if (!mounted) return;
      setState(() => _fresh = created);
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = S.couldNotReach);
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  /// True while a cancel is in flight — the button is disabled meanwhile, so a
  /// second tap cannot send a second request for a link already cancelled.
  bool _cancelling = false;

  Future<void> _revoke(GuardianShare share) async {
    if (_cancelling) return;
    setState(() {
      _cancelling = true;
      _error = null;
    });
    try {
      await GuardianShareService.instance.revoke(share.id);
      if (_fresh?.id == share.id) _fresh = null;
    } on ApiException catch (e) {
      // 404 = it was already cancelled (or used) a moment ago; the list below
      // shows where it stands, so that is not worth an error.
      if (e.statusCode != 404 && mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = S.couldNotReach);
    }
    await _load();
    if (mounted) setState(() => _cancelling = false);
  }

  static String _when(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final m = d.minute.toString().padLeft(2, '0');
    final ap = d.hour < 12 ? 'AM' : 'PM';
    return '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}, $h:$m $ap';
  }

  @override
  Widget build(BuildContext context) {
    final shares = _shares;
    GuardianShare? live;
    if (shares != null) {
      for (final s in shares) {
        if (s.isActive) {
          live = s;
          break;
        }
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(title: Text(S.shareWithGuardian)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  S.shareIntro,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 12),
                for (final (i, step) in [
                  S.shareStep1,
                  S.shareStep2,
                  S.shareStep3,
                ].indexed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            color: AppTheme.lightest,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '${i + 1}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.deep,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            step,
                            style: const TextStyle(
                              fontSize: 13.5,
                              height: 1.35,
                              color: AppTheme.inkSoft,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  ErrorBanner(message: _error!),
                ],
                if (live == null) ...[
                  const SizedBox(height: 14),
                  Text(
                    S.whatToRecord,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_access == null)
                    const SizedBox(
                      height: 32,
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final (key, label, icon) in _kinds(_access!))
                          FilterChip(
                            // No tick over the icon: the chip itself turns
                            // green when chosen and stays grey when not.
                            showCheckmark: false,
                            avatar: Icon(
                              icon,
                              size: 17,
                              color: _collect.contains(key)
                                  ? const Color(0xFF2E7D32)
                                  : AppTheme.inkSoft,
                            ),
                            label: Text(label),
                            labelStyle: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: _collect.contains(key)
                                  ? const Color(0xFF2E7D32)
                                  : AppTheme.inkSoft,
                            ),
                            backgroundColor: const Color(0xFFF1F3F5),
                            selectedColor: const Color(0xFFE8F5E9),
                            side: BorderSide(
                              color: _collect.contains(key)
                                  ? const Color(0xFF2E7D32)
                                  : const Color(0xFFD5DBE1),
                            ),
                            selected: _collect.contains(key),
                            onSelected: (on) => setState(() {
                              on ? _collect.add(key) : _collect.remove(key);
                              _error = null;
                            }),
                          ),
                      ],
                    ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _note,
                    maxLength: 200,
                    minLines: 1,
                    maxLines: 2,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      labelText: S.noteForThem,
                      hintText: S.noteForThemHint,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    S.linkValidFor,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final m in _durations)
                        ChoiceChip(
                          label: Text(S.durationLabel(m)),
                          selected: _minutes == m,
                          onSelected: (_) => setState(() => _minutes = m),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _creating ? null : _create,
                    icon: _creating
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.link_rounded),
                    label: Text(S.createLink),
                  ),
                ],
              ],
            ),
          ),
          if (live != null) ...[
            const SizedBox(height: 16),
            _LiveLink(
              share: live,
              freshUrl: _fresh?.id == live.id ? _fresh!.url : null,
              expiresText: S.linkExpiresAt(_when(live.expiresAt)),
              cancelling: _cancelling,
              onCancel: () => _revoke(live!),
            ),
          ],
          const SizedBox(height: 22),
          Text(
            S.recentLinks,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.ink,
            ),
          ),
          const SizedBox(height: 8),
          if (shares == null)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: AppLoader(size: 32)),
            )
          else if (shares.isEmpty)
            Text(
              S.noLinksYet,
              style: const TextStyle(fontSize: 13.5, color: AppTheme.inkSoft),
            )
          else
            for (final s in shares)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 13,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        s.isUsed && s.guardianName != null
                            ? S.enteredByAt(
                                s.guardianName!,
                                _when(s.usedAt ?? s.createdAt),
                              )
                            : _when(s.createdAt),
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: AppTheme.inkSoft,
                        ),
                      ),
                    ),
                    Text(
                      S.linkStatus(s.status),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: s.isUsed
                            ? const Color(0xFF2E7D32)
                            : AppTheme.deep,
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

/// The link that is currently waiting for a guardian: its code, and ways to
/// send the link and the code in separate messages.
class _LiveLink extends StatefulWidget {
  final GuardianShare share;
  final String? freshUrl;
  final String expiresText;
  final VoidCallback onCancel;
  final bool cancelling;

  const _LiveLink({
    required this.share,
    required this.freshUrl,
    required this.expiresText,
    required this.onCancel,
    required this.cancelling,
  });

  @override
  State<_LiveLink> createState() => _LiveLinkState();
}

class _LiveLinkState extends State<_LiveLink> {
  String? _url;

  @override
  void initState() {
    super.initState();
    _url = widget.freshUrl;
    if (_url == null) {
      GuardianShareService.instance.savedUrl(widget.share.id).then((url) {
        if (mounted) setState(() => _url = url);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.share.code ?? '';
    final url = _url;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.expiresText,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: AppTheme.ink,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            S.codeLabelShort,
            style: const TextStyle(fontSize: 12.5, color: AppTheme.inkSoft),
          ),
          const SizedBox(height: 4),
          Text(
            code.length == 6
                ? '${code.substring(0, 3)} ${code.substring(3)}'
                : code,
            style: const TextStyle(
              fontSize: 34,
              letterSpacing: 6,
              fontWeight: FontWeight.w800,
              color: AppTheme.deep,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            S.shareCodeSeparately,
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.4,
              color: AppTheme.inkSoft,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              if (url != null)
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => SharePlus.instance.share(
                      ShareParams(text: S.linkMessage(url)),
                    ),
                    icon: const Icon(Icons.share_rounded),
                    label: Text(S.shareLinkAction),
                  ),
                ),
              if (url != null) const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => SharePlus.instance.share(
                    ShareParams(text: S.codeMessage(code)),
                  ),
                  icon: const Icon(Icons.pin_outlined),
                  label: Text(S.shareCodeAction),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: widget.cancelling ? null : widget.onCancel,
            child: widget.cancelling
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(S.cancelLink),
          ),
        ],
      ),
    );
  }
}
