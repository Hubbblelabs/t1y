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
    setState(() {
      _future = RewardsService.instance.collection();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(S.myBadges),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        titleTextStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
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
              padding: EdgeInsets.zero,
              children: [
                _Hero(collection: data),
                Transform.translate(
                  offset: const Offset(0, -34),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _StatsRow(collection: data),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                  child: _NextRankCard(collection: data),
                ),
                const SizedBox(height: 22),
                _SectionTitle(S.badgeCollection),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _TierGrid(counts: data.countsByTier),
                ),
                const SizedBox(height: 24),
                if (data.badges.isNotEmpty) ...[
                  _SectionTitle(S.recentBadges),
                  const SizedBox(height: 12),
                  _RecentBadgeRow(badges: data.badges),
                ] else
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      S.noBadgesYet,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: AppTheme.inkSoft,
                      ),
                    ),
                  ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w800,
        color: AppTheme.ink,
      ),
    ),
  );
}

/// The headline, on a deep gradient: the glowing badge for how much of the
/// course has been taken, and the name the child's average score has earned.
class _Hero extends StatelessWidget {
  final BadgeCollection collection;

  const _Hero({required this.collection});

  List<Color> get _colors {
    final average = collection.averageScore;
    if (average == null) return const [Color(0xFFCFD8DC), Color(0xFF90A4AE)];
    return BadgeTier.values
        .firstWhere(
          (t) => average >= t.minScore,
          orElse: () => BadgeTier.rising,
        )
        .colors;
  }

  @override
  Widget build(BuildContext context) {
    final rank = collection.rank;
    final colors = _colors;
    final icon = rank?.icon ?? noBadgeIcon;
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;

    return Container(
      padding: EdgeInsets.fromLTRB(20, top + 4, 20, 58),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0B3C8C), AppTheme.deep, AppTheme.primary],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () => BadgeGlowView.show(
              context,
              icon: icon,
              colors: colors,
              glow: collection.attemptedFraction,
              title: rank?.localTitle ?? S.startFirstQuiz,
              subtitle: S.takenOfQuizzes(
                collection.quizzesAttempted,
                collection.totalQuizzes,
              ),
            ),
            child: GlowBadge(
              glow: collection.attemptedFraction,
              icon: icon,
              colors: colors,
              size: 180,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            rank?.localTitle ?? S.startFirstQuiz,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 27,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              height: 1.2,
            ),
          ),
          if (collection.averageScore != null) ...[
            const SizedBox(height: 8),
            _ScoreStars(
              scorePercent: collection.averageScore!,
              color: const Color(0xFFFFD54F),
            ),
          ],
        ],
      ),
    );
  }
}

/// Three numbers a child can be proud of, floating over the hero's edge.
class _StatsRow extends StatelessWidget {
  final BadgeCollection collection;
  const _StatsRow({required this.collection});

  @override
  Widget build(BuildContext context) {
    final average = collection.averageScore;
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: Icons.quiz_rounded,
            value: '${collection.quizzesAttempted}/${collection.totalQuizzes}',
            label: S.quizzesTaken,
            color: AppTheme.primary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatCard(
            icon: Icons.military_tech_rounded,
            value: '${collection.totalBadges}',
            label: S.badgesWon,
            color: const Color(0xFFFF8F00),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatCard(
            icon: Icons.insights_rounded,
            value: average == null ? '—' : '$average%',
            label: S.averageScore,
            color: const Color(0xFF2E7D32),
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 14, 10, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deep.withValues(alpha: 0.12),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: AppTheme.ink,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11.5,
              height: 1.25,
              fontWeight: FontWeight.w600,
              color: AppTheme.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

/// How close the child is to the next name up — a bar, not a lecture.
class _NextRankCard extends StatelessWidget {
  final BadgeCollection collection;
  const _NextRankCard({required this.collection});

  @override
  Widget build(BuildContext context) {
    final average = collection.averageScore;
    final current = collection.rank;
    // Ranks are ordered highest first; the next one up is the lowest bar
    // above the current one.
    LearnerRank? next;
    for (final rank in LearnerRank.values.reversed) {
      if (rank.minAverage > (current?.minAverage ?? -1)) {
        next = rank;
        break;
      }
    }
    final fromScore = current?.minAverage ?? 0;
    final toScore = next?.minAverage ?? 100;
    final progress = average == null || next == null
        ? (next == null ? 1.0 : 0.0)
        : ((average - fromScore) / (toScore - fromScore)).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.trending_up_rounded,
                color: AppTheme.primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  next == null
                      ? S.topRankReached
                      : S.nextRankAt(next.localTitle, next.minAverage),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: const Duration(milliseconds: 900),
              curve: Curves.easeOutCubic,
              builder: (context, value, _) => LinearProgressIndicator(
                value: value,
                minHeight: 10,
                backgroundColor: AppTheme.lightest,
                color: AppTheme.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Every badge there is, two to a row: the ones won in full colour with a
/// count, the ones still to win faded — so there is always something to aim at.
class _TierGrid extends StatelessWidget {
  final Map<BadgeTier, int> counts;
  const _TierGrid({required this.counts});

  @override
  Widget build(BuildContext context) {
    final tiers = BadgeTier.values;
    return Column(
      children: [
        for (var i = 0; i < tiers.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _TierTile(tier: tiers[i], count: counts[tiers[i]] ?? 0)),
              const SizedBox(width: 12),
              Expanded(
                child: i + 1 < tiers.length
                    ? _TierTile(tier: tiers[i + 1], count: counts[tiers[i + 1]] ?? 0)
                    : const SizedBox(),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _TierTile extends StatelessWidget {
  final BadgeTier tier;
  final int count;
  const _TierTile({required this.tier, required this.count});

  @override
  Widget build(BuildContext context) {
    final won = count > 0;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: won
              ? tier.colors.last.withValues(alpha: 0.55)
              : AppTheme.fieldBorder.withValues(alpha: 0.6),
          width: won ? 1.6 : 1,
        ),
      ),
      child: Column(
        children: [
          Opacity(
            opacity: won ? 1 : 0.35,
            child: HexBadge(tier: tier, size: 64),
          ),
          const SizedBox(height: 8),
          Text(
            tier.localLabel,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppTheme.ink,
            ),
          ),
          Text(
            tier.localAnimalName,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.inkSoft,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: won
                  ? tier.colors.last.withValues(alpha: 0.14)
                  : AppTheme.lightest,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              won ? S.tierEarnedCount(count) : S.scoreFrom(tier.minScore),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: won ? AppTheme.ink : AppTheme.inkSoft,
              ),
            ),
          ),
        ],
      ),
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
            : (starTenths == 1
                  ? Icons.star_half_rounded
                  : Icons.star_border_rounded);
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
        title: S.youHaveEarned(badge.tier.localAnimalName),
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
              S.youHaveEarned(badge.tier.localAnimalName),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.3,
                color: AppTheme.inkSoft,
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
            Icon(
              Icons.cloud_off,
              size: 44,
              color: AppTheme.deep.withValues(alpha: 0.4),
            ),
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
