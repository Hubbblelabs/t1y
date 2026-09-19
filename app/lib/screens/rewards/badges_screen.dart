import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/badge.dart';
import '../../services/rewards_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/badge_glow_view.dart';
import '../../widgets/glow_badge.dart';
import '../../widgets/hex_badge.dart';

/// The rewards screen.
///
/// Reads top to bottom as one sentence about the child: a glowing badge for
/// how much of the course they've taken, the name that standing has earned
/// them, and then the badges themselves as a horizontal row of recent wins.
///
/// The centre badge's glow tracks *quizzes taken*, while the standing
/// (title + star fill) tracks *average score* — deliberately two different
/// measures, so a child who is working through everything is recognised for
/// that even when their scores are still finding their feet. Tapping the
/// badge opens a full-screen glow celebration of the same thing.
class BadgesScreen extends StatefulWidget {
  const BadgesScreen({super.key});

  @override
  State<BadgesScreen> createState() => _BadgesScreenState();
}

class _BadgesScreenState extends State<BadgesScreen> {
  late Future<BadgeCollection> _future;

  @override
  void initState() {
    super.initState();
    _future = RewardsService.instance.collection();
  }

  Future<void> _refresh() async {
    setState(() => _future = RewardsService.instance.collection());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.lightest,
      appBar: AppBar(
        title: Text(S.myBadges),
        backgroundColor: AppTheme.lightest,
      ),
      body: FutureBuilder<BadgeCollection>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorState(onRetry: _refresh, message: '${snapshot.error}');
          }

          final data = snapshot.data ?? BadgeCollection.empty;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                const SizedBox(height: 8),
                _Hero(collection: data),
                const SizedBox(height: 26),
                if (data.badges.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Text(
                      S.recentBadges,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.deep,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _RecentBadgeRow(badges: data.badges),
                ] else
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      S.noBadgesYet,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: Colors.black.withValues(alpha: 0.6),
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

/// Glowing badge, rank title, and a star gauge for the average score —
/// tappable to open the full-screen celebration.
class _Hero extends StatelessWidget {
  final BadgeCollection collection;

  const _Hero({required this.collection});

  List<Color> get _colors {
    final average = collection.averageScore;
    if (average == null) return const [Color(0xFFCFD8DC), Color(0xFF90A4AE)];
    return BadgeTier.values
        .firstWhere((t) => average >= t.minScore, orElse: () => BadgeTier.rising)
        .colors;
  }

  @override
  Widget build(BuildContext context) {
    final rank = collection.rank;
    final colors = _colors;
    final icon = rank?.icon ?? noBadgeIcon;

    return Column(
      children: [
        GestureDetector(
          onTap: () => BadgeGlowView.show(
            context,
            icon: icon,
            colors: colors,
            glow: collection.attemptedFraction,
            title: rank?.title ?? S.startFirstQuiz,
            subtitle: S.takenOfQuizzes(collection.quizzesAttempted, collection.totalQuizzes),
          ),
          child: GlowBadge(
            glow: collection.attemptedFraction,
            icon: icon,
            colors: colors,
            size: 210,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          S.takenOfQuizzes(collection.quizzesAttempted, collection.totalQuizzes),
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Colors.black.withValues(alpha: 0.55),
          ),
        ),
        const SizedBox(height: 10),
        // The headline: who this child is, from their average score.
        Text(
          rank?.title ?? S.startFirstQuiz,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: AppTheme.deep,
            height: 1.2,
          ),
        ),
        if (collection.averageScore != null) ...[
          const SizedBox(height: 10),
          // Score shown as a filled-star gauge rather than a "84%" label — a
          // glance tells a child whether that's good, where a raw number
          // needs reading and comparing against nothing shown on screen.
          _ScoreStars(scorePercent: collection.averageScore!, color: colors.last),
        ],
      ],
    );
  }
}

/// Five stars, filled in proportion to a 0-100 score. Half-stars land on the
/// nearest 10%, which is plenty of resolution for a glance-read gauge.
class _ScoreStars extends StatelessWidget {
  final int scorePercent;
  final Color color;

  const _ScoreStars({required this.scorePercent, required this.color});

  @override
  Widget build(BuildContext context) {
    final filledTenths = (scorePercent / 10).round().clamp(0, 10);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final starTenths = filledTenths - i * 2;
        final icon = starTenths >= 2
            ? Icons.star_rounded
            : (starTenths == 1 ? Icons.star_half_rounded : Icons.star_border_rounded);
        return Icon(icon, size: 26, color: color);
      }),
    );
  }
}

/// Recently earned badges, newest first — the API already returns them in
/// that order, so this row never re-sorts.
class _RecentBadgeRow extends StatelessWidget {
  final List<QuizBadge> badges;

  const _RecentBadgeRow({required this.badges});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 186,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: badges.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, index) => _BadgeCard(badge: badges[index]),
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final QuizBadge badge;

  const _BadgeCard({required this.badge});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => BadgeGlowView.show(
        context,
        icon: badge.tier.icon,
        colors: badge.tier.colors,
        glow: 1,
        title: S.youHaveEarned(badge.tier.animalName),
        subtitle: badge.quizTitle,
      ),
      child: Container(
        width: 168,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: AppTheme.deep.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: HexBadge(tier: badge.tier, size: 72)),
            const SizedBox(height: 12),
            Text(
              S.youHaveEarned(badge.tier.animalName),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.3,
                color: Colors.black.withValues(alpha: 0.65),
              ),
            ),
            const SizedBox(height: 5),
            // The quiz it came from, in bold blue — the line a child scans
            // for to remember which test this was.
            Text(
              badge.quizTitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
                color: AppTheme.primary,
                height: 1.25,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final Future<void> Function() onRetry;
  final String message;

  const _ErrorState({required this.onRetry, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 44, color: AppTheme.deep.withValues(alpha: 0.4)),
            const SizedBox(height: 12),
            Text('${S.couldNotLoad}\n$message', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: Text(S.tryAgain)),
          ],
        ),
      ),
    );
  }
}
