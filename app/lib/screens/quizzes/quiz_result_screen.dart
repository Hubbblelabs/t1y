import 'package:flutter/material.dart';

import '../../models/badge.dart';
import '../../models/quiz.dart';
import '../../l10n/strings.dart';
import '../../services/quiz_service.dart';
import '../../widgets/badge_glow_view.dart';

/// The reward moment after a quiz — the full-screen glow celebration itself,
/// with no separate score/summary screen in front of it.
///
/// The badge is computed locally from the score using the same bands the
/// server uses ([BadgeTier.forScore]) so the celebration is instant. The
/// server independently awards the badge that persists, from the attempt it
/// graded — this screen never tells the backend anything, it only mirrors
/// what the backend will have concluded.
///
/// A score below the lowest band still gets the hamster and a kind word
/// rather than a bare percentage — the encouragement is the feedback, not a
/// number to parse. Tapping anywhere (or the close button) dismisses back to
/// wherever the quiz was opened from, since this replaced the quiz screen on
/// the navigation stack rather than being pushed on top of it.
class QuizResultScreen extends StatelessWidget {
  final Quiz quiz;
  final QuizAttemptResult result;

  const QuizResultScreen({super.key, required this.quiz, required this.result});

  @override
  Widget build(BuildContext context) {
    final tier = BadgeTier.forScore(result.scorePercent);

    return BadgeGlowView(
      icon: tier?.icon ?? noBadgeIcon,
      colors: tier?.colors ?? const [Color(0xFFCFD8DC), Color(0xFF90A4AE)],
      glow: 1,
      title: tier?.localAnimalName ?? S.gaveYourBest,
      subtitle: tier?.localQuote ?? S.tryAgainQuote,
    );
  }
}
