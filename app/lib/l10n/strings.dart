import '../providers/app_state.dart';

/// UI chrome strings in English and Tamil.
///
/// Deliberately a plain map rather than ARB + `gen_l10n`: this app has no
/// codegen step, the string count is small, and every lookup is already
/// funnelled through [AppState]'s locale. Curriculum content is NOT here —
/// that comes from the backend, translated by the study team.
///
/// ⚠️ These Tamil strings are UI chrome written for the app, not extracted
/// from the study's source documents. They should be reviewed by a Tamil
/// speaker on the study team before the trial runs, the same way the
/// curriculum translations were.
class S {
  S._();

  static String get _l => AppState.instance.locale;

  static String _t(String en, String ta) => _l == 'ta' ? ta : en;

  // ── Navigation ───────────────────────────────────────────────────────────
  static String get home => _t('Home', 'முகப்பு');
  static String get helpBook => _t('Help Book', 'உதவி புத்தகம்');
  static String get calculations => _t('Calculations', 'கணக்கீடுகள்');
  static String get quizzes => _t('Quizzes', 'வினாடி வினா');
  static String get profile => _t('Profile', 'சுயவிவரம்');

  // ── Shared states ────────────────────────────────────────────────────────
  static String get loading => _t('Loading…', 'ஏற்றுகிறது…');
  static String get tryAgain => _t('Try again', 'மீண்டும் முயற்சிக்கவும்');
  static String get retry => _t('Retry', 'மீண்டும்');
  static String get close => _t('Close', 'மூடு');
  static String get cancel => _t('Cancel', 'ரத்து செய்');
  static String get save => _t('Save', 'சேமி');
  static String get couldNotLoad =>
      _t('Could not load content.', 'உள்ளடக்கத்தை ஏற்ற முடியவில்லை.');
  static String get offlineHint => _t(
    'You appear to be offline. Showing the last downloaded copy.',
    'நீங்கள் இணையத்தில் இல்லை எனத் தெரிகிறது. கடைசியாகப் பதிவிறக்கியது காட்டப்படுகிறது.',
  );

  // ── Help Book ────────────────────────────────────────────────────────────
  static String get noTopicsYet =>
      _t('No topics published yet.', 'இதுவரை தலைப்புகள் எதுவும் இல்லை.');
  static String get noContentYet =>
      _t('No content yet.', 'இதுவரை உள்ளடக்கம் இல்லை.');
  static String get yourLearning => _t('Your learning', 'உங்கள் கற்றல்');
  static String topicsRead(int read, int total) =>
      _t('$read of $total topics read', '$total-ல் $read தலைப்புகள் படிக்கப்பட்டன');
  static String get read => _t('Read', 'படித்தது');
  static String get markAsRead => _t('Mark as read', 'படித்ததாகக் குறி');
  static String get markedAsRead => _t('Marked as read', 'படித்ததாகக் குறிக்கப்பட்டது');
  static String get englishOnly => _t('English only', 'ஆங்கிலம் மட்டும்');
  static String get tamilNotPublished => _t(
    "A Tamil translation isn't published yet — showing English.",
    'தமிழ் மொழிபெயர்ப்பு இதுவரை வெளியிடப்படவில்லை — ஆங்கிலம் காட்டப்படுகிறது.',
  );
  static String minutesRead(int minutes) => _t('$minutes min', '$minutes நிமிடம்');

  // ── Language ─────────────────────────────────────────────────────────────
  static String get language => _t('Language', 'மொழி');
  static String get switchLanguage => _t('Switch language', 'மொழியை மாற்று');
  static String get english => 'English';
  static String get tamil => 'தமிழ்';

  // ── Calculations ─────────────────────────────────────────────────────────
  static String get ruleOf15 => _t('Rule of 15', '15 விதி');
  static String get ruleOf15Subtitle => _t(
    'Hypoglycaemia — how much fast-acting sugar to take',
    'இரத்தச் சர்க்கரைக் குறைவு — எவ்வளவு சர்க்கரை எடுக்க வேண்டும்',
  );
  static String get icIsf => _t('IC / ISF Calculator', 'IC / ISF கணிப்பான்');
  static String get icIsfSubtitle => _t(
    'Insulin-to-carb ratio and correction factor',
    'இன்சுலின்-கார்ப் விகிதம் மற்றும் திருத்தக் காரணி',
  );
  static String get lockedNeedsCareTeam =>
      _t('Locked — needs your care team', 'பூட்டப்பட்டுள்ளது — மருத்துவக் குழு தேவை');
  static String get whyLocked => _t('Why is this locked?', 'இது ஏன் பூட்டப்பட்டுள்ளது?');
  static String get howToUnlock => _t('How to unlock it', 'எப்படித் திறப்பது');

  // ── Quizzes ──────────────────────────────────────────────────────────────
  static String get noQuizzesYet =>
      _t('No quizzes published yet.', 'இதுவரை வினாடி வினா எதுவும் இல்லை.');
  static String get startQuiz => _t('Start quiz', 'வினாடி வினாவைத் தொடங்கு');
  static String get submit => _t('Submit', 'சமர்ப்பி');
  static String get next => _t('Next', 'அடுத்து');
  static String get yourScore => _t('Your score', 'உங்கள் மதிப்பெண்');

  // ── Profile ──────────────────────────────────────────────────────────────
  static String get account => _t('Account', 'கணக்கு');
  static String get signOut => _t('Sign out', 'வெளியேறு');
  static String get settings => _t('Settings', 'அமைப்புகள்');
  static String get notifications => _t('Notifications', 'அறிவிப்புகள்');
  static String get reminders => _t('Reminders', 'நினைவூட்டல்கள்');
  static String get remindersSubtitle => _t(
    'Insulin, glucose checks and annual screening reminders.',
    'இன்சுலின், சர்க்கரை பரிசோதனை மற்றும் வருடாந்திர பரிசோதனை நினைவூட்டல்கள்.',
  );
  static String get privacyAndData => _t('Privacy & data', 'தனியுரிமை & தரவு');
  static String get checkForNewContent =>
      _t('Check for new content', 'புதிய உள்ளடக்கத்தைச் சரிபார்');
  static String get contentUpToDate =>
      _t('Content is up to date.', 'உள்ளடக்கம் புதுப்பித்த நிலையில் உள்ளது.');
  static String get contentUpdated =>
      _t('New content downloaded.', 'புதிய உள்ளடக்கம் பதிவிறக்கப்பட்டது.');
  static String get couldNotReachServer => _t(
    'Could not reach the server. Try again later.',
    'சேவையகத்தை அணுக முடியவில்லை. பின்னர் முயற்சிக்கவும்.',
  );
  static String get lastUpdated => _t('Last updated', 'கடைசியாகப் புதுப்பிக்கப்பட்டது');
  static String get never => _t('Never', 'இதுவரை இல்லை');
  static String get tapToFlip => _t('Tap for settings', 'அமைப்புகளுக்குத் தட்டவும்');
  static String get backToCard => _t('Back to card', 'அட்டைக்குத் திரும்பு');
  static String get participant => _t('Participant', 'பங்கேற்பாளர்');
  static String get studyParticipant =>
      _t('Type 1 Diabetes · Study participant', 'வகை 1 நீரிழிவு · ஆய்வுப் பங்கேற்பாளர்');
  static String get idNo => _t('ID No.', 'அடையாள எண்');
  static String get age => _t('Age', 'வயது');
  static String years(int n) => _t('$n years', '$n வயது');
  static String get dateOfBirth => _t('Date of birth', 'பிறந்த தேதி');
  static String get sex => _t('Sex', 'பாலினம்');
  static String get diagnosed => _t('Diagnosed', 'கண்டறியப்பட்டது');
  static String get female => _t('Female', 'பெண்');
  static String get male => _t('Male', 'ஆண்');
  static String get notStated => _t('Not stated', 'குறிப்பிடவில்லை');

  // ── Home ─────────────────────────────────────────────────────────────────
  static String greeting(String name) =>
      _t('Hello, $name', 'வணக்கம், $name');
  static String get continueReading => _t('Continue where you left off', 'நிறுத்திய இடத்திலிருந்து தொடரவும்');
  static String get startLearning => _t('Start learning', 'கற்கத் தொடங்குங்கள்');
  static String get tipOfTheDay => _t('Tip of the day', 'இன்றைய குறிப்பு');
  static String get yourProgress => _t('Your progress', 'உங்கள் முன்னேற்றம்');
  static String get quickActions => _t('Quick actions', 'விரைவு செயல்கள்');
  static String get allTopicsDone =>
      _t('All topics read. Well done!', 'அனைத்து தலைப்புகளும் படித்தாகிவிட்டது. வாழ்த்துக்கள்!');

  // ── Terms ────────────────────────────────────────────────────────────────
  static String get termsTitle => _t('Terms & Conditions', 'விதிமுறைகள் & நிபந்தனைகள்');
  static String get iAgree => _t('I Agree', 'நான் ஒப்புக்கொள்கிறேன்');
}
