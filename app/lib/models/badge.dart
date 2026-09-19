import 'package:flutter/material.dart';

/// The artwork shown for a quiz with no badge yet — a hamster rather than a
/// padlock. A lock reads as "restricted"; a child who just finished a quiz
/// and scored under [BadgeTier.rising]'s threshold hasn't been denied
/// anything, they just haven't grown into a bigger animal yet. See
/// [BadgeTier.forScore]. The same hamster art is used for [BadgeTier.rising]
/// itself — the app's colour treatment (grey vs. the tier's own gradient) is
/// what tells "not yet" and "just starting out" apart, not the animal.
const String noBadgeIcon = 'assets/badges/hamster.svg';

/// Score bands, mirroring `BadgeTier` in api/prisma/schema.prisma. A quiz
/// scored below [BadgeTier.rising]'s threshold earns no badge at all — the
/// app encourages a retry instead of handing out a participation tier.
///
/// Each tier carries a friendly animal and a line of encouragement. The
/// audience is 6-15: an animal they can name lands where "Silver, 84%" does
/// not, and the quote is what makes a near-miss feel like progress rather
/// than a verdict.
enum BadgeTier {
  gold(
    minScore: 91,
    label: 'Gold',
    animalName: 'Mighty Dragon',
    icon: 'assets/badges/dragon.svg',
    quote: 'Roar! You have truly mastered this one.',
    colors: [Color(0xFFFFD54F), Color(0xFFFF8F00)],
  ),
  silver(
    minScore: 81,
    label: 'Silver',
    animalName: 'Bold Tiger',
    icon: 'assets/badges/tiger.svg',
    quote: 'Brilliant! You pounced on that beautifully.',
    colors: [Color(0xFFB0BEC5), Color(0xFF546E7A)],
  ),
  bronze(
    minScore: 61,
    label: 'Bronze',
    animalName: 'Bright Butterfly',
    icon: 'assets/badges/butterfly.svg',
    quote: 'Great work! You are getting stronger each time.',
    colors: [Color(0xFFE0A96D), Color(0xFF8D5524)],
  ),
  rising(
    minScore: 51,
    label: 'Rising Star',
    animalName: 'Busy Hamster',
    icon: 'assets/badges/hamster.svg',
    quote: 'Nice work — keep those little paws moving!',
    colors: [Color(0xFF81D4FA), Color(0xFF1976D2)],
  );

  final int minScore;
  final String label;
  final String animalName;

  /// Path to a bundled colour SVG illustration — real vector artwork, not a
  /// Unicode emoji character. An emoji glyph's art varies by device/OS font
  /// and can be missing entirely on some; a bundled asset renders identically
  /// everywhere and needs no network access. Draw with [SvgPicture.asset].
  final String icon;
  final String quote;

  /// Gradient for the hexagon badge — light to dark, top-left to
  /// bottom-right.
  final List<Color> colors;

  const BadgeTier({
    required this.minScore,
    required this.label,
    required this.animalName,
    required this.icon,
    required this.quote,
    required this.colors,
  });

  /// The tier a score earns, or null when it earns none. Ordered highest
  /// first, so the first band a score clears wins — matching
  /// `tierForScore` in api/lib/services/badges.ts.
  static BadgeTier? forScore(int scorePercent) {
    for (final tier in BadgeTier.values) {
      if (scorePercent >= tier.minScore) return tier;
    }
    return null;
  }

  static BadgeTier? fromName(String? name) {
    if (name == null) return null;
    final lower = name.toLowerCase();
    for (final tier in BadgeTier.values) {
      if (tier.name == lower) return tier;
    }
    return null;
  }
}

/// What a child is *called* on the rewards screen, from their average best
/// score across the quizzes they've taken.
///
/// Distinct from [BadgeTier], which grades a single quiz: this is the
/// standing that summarises all of them, and it is the headline the screen
/// is built around.
enum LearnerRank {
  champion(
    minAverage: 95,
    title: 'Diabetes Champion',
    icon: 'assets/badges/dragon.svg',
  ),
  star(minAverage: 85, title: 'Star Learner', icon: 'assets/badges/tiger.svg'),
  explorer(
    minAverage: 80,
    title: 'Bright Explorer',
    icon: 'assets/badges/butterfly.svg',
  ),
  climber(
    minAverage: 65,
    title: 'Steady Climber',
    icon: 'assets/badges/hamster.svg',
  ),
  sprout(
    minAverage: 0,
    title: 'Curious Sprout',
    icon: 'assets/badges/hamster.svg',
  );

  final int minAverage;
  final String title;

  /// Path to a bundled colour SVG, not an emoji character — see
  /// [BadgeTier.icon].
  final String icon;

  const LearnerRank({
    required this.minAverage,
    required this.title,
    required this.icon,
  });

  /// Null when there is no average yet — a rank invented from no completed
  /// quizzes would be an achievement the child hasn't had a chance to earn.
  static LearnerRank? forAverage(int? average) {
    if (average == null) return null;
    for (final rank in LearnerRank.values) {
      if (average >= rank.minAverage) return rank;
    }
    return LearnerRank.sprout;
  }
}

/// A badge the child holds — always their best result for that quiz.
class QuizBadge {
  final String quizId;
  final String quizSlug;
  final String quizTitle;
  final BadgeTier tier;
  final int scorePercent;
  final DateTime earnedAt;

  const QuizBadge({
    required this.quizId,
    required this.quizSlug,
    required this.quizTitle,
    required this.tier,
    required this.scorePercent,
    required this.earnedAt,
  });

  static QuizBadge? fromJson(Map<String, dynamic> json) {
    final tier = BadgeTier.fromName(json['tier'] as String?);
    if (tier == null) return null;
    return QuizBadge(
      quizId: json['quizId'] as String,
      quizSlug: json['quizSlug'] as String? ?? '',
      quizTitle: json['quizTitle'] as String? ?? '',
      tier: tier,
      scorePercent: json['scorePercent'] as int? ?? 0,
      earnedAt:
          DateTime.tryParse(json['earnedAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

/// Everything the trophy screen shows, in one payload.
class BadgeCollection {
  final List<QuizBadge> badges;
  final int totalBadges;

  /// Published quizzes overall, so the screen can show what is still
  /// unbadged rather than only what's been won.
  final int totalQuizzes;

  /// Distinct quizzes completed at least once. This is what the centre
  /// badge's glow represents — how much of the course has been *taken*.
  final int quizzesAttempted;

  /// Mean best-score across those quizzes, or null before the first one.
  final int? averageScore;

  final Map<BadgeTier, int> countsByTier;

  const BadgeCollection({
    required this.badges,
    required this.totalBadges,
    required this.totalQuizzes,
    required this.quizzesAttempted,
    required this.averageScore,
    required this.countsByTier,
  });

  static const empty = BadgeCollection(
    badges: [],
    totalBadges: 0,
    totalQuizzes: 0,
    quizzesAttempted: 0,
    averageScore: null,
    countsByTier: {},
  );

  /// Fraction of published quizzes taken, 0-1. Drives the glow, and clamped
  /// because `totalQuizzes` can lag behind attempts if a quiz is unpublished
  /// after a child has already sat it.
  double get attemptedFraction {
    if (totalQuizzes <= 0) return 0;
    return (quizzesAttempted / totalQuizzes).clamp(0.0, 1.0);
  }

  LearnerRank? get rank => LearnerRank.forAverage(averageScore);

  factory BadgeCollection.fromJson(Map<String, dynamic> json) {
    final rawCounts = json['countsByTier'] as Map<String, dynamic>? ?? {};
    final counts = <BadgeTier, int>{};
    for (final entry in rawCounts.entries) {
      final tier = BadgeTier.fromName(entry.key);
      if (tier != null) counts[tier] = entry.value as int? ?? 0;
    }

    return BadgeCollection(
      badges: (json['badges'] as List<dynamic>? ?? [])
          .map((b) => QuizBadge.fromJson(b as Map<String, dynamic>))
          .whereType<QuizBadge>()
          .toList(),
      totalBadges: json['totalBadges'] as int? ?? 0,
      totalQuizzes: json['totalQuizzes'] as int? ?? 0,
      quizzesAttempted: json['quizzesAttempted'] as int? ?? 0,
      averageScore: json['averageScore'] as int?,
      countsByTier: counts,
    );
  }
}
