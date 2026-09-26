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

  /// Set only while [inLocale] is reading a string, so a screen can ask for
  /// the same wording in each language without touching the app's language.
  static String? _forced;

  static String get _l => _forced ?? AppState.instance.locale;

  /// Reads [read] as if the app were set to [locale]. Synchronous and restored
  /// afterwards, so nothing else observes the change and no listener fires.
  static T inLocale<T>(String locale, T Function() read) {
    final previous = _forced;
    _forced = locale;
    try {
      return read();
    } finally {
      _forced = previous;
    }
  }

  /// One string in both languages, for the sign-in and sign-up screens, which
  /// show English with the Tamil beneath rather than following a language
  /// switch. Reusing the existing strings keeps a single source for the Tamil.
  static ({String en, String ta}) both(String Function() read) =>
      (en: inLocale('en', read), ta: inLocale('ta', read));


  static String _t(String en, String ta) => _l == 'ta' ? ta : en;

  // ── Errors from the server and the network ───────────────────────────────
  /// A server or network message in the app's language. The server writes in
  /// English; in Tamil the known messages are translated, and any other one is
  /// replaced by a Tamil line for its kind of problem rather than shown in
  /// English.
  static String apiMessage(int status, String code, String raw) {
    if (_l != 'ta') return raw;
    final m = raw.toLowerCase();
    bool has(String s) => m.contains(s);

    if (code == 'TIMEOUT') {
      return 'சேவையகம் பதிலளிக்க நீண்ட நேரம் ஆகிறது. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';
    }
    if (code == 'NETWORK') {
      return 'சேவையகத்தை அடைய முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';
    }
    if (code == 'EMAIL_NOT_VERIFIED' || has('yet to be updated by the admin')) {
      return 'உங்கள் நிலையை நிர்வாகி இன்னும் புதுப்பிக்கவில்லை. பொறுமைக்கு நன்றி.';
    }
    if (has('already sent')) {
      return 'இன்று நீங்கள் ஏற்கனவே 3 செய்திகளை அனுப்பிவிட்டீர்கள். நாளை மேலும் அனுப்பலாம் — குழு இங்கே பதிலளிக்கும்.';
    }
    if (has("didn't match") ||
        has('invalid email or password') ||
        code == 'INVALID_EMAIL_OR_PASSWORD' ||
        has('sign-in failed')) {
      return 'உள்நுழைவு விவரங்கள் பொருந்தவில்லை. சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';
    }
    if (has('4-digit pin') || has('enter a 4')) {
      return '4 இலக்க பின்னை உள்ளிடவும்.';
    }
    if (has('no pin has been set')) {
      return 'இன்னும் பின் அமைக்கப்படவில்லை. முதலில் சுயவிவரத்தில் அமைக்கவும்.';
    }
    if (has('already exists') || code.contains('ALREADY_EXISTS')) {
      return 'இந்த விவரங்களுடன் ஒரு கணக்கு ஏற்கனவே உள்ளது.';
    }
    if (has('too short') || has('at least')) {
      return 'கடவுச்சொல் மிகச் சிறியதாக உள்ளது. நீளமான ஒன்றைத் தேர்ந்தெடுக்கவும்.';
    }
    if (has('too long') || has('at most')) {
      return 'கடவுச்சொல் மிக நீளமாக உள்ளது. சிறியதைத் தேர்ந்தெடுக்கவும்.';
    }
    if (has('not part of this household')) {
      return 'அந்தக் குழந்தை இந்தக் குடும்பத்தில் இல்லை.';
    }
    if (has('unexpected response')) {
      return 'சேவையகத்திலிருந்து எதிர்பாராத பதில் வந்தது. மீண்டும் முயற்சிக்கவும்.';
    }

    switch (code) {
      case 'SYNC_REJECTED':
        return 'உங்கள் முயற்சியைச் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';
      case 'VALIDATION_ERROR':
        return 'நீங்கள் உள்ளிட்டதைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.';
      case 'UNAUTHENTICATED':
        return 'உங்கள் அமர்வு முடிந்துவிட்டது. மீண்டும் உள்நுழையவும்.';
      case 'FORBIDDEN':
        return 'இதைச் செய்ய உங்களுக்கு அனுமதி இல்லை.';
      case 'NOT_FOUND':
        return 'நீங்கள் தேடியது கிடைக்கவில்லை.';
      case 'CONFLICT':
        return 'இது ஏற்கனவே உள்ளது அல்லது மாறிவிட்டது. புதுப்பித்து மீண்டும் முயற்சிக்கவும்.';
      case 'RATE_LIMITED':
        return 'மிக அதிகமான கோரிக்கைகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.';
      case 'SERVICE_UNAVAILABLE':
        return 'சேவை தற்போது கிடைக்கவில்லை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.';
    }
    if (status >= 500) {
      return 'ஏதோ தவறு நடந்துவிட்டது. சிறிது நேரம் கழித்து முயற்சிக்கவும்.';
    }
    return 'ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயற்சிக்கவும்.';
  }

  // ── Messages that used to be English only ────────────────────────────────
  /// One string as "English\nTamil", for the sign-in and sign-up screens,
  /// which always show both.
  static String bothText(String Function() read) => both(read).en;

  static String get screenFailed => _t(
    'Something went wrong showing this part of the screen. Please go back and try again.',
    'திரையின் இந்தப் பகுதியைக் காட்டுவதில் தவறு ஏற்பட்டது. தயவுசெய்து திரும்பிச் சென்று மீண்டும் முயற்சிக்கவும்.',
  );
  static String get couldNotReach => _t(
    'Could not reach the server. Check your connection and try again.',
    'சேவையகத்தை அடைய முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  );
  static String get tryAgainLabel => _t('Try again', 'மீண்டும் முயற்சிக்கவும்');
  static String passwordTooShort(int n) => _t(
    'Password must be at least $n characters.',
    'கடவுச்சொல் குறைந்தது $n எழுத்துகள் இருக்க வேண்டும்.',
  );
  static String get passwordRule => _t(
    'Use at least 8 characters, with both letters and numbers.',
    'குறைந்தது 8 எழுத்துகள் பயன்படுத்தவும்; எழுத்துகளும் எண்களும் இரண்டும் இருக்க வேண்டும்.',
  );
  static String passwordTooLong(int n) => _t(
    'Password must be at most $n characters.',
    'கடவுச்சொல் அதிகபட்சம் $n எழுத்துகள் இருக்கலாம்.',
  );
  static String get passwordsDontMatch =>
      _t('Passwords do not match.', 'கடவுச்சொற்கள் பொருந்தவில்லை.');
  static String get passwordSameAsOld => _t(
    'Choose a password different from the one you signed in with.',
    'நீங்கள் உள்நுழைந்த கடவுச்சொல்லிலிருந்து வேறுபட்ட ஒன்றைத் தேர்ந்தெடுக்கவும்.',
  );
  static String get welcomeToApp => _t(
    'Welcome to T1D Prajana Yandra',
    'T1D பிரஜன யந்திரத்திற்கு வரவேற்கிறோம்',
  );
  static String get setOwnPassword => _t(
    'Please set your own password to continue',
    'தொடர, உங்கள் சொந்த கடவுச்சொல்லை அமைக்கவும்',
  );
  static String get setNewPasswordHint =>
      _t('Set your new password', 'உங்கள் புதிய கடவுச்சொல்லை அமைக்கவும்');
  static String get confirmNewPassword =>
      _t('Confirm new password', 'புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்');
  static String get retypeNewPassword => _t(
    'Re-type your new password',
    'உங்கள் புதிய கடவுச்சொல்லை மீண்டும் உள்ளிடவும்',
  );
  static String get changePasswordContinue =>
      _t('Change password & continue', 'கடவுச்சொல்லை மாற்றி தொடரவும்');

  // Sign-up answers
  static String get answerRequired => _t('This is required.', 'இது கட்டாயம்.');
  static String get chooseOption => _t(
    'Choose one of the options.',
    'விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்.',
  );
  static String validYear(int y) =>
      _t('Enter a valid year, e.g. $y.', 'சரியான ஆண்டை உள்ளிடவும், எ.கா. $y.');
  static String get validNumber =>
      _t('Enter a valid number.', 'சரியான எண்ணை உள்ளிடவும்.');
  static String get validDate =>
      _t('Enter a valid date.', 'சரியான தேதியை உள்ளிடவும்.');
  static String get tapToChooseDate =>
      _t('Tap to choose a date', 'தேதியைத் தேர்ந்தெடுக்கத் தட்டவும்');
  static String get typeYourAnswer =>
      _t('Type your answer', 'உங்கள் பதிலை உள்ளிடவும்');
  static String get editLabel => _t('Edit', 'திருத்து');
  static String get copyLabel => _t('Copy', 'நகலெடு');
  static String get copiedLabel => _t('Copied', 'நகலெடுக்கப்பட்டது');
  static String get skipLabel => _t('Skip', 'தவிர்');

  // Answer rules (profile and calculators)
  static String mustBeText(String l) =>
      _t('"$l" must be text.', '"$l" உரையாக இருக்க வேண்டும்.');
  static String needsAtLeastChars(String l, int n) => _t(
    '"$l" needs at least $n characters.',
    '"$l" குறைந்தது $n எழுத்துகள் இருக்க வேண்டும்.',
  );
  static String keepUnder(String l, int n) => _t(
    'Please keep "$l" under $n characters.',
    '"$l" $n எழுத்துகளுக்குள் இருக்கட்டும்.',
  );
  static String lettersOnly(String l) => _t(
    '"$l" should use letters only.',
    '"$l" எழுத்துகளை மட்டும் கொண்டிருக்க வேண்டும்.',
  );
  static String mustBeNumber(String l) =>
      _t('"$l" must be a number.', '"$l" ஒரு எண்ணாக இருக்க வேண்டும்.');
  static String mustBeWhole(String l) =>
      _t('"$l" must be a whole number.', '"$l" முழு எண்ணாக இருக்க வேண்டும்.');
  static String cannotBeLess(String l, String v) => _t(
    '"$l" cannot be less than $v.',
    '"$l" $v-க்குக் குறைவாக இருக்கக்கூடாது.',
  );
  static String cannotBeMore(String l, String v) =>
      _t('"$l" cannot be more than $v.', '"$l" $v-க்கு மேல் இருக்கக்கூடாது.');
  static String cannotBeLaterThan(String l, int year) => _t(
    '"$l" cannot be later than $year.',
    '"$l" $year-க்குப் பிறகு இருக்கக்கூடாது.',
  );
  static String cannotBeEarlierThan(String l, int year) => _t(
    '"$l" cannot be earlier than $year. Please check the year.',
    '"$l" $year-க்கு முன் இருக்கக்கூடாது. ஆண்டைச் சரிபார்க்கவும்.',
  );
  static String mustBeValidDate(String l) =>
      _t('"$l" must be a valid date.', '"$l" சரியான தேதியாக இருக்க வேண்டும்.');
  static String cannotBeFuture(String l) => _t(
    '"$l" cannot be in the future.',
    '"$l" எதிர்காலத் தேதியாக இருக்கக்கூடாது.',
  );
  static String dateTooRecent(String l) => _t(
    '"$l" is too recent. Please check the date.',
    '"$l" மிகச் சமீபத்தியது. தேதியைச் சரிபார்க்கவும்.',
  );
  static String dateTooOld(String l) => _t(
    '"$l" is too long ago. Please check the date.',
    '"$l" மிகவும் பழையது. தேதியைச் சரிபார்க்கவும்.',
  );

  // Times
  static String get dueNow => _t('due now', 'இப்போது');
  static String inMinutes(int n) => _t('in $n min', '$n நிமிடத்தில்');
  static String inHours(int n) => _t('in $n h', '$n மணியில்');
  static String inDays(int n) => _t('in $n d', '$n நாளில்');
  static String get justNow => _t('just now', 'இப்போது');
  static String minutesAgo(int n) => _t('$n min ago', '$n நிமிடம் முன்');
  static String hoursAgo(int n) => _t('$n h ago', '$n மணி முன்');
  static String daysAgo(int n) => _t('$n d ago', '$n நாள் முன்');
  static String get readLabel => _t('Read', 'படித்தது');

  // Loading screens
  static String get signingYouIn =>
      _t('Signing you in', 'உங்களை உள்நுழைக்கிறோம்');
  static String get welcomeBackApp => _t(
    'welcome back to T1D Prajana Yandra',
    'T1D பிரஜன யந்திரத்திற்கு மீண்டும் வரவேற்கிறோம்',
  );
  static String get loadingHelpBook =>
      _t('Loading your Help Book', 'உங்கள் உதவி புத்தகத்தை ஏற்றுகிறோம்');
  static String get preparingHelpBook => _t(
    'Preparing your Help Book',
    'உங்கள் உதவி புத்தகத்தைத் தயார் செய்கிறோம்',
  );
  static String get topicsBothLanguages => _t(
    '8 topics, in English and Tamil',
    '8 தலைப்புகள், ஆங்கிலத்திலும் தமிழிலும்',
  );
  static String get quizzesGettingReady =>
      _t('Getting your quizzes ready', 'உங்கள் தேர்வுகளைத் தயார் செய்கிறோம்');
  static String get checkAsYouLearn => _t(
    'so you can check understanding as you learn',
    'கற்றுக்கொள்ளும்போதே புரிதலைச் சோதிக்கலாம்',
  );
  static String get almostDone => _t('Almost done', 'கிட்டத்தட்ட முடிந்தது');
  static String get momentMore =>
      _t('just a moment more', 'இன்னும் சிறிது நேரம்');
  static String get creatingAccount =>
      _t('Creating your account', 'உங்கள் கணக்கை உருவாக்குகிறோம்');
  static String get forTheStudy =>
      _t('for the T1D Prajana Yandra study', 'T1D பிரஜன யந்திர ஆய்வுக்காக');

  // ── Navigation ───────────────────────────────────────────────────────────
  static String get home => _t('Home', 'முகப்பு');
  static String get helpBook => _t('Help Book', 'உதவி புத்தகம்');
  static String get quizzes => _t('Quizzes', 'வினாடி வினா');
  static String get profile => _t('Profile', 'சுயவிவரம்');

  // ── Shared states ────────────────────────────────────────────────────────
  static String get loading => _t('Loading…', 'ஏற்றுகிறது…');
  static String get tryAgain => _t('Try again', 'மீண்டும் முயற்சிக்கவும்');
  static String get close => _t('Close', 'மூடு');
  static String get cancel => _t('Cancel', 'ரத்து செய்');
  static String get save => _t('Save', 'சேமி');
  static String get couldNotLoad =>
      _t('Could not load content.', 'உள்ளடக்கத்தை ஏற்ற முடியவில்லை.');

  // ── Help Book ────────────────────────────────────────────────────────────
  static String get noTopicsYet =>
      _t('No topics published yet.', 'இதுவரை தலைப்புகள் எதுவும் இல்லை.');
  static String get noContentYet =>
      _t('No content yet.', 'இதுவரை உள்ளடக்கம் இல்லை.');
  static String topicsRead(int read, int total) => _t(
    '$read of $total topics read',
    '$total-ல் $read தலைப்புகள் படிக்கப்பட்டன',
  );
  static String get read => _t('Read', 'படித்தது');
  static String get markAsRead => _t('Mark as read', 'படித்ததாகக் குறி');
  static String get markedAsRead =>
      _t('Marked as read', 'படித்ததாகக் குறிக்கப்பட்டது');
  static String get quizNotInTamil => _t(
    'This quiz is not available in Tamil yet. Please take it in English.',
    'இந்தத் தேர்வு இன்னும் தமிழில் இல்லை. தயவுசெய்து ஆங்கிலத்தில் எழுதுங்கள்.',
  );
  static String get takeInEnglish =>
      _t('Take in English', 'ஆங்கிலத்தில் எழுது');
  static String get englishOnly => _t('English only', 'ஆங்கிலம் மட்டும்');
  static String get tamilNotPublished => _t(
    "A Tamil translation isn't published yet — showing English.",
    'தமிழ் மொழிபெயர்ப்பு இதுவரை வெளியிடப்படவில்லை — ஆங்கிலம் காட்டப்படுகிறது.',
  );
  static String minutesRead(int minutes) =>
      _t('$minutes min', '$minutes நிமிடம்');
  static String get previousTopic => _t('Previous', 'முந்தையது');
  static String get nextTopic => _t('Next', 'அடுத்தது');

  // ── Language ─────────────────────────────────────────────────────────────
  static String get language => _t('Language', 'மொழி');
  static String get pendingApprovalTitle =>
      _t('Almost there', 'கிட்டத்தட்ட முடிந்தது');
  static String get pendingApprovalBody => _t(
    'Your status is yet to be updated by the admin. Thank you for your patience — '
        "you'll be able to sign in as soon as your enrolment is accepted.",
    'உங்கள் நிலை நிர்வாகியால் இன்னும் புதுப்பிக்கப்படவில்லை. உங்கள் பொறுமைக்கு நன்றி — '
        'உங்கள் பதிவு ஏற்றுக்கொள்ளப்பட்டவுடன் நீங்கள் உள்நுழையலாம்.',
  );
  static String get backToStart =>
      _t('Back to start', 'தொடக்கத்திற்குத் திரும்பு');

  // ── Calculations ─────────────────────────────────────────────────────────


  // ── Sign in / sign up (always shown in both languages) ───────────────────
  static String get getStarted => _t('Get Started', 'தொடங்குங்கள்');
  static String get createAccount => _t('Create Account', 'கணக்கை உருவாக்கு');
  static String get newPassword => _t('New password', 'புதிய கடவுச்சொல்');
  static String get setYourPassword =>
      _t('Set your password', 'உங்கள் கடவுச்சொல்லை அமைக்கவும்');
  static String get confirmPassword =>
      _t('Confirm password', 'கடவுச்சொல்லை உறுதிப்படுத்து');
  static String get retypePassword =>
      _t('Re-type your password', 'கடவுச்சொல்லை மீண்டும் உள்ளிடவும்');
  static String get beforeWeBegin =>
      _t('Before We Begin...', 'தொடங்கும் முன்...');
  static String get readTerms => _t(
    'Read Terms & Conditions',
    'விதிமுறைகள் மற்றும் நிபந்தனைகளைப் படிக்கவும்',
  );

  // ── Home ─────────────────────────────────────────────────────────────────
  static String get thisWeek => _t('This week', 'இந்த வாரம்');
  static String get moreForYou => _t('More for you', 'உங்களுக்காக மேலும்');
  static String learningProgress(int read, int total) => _t(
    '$read of $total topics read',
    '$total-ல் $read தலைப்புகள் படிக்கப்பட்டன',
  );
  static String get keepGoing => _t(
    'Keep going — you are doing well.',
    'தொடருங்கள் — நீங்கள் நன்றாகச் செய்கிறீர்கள்.',
  );
  static String get allTopicsRead => _t(
    'You have read every topic. Well done!',
    'எல்லா தலைப்புகளையும் படித்துவிட்டீர்கள். பாராட்டுகள்!',
  );
  static String quizzesReady(int n) => _t('$n to try', '$n முயற்சிக்க');
  static String get testWhatYouLearn =>
      _t('Test what you learn', 'கற்றதைச் சோதியுங்கள்');
  static String get recordDose => _t('Record a dose', 'அளவைப் பதிவு செய்');
  static String get newAnswerFromTeam =>
      _t('New answer from the team', 'குழுவிடமிருந்து புதிய பதில்');
  static String get questionsAndAnswers =>
      _t('Questions and answers', 'கேள்விகள் மற்றும் பதில்கள்');

  // ── Insulin ──────────────────────────────────────────────────────────────
  static String get insulin => _t('Insulin', 'இன்சுலின்');
  static String todayTotal(String units) =>
      _t('Today: $units units', 'இன்று: $units யூனிட்கள்');
  static String get doseSaved =>
      _t('Dose recorded', 'அளவு பதிவு செய்யப்பட்டது');
  static String get badDose => _t(
    'Please check the dose — it should be more than 0 and no more than 300 units.',
    'அளவைச் சரிபார்க்கவும் — அது 0-க்கு மேல் 300 யூனிட்களுக்குள் இருக்க வேண்டும்.',
  );

  // ── Carbohydrates ────────────────────────────────────────────────────────
  static String get carbs => _t('Carbs', 'கார்போஹைட்ரேட்');
  static String get logCarbs =>
      _t('Record carbohydrates', 'கார்போஹைட்ரேட்டைப் பதிவு செய்');
  static String get carbsSaved => _t('Recorded', 'பதிவு செய்யப்பட்டது');
  static String get badCarbs => _t(
    'Please check the amount — it should be more than 0 and no more than 500g.',
    'அளவைச் சரிபார்க்கவும் — அது 0-க்கு மேல் 500 கிராமுக்குள் இருக்க வேண்டும்.',
  );

  // ── Help and support ─────────────────────────────────────────────────────
  static String get helpAndSupport =>
      _t('Help and support', 'உதவி மற்றும் ஆதரவு');
  static String get helpIntro => _t(
    "Ask the study team about your child's care or the app. They will reply here.",
    'உங்கள் குழந்தையின் பராமரிப்பு அல்லது செயலி பற்றி ஆய்வுக் குழுவிடம் கேளுங்கள். அவர்கள் இங்கே பதிலளிப்பார்கள்.',
  );
  static String get askAQuestion => _t('Ask a question', 'கேள்வி கேளுங்கள்');
  static String get noQuestionsYet => _t(
    "You haven't asked anything yet.",
    'நீங்கள் இதுவரை எதுவும் கேட்கவில்லை.',
  );
  static String get stateSent => _t('Sent', 'அனுப்பப்பட்டது');
  static String get stateSeen => _t('Seen by the team', 'குழு பார்த்தது');
  static String get stateReplied => _t('Replied', 'பதிலளிக்கப்பட்டது');
  static String get stateClosed => _t('Closed', 'முடிக்கப்பட்டது');
  static String get send => _t('Send', 'அனுப்பு');
  static String messagesLeftToday(int left, int limit) => _t(
    '$left of $limit messages left today',
    'இன்று $limit-ல் $left செய்திகள் மீதமுள்ளன',
  );
  static String get dailyLimitReached => _t(
    'You have sent all your messages for today. You can send more tomorrow — the team will reply here.',
    'இன்றைய செய்திகள் அனைத்தையும் அனுப்பிவிட்டீர்கள். நாளை மேலும் அனுப்பலாம் — குழு இங்கே பதிலளிக்கும்.',
  );
  static String get writeReply => _t('Write a reply…', 'பதிலை எழுதுங்கள்…');
  static String get studyTeam => _t('Study team', 'ஆய்வுக் குழு');
  static String get you => _t('You', 'நீங்கள்');
  static String get newAnswer => _t('New answer', 'புதிய பதில்');
  static String get needMessage =>
      _t('Please write your message.', 'உங்கள் செய்தியை எழுதுங்கள்.');

  // ── Quizzes ──────────────────────────────────────────────────────────────
  static String get noQuizzesYet =>
      _t('No quizzes published yet.', 'இதுவரை வினாடி வினா எதுவும் இல்லை.');
  static String get answered => _t('Answered', 'பதிலளிக்கப்பட்டது');
  static String get unanswered => _t('Unanswered', 'பதிலளிக்கப்படவில்லை');
  static String answeredOfTotal(int answered, int total) => _t(
    '$answered of $total answered',
    '$total-ல் $answered பதிலளிக்கப்பட்டது',
  );
  static String get submitQuiz => _t('Submit quiz', 'வினாடி வினாவைச் சமர்ப்பி');
  static String get questionNumber => _t('Question', 'கேள்வி');
  static String get markToRevisit =>
      _t('Mark to revisit', 'மீண்டும் பார்க்க குறி');
  static String get markedToRevisit =>
      _t('Marked to revisit', 'மீண்டும் பார்க்க குறிக்கப்பட்டது');
  static String get answerThisQuestion =>
      _t('Please answer this question.', 'இந்தக் கேள்விக்குப் பதிலளிக்கவும்.');
  static String get answerAllToSubmit => _t(
    'Answer all the questions to submit.',
    'சமர்ப்பிக்க அனைத்து கேள்விகளுக்கும் பதிலளிக்கவும்.',
  );
  static String get tapStepsInOrder => _t(
    'Tap the steps in the correct order:',
    'சரியான வரிசையில் படிகளைத் தட்டவும்:',
  );
  static String get matchEachItem => _t(
    'Match each item to its description:',
    'ஒவ்வொரு உருப்படியையும் அதன் விளக்கத்துடன் பொருத்தவும்:',
  );
  static String get done => _t('Done', 'முடிந்தது');

  // ── Rewards ──────────────────────────────────────────────────────────────
  static String get myBadges => _t('My Badges', 'என் பதக்கங்கள்');
  static String get recentBadges => _t('Recently earned', 'சமீபத்தில் பெற்றது');
  static String get quizzesTaken =>
      _t('Quizzes taken', 'எடுத்த வினாடி வினாக்கள்');
  static String badgesEarnedCount(int count) => count == 0
      ? _t(
          'No badges yet — take a quiz to earn one',
          'இன்னும் பதக்கங்கள் இல்லை — ஒன்று பெற ஒரு வினாடி வினா எடுங்கள்',
        )
      : _t(
          '$count badge${count == 1 ? '' : 's'} earned',
          '$count பதக்கங்கள் பெறப்பட்டன',
        );
  static String youHaveEarned(String badge) =>
      _t('You have earned $badge', '$badge பெற்றீர்கள்');
  static String takenOfQuizzes(int taken, int total) => _t(
    'You have taken $taken of $total quizzes',
    '$total வினாடி வினாக்களில் $taken எடுத்துள்ளீர்கள்',
  );
  static String get startFirstQuiz => _t(
    'Take your first quiz to meet your animal!',
    'உங்கள் விலங்கைச் சந்திக்க முதல் வினாடி வினாவை எடுங்கள்!',
  );
  static String get noBadgesYet => _t(
    'No badges yet.\nFinish a quiz to earn your first one!',
    'இதுவரை பதக்கங்கள் இல்லை.\nஉங்கள் முதல் பதக்கத்தைப் பெற ஒரு வினாடி வினாவை முடிக்கவும்!',
  );
  static String get tryAgainQuote => _t(
    'Every expert started right where you are. Try once more!',
    'ஒவ்வொரு நிபுணரும் நீங்கள் இருக்கும் இடத்தில்தான் தொடங்கினார். மீண்டும் முயற்சிக்கவும்!',
  );
  static String get gaveYourBest => _t(
    'You gave it your best — try again to earn a badge!',
    'நீங்கள் சிறப்பாக முயற்சித்தீர்கள் — பதக்கம் பெற மீண்டும் முயற்சிக்கவும்!',
  );

  // ── Children / household ─────────────────────────────────────────────────
  static String get whoIsLearning =>
      _t('Who is learning today?', 'இன்று யார் கற்கிறார்கள்?');
  static String get addChild => _t('Add child', 'குழந்தையைச் சேர்');
  static String get addAnotherChild =>
      _t('Add another child', 'மற்றொரு குழந்தையைச் சேர்');
  static String get childId => _t('Child ID', 'குழந்தை அடையாள எண்');
  static String get childIdHint => _t(
    'Use this ID to sign in directly as this child.',
    'இந்த குழந்தையாக நேரடியாக உள்நுழைய இந்த ஐடியைப் பயன்படுத்தவும்.',
  );
  static String get awaitingApproval =>
      _t('Awaiting approval', 'ஒப்புதலுக்காக காத்திருக்கிறது');
  static String get awaitingApprovalHint => _t(
    "The study coordinator hasn't accepted this child's enrolment yet.",
    'ஆய்வு ஒருங்கிணைப்பாளர் இந்த குழந்தையின் பதிவை இன்னும் ஏற்கவில்லை.',
  );
  static String get name => _t('Name', 'பெயர்');
  static String get childAdded => _t('Child added', 'குழந்தை சேர்க்கப்பட்டது');
  static String get fillAllFields =>
      _t('Please fill in all fields.', 'அனைத்து புலங்களையும் நிரப்பவும்.');
  static String get emailPhoneOrChildId =>
      _t('Email, Phone or Child ID', 'உங்கள் விவரங்களை உள்ளிடுங்கள்');
  static String get emailPhoneOrChildIdHint => _t(
    'Enter valid details',
    'எ.கா. you@email.com, 98765 43210, அல்லது P0007',
  );
  static String get enterEmailPhoneOrId => _t(
    'Enter your email, phone number or child ID.',
    'உங்கள் மின்னஞ்சல், தொலைபேசி எண் அல்லது குழந்தை ஐடியை உள்ளிடவும்.',
  );
  static String get enterValidEmail => _t(
    'Enter a valid email address.',
    'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.',
  );
  static String get welcome => _t('Welcome', 'வரவேற்கிறோம்');
  static String get welcomeBack => _t('Welcome Back', 'மீண்டும் வரவேற்கிறோம்');
  static String get signInSubtitle => _t(
    'Sign in with your email, phone or your child’s ID.',
    'உங்கள் மின்னஞ்சல், தொலைபேசி அல்லது குழந்தையின் ஐடி மூலம் உள்நுழையவும்.',
  );
  static String get continueLabel => _t('Continue', 'தொடரவும்');
  static String get password => _t('Password', 'கடவுச்சொல்');
  static String get addChildFromProfile => _t(
    'Sign in as one of your children first, then add another from '
        'Profile → Your children.',
    'முதலில் உங்கள் குழந்தைகளில் ஒருவராக உள்நுழையவும், பின்னர் சுயவிவரம் → '
        'உங்கள் குழந்தைகள் என்பதிலிருந்து மற்றொருவரைச் சேர்க்கவும்.',
  );
  static String get yourChildren => _t('Your children', 'உங்கள் குழந்தைகள்');
  static String get signedIn => _t('Signed in', 'உள்நுழைந்துள்ளது');
  static String get familyAndSecurity =>
      _t('Family & security', 'குடும்பம் & பாதுகாப்பு');
  static String get enterPasswordToReset => _t(
    'Enter your password to reset the PIN.',
    'பின்னை மீட்டமைக்க உங்கள் கடவுச்சொல்லை உள்ளிடவும்.',
  );

  // ── Glucose entry ────────────────────────────────────────────────────────
  static String get glucose => _t('Glucose', 'குளுக்கோஸ்');
  static String get readingSaved =>
      _t('Reading saved', 'அளவீடு சேமிக்கப்பட்டது');
  static String get glucoseOutOfRange => _t(
    'That value looks out of range. Please check the meter.',
    'அந்த மதிப்பு வரம்பிற்கு வெளியே உள்ளது. மீட்டரைச் சரிபார்க்கவும்.',
  );
  static String get glucoseTargetsNote => _t(
    'Ranges shown are general guidance only. Your diabetes team sets your '
        'child’s own targets.',
    'காட்டப்படும் வரம்புகள் பொதுவான வழிகாட்டுதல் மட்டுமே. உங்கள் நீரிழிவு குழு '
        'உங்கள் குழந்தையின் இலக்குகளை நிர்ணயிக்கிறது.',
  );
  static String get glucoseDisabled => _t(
    'Glucose entry is not enabled for this study yet. Your study coordinator '
        'will turn it on when it is approved.',
    'இந்த ஆய்வுக்கு குளுக்கோஸ் பதிவு இன்னும் இயக்கப்படவில்லை. ஒப்புதல் பெற்றவுடன் '
        'உங்கள் ஆய்வு ஒருங்கிணைப்பாளர் அதை இயக்குவார்.',
  );
  static String get health => _t('Health', 'சுகாதாரம்');
  static String get healthTools => _t('Health tools', 'சுகாதார கருவிகள்');
  static String get enterRecentReading =>
      _t('Enter my recent reading', 'என் சமீபத்திய அளவீட்டை உள்ளிடு');

  // ── MPIN ─────────────────────────────────────────────────────────────────
  static String get healthLockedTitle =>
      _t('Health records are private', 'சுகாதாரப் பதிவுகள் தனிப்பட்டவை');
  static String get healthLockedBody => _t(
    'Enter your 4-digit PIN to record readings and doses, and to work out a calculation.',
    'அளவீடுகள் மற்றும் மருந்தளவுகளைப் பதிவு செய்யவும், கணக்கிடவும் உங்கள் 4 இலக்க பின்னை உள்ளிடவும்.',
  );
  static String get notNow => _t('Not now', 'இப்போது வேண்டாம்');
  static String get unlock => _t('Unlock', 'திற');
  static String get parentPin => _t('Parent PIN', 'பெற்றோர் பின்');
  static String get enterPin =>
      _t('Enter your PIN', 'உங்கள் பின்னை உள்ளிடவும்');
  static String get setPin => _t('Set a PIN', 'ஒரு பின்னை அமைக்கவும்');
  static String get confirmPin =>
      _t('Confirm your PIN', 'உங்கள் பின்னை உறுதிப்படுத்தவும்');
  static String get pinsDoNotMatch =>
      _t("Those PINs don't match.", 'அந்த பின்கள் பொருந்தவில்லை.');
  static String get pinSet => _t('PIN set', 'பின் அமைக்கப்பட்டது');
  static String get forgotPin =>
      _t('Forgot your PIN?', 'பின்னை மறந்துவிட்டீர்களா?');
  static String get resetPin => _t('Reset PIN', 'பின்னை மீட்டமை');
  static String get currentPassword => _t('Your password', 'உங்கள் கடவுச்சொல்');
  static String get pinNotSetTitle =>
      _t('Set up a parent PIN', 'பெற்றோர் பின்னை அமைக்கவும்');
  static String get pinNotSetBody => _t(
    'Choose any 4 digits. You will use them to open your child\'s health records.',
    'ஏதேனும் 4 இலக்கங்களைத் தேர்ந்தெடுக்கவும். உங்கள் குழந்தையின் சுகாதாரப் பதிவுகளைத் திறக்க இவற்றைப் பயன்படுத்துவீர்கள்.',
  );
  static String get pinIncorrect => _t(
    'That PIN is not right. Please try again.',
    'பின் சரியில்லை. மீண்டும் முயற்சிக்கவும்.',
  );
  static String get pinDigitsHint => _t('4 digits', '4 இலக்கங்கள்');

  // ── Connectivity ─────────────────────────────────────────────────────────
  static String get youAreOffline => _t(
    "You're offline — some data may be old. Go back online to see the latest.",
    'நீங்கள் இணையமில்லாமல் உள்ளீர்கள் — சில தரவு பழையதாக இருக்கலாம். சமீபத்தியதைப் பார்க்க மீண்டும் இணையத்துடன் இணையவும்.',
  );
  static String get offlineAuthTitle =>
      _t('No internet connection', 'இணைய இணைப்பு இல்லை');
  static String get offlineAuthBody => _t(
    'Signing in needs an internet connection. Please turn on Wi-Fi or mobile data to continue.',
    'உள்நுழைவதற்கு இணைய இணைப்பு தேவை. தொடர, வைஃபை அல்லது மொபைல் டேட்டாவை இயக்கவும்.',
  );

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
  static String get contentUpdated =>
      _t('New content downloaded.', 'புதிய உள்ளடக்கம் பதிவிறக்கப்பட்டது.');
  static String get couldNotReachServer => _t(
    'Could not reach the server. Try again later.',
    'சேவையகத்தை அணுக முடியவில்லை. பின்னர் முயற்சிக்கவும்.',
  );
  static String get lastUpdated =>
      _t('Last updated', 'கடைசியாகப் புதுப்பிக்கப்பட்டது');
  static String get never => _t('Never', 'இதுவரை இல்லை');
  static String get participant => _t('Participant', 'பங்கேற்பாளர்');
  static String get studyParticipant => _t(
    'Type 1 Diabetes · Study participant',
    'வகை 1 நீரிழிவு · ஆய்வுப் பங்கேற்பாளர்',
  );
  static String get idNo => _t('ID No.', 'அடையாள எண்');
  static String get age => _t('Age', 'வயது');
  static String years(int n) => _t('$n years', '$n வயது');
  static String get dateOfBirth => _t('Date of birth', 'பிறந்த தேதி');
  static String get sex => _t('Sex', 'பாலினம்');
  static String get diagnosed => _t('Diagnosed', 'கண்டறியப்பட்டது');
  static String get female => _t('Female', 'பெண்');
  static String get male => _t('Male', 'ஆண்');
  static String get notStated => _t('Not stated', 'குறிப்பிடவில்லை');
  static String get yourDetails => _t('Your details', 'உங்கள் விவரங்கள்');
  static String get editDetails => _t('Edit details', 'விவரங்களைத் திருத்து');
  static String get notProvided => _t('Not provided', 'வழங்கப்படவில்லை');
  static String completeProfileNudge(int remaining) => _t(
    '$remaining more detail${remaining == 1 ? '' : 's'} to complete this profile',
    'இந்த சுயவிவரத்தை முடிக்க $remaining மேலும் விவரங்கள்',
  );
  static String get phone => _t('Phone', 'தொலைபேசி');
  static String get bmi => _t('BMI', 'உடல் நிறை குறியீடு');
  static String get treatmentModality => _t('Treatment', 'சிகிச்சை');
  static String get emergencyContact => _t('Emergency contact', 'அவசர தொடர்பு');
  static String get isRequired => _t('is required.', 'தேவை.');
  static String get detailsSaved =>
      _t('Details saved', 'விவரங்கள் சேமிக்கப்பட்டன');
  static String get contact => _t('Contact', 'தொடர்பு');
  static String get healthDetails => _t('Health', 'சுகாதாரம்');

  // ── Home ─────────────────────────────────────────────────────────────────
  static String greeting(String name) => _t('Hello, $name', 'வணக்கம், $name');

  /// Time-of-day greeting, cursive on screen — see [HomeTab]'s hero text.
  static String greetingForHour(int hour, String name) {
    final part = hour < 12
        ? _t('Good morning', 'காலை வணக்கம்')
        : hour < 17
        ? _t('Good afternoon', 'மதிய வணக்கம்')
        : hour < 21
        ? _t('Good evening', 'மாலை வணக்கம்')
        : _t('Good night', 'இரவு வணக்கம்');
    return '$part, $name';
  }

  static const weekdaysShort = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  static const weekdaysShortTa = ['தி', 'செ', 'பு', 'வி', 'வெ', 'ச', 'ஞா'];

  static String get averageGlucose =>
      _t('Average glucose', 'சராசரி குளுக்கோஸ்');
  static String get noReadingsThatDay =>
      _t('No readings this day', 'இந்த நாளில் அளவீடுகள் இல்லை');
  static String get continueReadingBadge =>
      _t('Continue reading', 'படிப்பைத் தொடரவும்');
  static String get startLearning =>
      _t('Start learning', 'கற்கத் தொடங்குங்கள்');

  // ── Terms ────────────────────────────────────────────────────────────────
  static String get termsTitle =>
      _t('Terms & Conditions', 'விதிமுறைகள் & நிபந்தனைகள்');
  static String get agreeToTermsCheckbox => _t(
    'I agree to your Terms of Service and Privacy Policy',
    'உங்கள் சேவை விதிமுறைகள் மற்றும் தனியுரிமைக் கொள்கையை நான் ஏற்கிறேன்',
  );

  // ── Health: glance and record ───────────────────────────────────────────
  static String get todaysAverage => _t("Today's average", 'இன்றைய சராசரி');
  static String get noReadingsToday =>
      _t('No readings today', 'இன்று அளவீடுகள் இல்லை');
  static String lastReadingAgo(String ago) =>
      _t('Last reading $ago', 'கடைசி அளவீடு $ago');
  static String lastEntryAgo(String ago) =>
      _t('Last recorded $ago', 'கடைசியாகப் பதிவு செய்தது $ago');
  static String get noReadingEver => _t(
    'No reading recorded yet',
    'இதுவரை அளவீடு எதுவும் பதிவு செய்யப்படவில்லை',
  );
  static String get recordTitle => _t('Record', 'பதிவு செய்');
  static String get glucoseReadingLabel =>
      _t('Glucose reading (mg/dL)', 'குளுக்கோஸ் அளவு (mg/dL)');
  static String get unitsGiven => _t('Units given', 'கொடுத்த யூனிட்கள்');
  static String get carbsEaten =>
      _t('Carbohydrates eaten (g)', 'சாப்பிட்ட கார்போஹைட்ரேட் (கிராம்)');
  static String get whenLabel => _t('When', 'எப்போது');
  static String get nowLabel => _t('Now', 'இப்போது');
  static String get chooseTime => _t('Choose a time', 'நேரத்தைத் தேர்வுசெய்');
  static String get recentEntries => _t('Recent', 'சமீபத்தியவை');
  static String get nothingRecorded => _t(
    'Nothing recorded yet.',
    'இதுவரை எதுவும் பதிவு செய்யப்படவில்லை.',
  );
  static String get recordGlucoseHint => _t(
    'Read the number on the meter and enter it.',
    'மீட்டரில் உள்ள எண்ணைப் படித்து உள்ளிடவும்.',
  );
  static String get recordInsulinHint => _t(
    'Enter the units given. This records what was given — it does not tell you how much to give.',
    'கொடுத்த யூனிட்களை உள்ளிடவும். இது கொடுக்கப்பட்டதைப் பதிவு செய்கிறது — எவ்வளவு கொடுக்க வேண்டும் என்று சொல்லாது.',
  );
  static String get recordCarbsHint => _t(
    'Whenever your child eats, enter the carbohydrates in the food.',
    'உங்கள் குழந்தை சாப்பிடும்போதெல்லாம், உணவில் உள்ள கார்போஹைட்ரேட்டை உள்ளிடவும்.',
  );
  static String unitsValue(String units) =>
      _t('$units units', '$units யூனிட்கள்');
  static String gramsValue(String grams) => _t('$grams g', '$grams கி');

  // ── Reading time and short units ────────────────────────────────────────
  static String topicOfTotal(int read, int total) =>
      _t('$read of $total topics read', '$total-ல் $read தலைப்புகள் படித்தது');
  static String get resumeLabel => _t('Resume', 'தொடர்');
  static String get beginLabel => _t('Begin', 'தொடங்கு');

  // ── Badges ──────────────────────────────────────────────────────────────
  static String get badgesWon => _t('Badges earned', 'பெற்ற பதக்கங்கள்');
  static String get averageScore => _t('Average score', 'சராசரி மதிப்பெண்');
  static String nextRankAt(String title, int percent) => _t(
    'Next: $title at a $percent% average',
    'அடுத்து: $percent% சராசரியில் $title',
  );
  static String get topRankReached => _t(
    "You've reached the top rank!",
    'நீங்கள் உயர்ந்த நிலையை அடைந்துவிட்டீர்கள்!',
  );
  static String get badgeCollection => _t('Badge collection', 'பதக்கத் தொகுப்பு');
  static String tierEarnedCount(int n) => _t('$n earned', '$n பெற்றது');
  static String scoreFrom(int percent) =>
      _t('$percent% and above', '$percent% மற்றும் அதற்கு மேல்');

  // ── Profile and settings ────────────────────────────────────────────────
  static String get details => _t('Details', 'விவரங்கள்');
  static String get detailsSubtitle => _t(
    "Your child's details. Tap Edit to change them.",
    'உங்கள் குழந்தையின் விவரங்கள். மாற்ற "திருத்து" என்பதைத் தட்டவும்.',
  );
  static String get switchProfile => _t('Switch profile', 'சுயவிவரத்தை மாற்று');
  static String switchToChild(String name) =>
      _t('Switch to $name', '$name க்கு மாறு');
  static String get switchNeedsPassword => _t(
    "Enter your account password to open this child's record.",
    'இந்தக் குழந்தையின் பதிவைத் திறக்க உங்கள் கணக்கு கடவுச்சொல்லை உள்ளிடவும்.',
  );
  static String get switchLabel => _t('Switch', 'மாறு');
  static String get tapToSwitch =>
      _t('Tap to switch to this child', 'இந்தக் குழந்தைக்கு மாற தட்டவும்');
  static String get takeTheTour => _t('Take the app tour', 'செயலி வழிகாட்டி');
  static String get takeTheTourSubtitle => _t(
    'A quick walk through the main screens',
    'முக்கியத் திரைகளின் சிறு விளக்கம்',
  );
  static String get allowRemindersTitle =>
      _t('Allow reminders?', 'நினைவூட்டல்களை அனுமதிக்கவா?');
  static String get allowRemindersBody => _t(
    'T1D Prajana Yandra would like to send you reminders — for example, when it is time to record a glucose reading. Your phone will ask you to allow notifications next.',
    'T1D பிரஜ்ஞா யந்திரா உங்களுக்கு நினைவூட்டல்களை அனுப்ப விரும்புகிறது — உதாரணமாக, குளுக்கோஸ் அளவைப் பதிவு செய்ய வேண்டிய நேரத்தில். அடுத்து உங்கள் தொலைபேசி அறிவிப்புகளை அனுமதிக்கக் கேட்கும்.',
  );
  static String get allow => _t('Allow', 'அனுமதி');
  static String get notificationsBlocked => _t(
    'Notifications are turned off for this app. Open your phone settings to turn them on.',
    'இந்தச் செயலிக்கு அறிவிப்புகள் அணைக்கப்பட்டுள்ளன. அவற்றை இயக்க உங்கள் தொலைபேசி அமைப்புகளைத் திறக்கவும்.',
  );
  static String get openSettings => _t('Open settings', 'அமைப்புகளைத் திற');
  static String get reminderTitle =>
      _t('Time to check blood glucose', 'இரத்த குளுக்கோஸைச் சரிபார்க்க வேண்டிய நேரம்');
  static String get reminderBody => _t(
    'It has been a while since the last reading. Add a new one in the app.',
    'கடைசி அளவீட்டிற்குப் பிறகு சிறிது நேரம் ஆகிவிட்டது. செயலியில் புதிய ஒன்றைச் சேர்க்கவும்.',
  );
  static String get remindersOn => _t('Reminders are on', 'நினைவூட்டல்கள் இயக்கத்தில் உள்ளன');

  // ── Privacy and your data ───────────────────────────────────────────────
  static String get howDataUsed =>
      _t('How your data is used', 'உங்கள் தரவு எவ்வாறு பயன்படுத்தப்படுகிறது');
  static String get howDataUsedSubtitle => _t(
    'What we collect, why, and who can see it',
    'நாங்கள் என்ன சேகரிக்கிறோம், ஏன், யார் பார்க்க முடியும்',
  );
  static String get correctOrDelete =>
      _t('Correct or delete your data', 'தரவைத் திருத்த அல்லது நீக்க');
  static String get correctOrDeleteSubtitle => _t(
    'Fix your details, or delete your account',
    'உங்கள் விவரங்களைத் திருத்தவும், அல்லது கணக்கை நீக்கவும்',
  );
  static String get correctMyDetails =>
      _t('Correct my details', 'என் விவரங்களைத் திருத்து');
  static String get correctMyDetailsSubtitle => _t(
    'Open your details and tap Edit.',
    'உங்கள் விவரங்களைத் திறந்து "திருத்து" என்பதைத் தட்டவும்.',
  );
  static String get deleteAccount => _t('Delete my account', 'என் கணக்கை நீக்கு');
  static String get deleteAccountBody => _t(
    "Deleting removes your child's name, date of birth, contact details, answers to extra questions and help messages, and you can no longer sign in. Readings, doses and quiz results are kept for the research study without any name attached, as agreed in the terms. This cannot be undone.",
    'நீக்கினால் உங்கள் குழந்தையின் பெயர், பிறந்த தேதி, தொடர்பு விவரங்கள், கூடுதல் கேள்விகளுக்கான பதில்கள் மற்றும் உதவிச் செய்திகள் அகற்றப்படும்; நீங்கள் இனி உள்நுழைய முடியாது. அளவீடுகள், மருந்தளவுகள் மற்றும் தேர்வு முடிவுகள் விதிமுறைகளில் ஒப்புக்கொண்டபடி பெயர் இல்லாமல் ஆய்வுக்காக வைக்கப்படும். இதைத் திரும்பப் பெற முடியாது.',
  );
  static String get deleteConfirmTitle =>
      _t('Delete this account?', 'இந்தக் கணக்கை நீக்கவா?');
  static String get deletePasswordPrompt => _t(
    'Enter your account password to confirm.',
    'உறுதிப்படுத்த உங்கள் கணக்கு கடவுச்சொல்லை உள்ளிடவும்.',
  );
  static String get deleteForever => _t('Delete', 'நீக்கு');
  static String get accountDeleted =>
      _t('Your account has been deleted.', 'உங்கள் கணக்கு நீக்கப்பட்டது.');

  // ── Language preference at sign-up ──────────────────────────────────────
  static String get signupIntro => _t(
    'A few details about the child will help us better understand their needs. Your information will remain private.',
    'குழந்தையைப் பற்றிய சில விவரங்கள் அவர்களின் தேவைகளை நன்கு புரிந்துகொள்ள எங்களுக்கு உதவும். உங்கள் தகவல் தனிப்பட்டதாகவே இருக்கும்.',
  );
  static String get signupTermsPrompt => _t(
    'One last thing — please read our Terms & Conditions and tap "I Agree" to create the account.',
    'கடைசியாக ஒன்று — எங்கள் விதிமுறைகள் மற்றும் நிபந்தனைகளைப் படித்து, கணக்கை உருவாக்க "நான் ஏற்கிறேன்" என்பதைத் தட்டவும்.',
  );
  static String get iAgree => _t('I Agree', 'நான் ஏற்கிறேன்');
  static String get preferredLanguageQuestion => _t(
    'Which language would you like the app in? You can switch any time.',
    'செயலி எந்த மொழியில் வேண்டும்? எப்போது வேண்டுமானாலும் மாற்றலாம்.',
  );

  // ── Help and support ────────────────────────────────────────────────────
  static String get supportHint => _t(
    'Type what you need — a question about readings, insulin, food, school or the app. Write as much as you like.',
    'உங்களுக்கு என்ன தேவை என்று எழுதுங்கள் — அளவீடுகள், இன்சுலின், உணவு, பள்ளி அல்லது செயலி பற்றிய கேள்வி. எவ்வளவு வேண்டுமானாலும் எழுதலாம்.',
  );

  // ── App tour ────────────────────────────────────────────────────────────
  static String get tourNext => _t('Next', 'அடுத்து');
  static String get tourBack => _t('Back', 'பின்');
  static String get tourSkip => _t('Skip', 'தவிர்');
  static String get tourHomeTitle => _t('Your home', 'உங்கள் முகப்பு');
  static String get tourHomeBody => _t(
    "Today's glucose, your learning and what to do next — all in one place.",
    'இன்றைய குளுக்கோஸ், உங்கள் கற்றல், அடுத்து செய்ய வேண்டியவை — அனைத்தும் ஒரே இடத்தில்.',
  );
  static String get tourLanguageTitle => _t('English or Tamil', 'ஆங்கிலம் அல்லது தமிழ்');
  static String get tourLanguageBody => _t(
    'Switch the language at any time. The whole app changes with it.',
    'எப்போது வேண்டுமானாலும் மொழியை மாற்றலாம். முழுச் செயலியும் அதனுடன் மாறும்.',
  );
  static String get tourProfileTitle => _t('Profile & settings', 'சுயவிவரம் & அமைப்புகள்');
  static String get tourProfileBody => _t(
    "Your child's details, reminders, parent PIN, help, and switching between children.",
    'உங்கள் குழந்தையின் விவரங்கள், நினைவூட்டல்கள், பெற்றோர் பின், உதவி, குழந்தைகளுக்கு இடையே மாறுதல்.',
  );
  static String get tourReadingsTitle => _t('Glucose at a glance', 'குளுக்கோஸ் ஒரு பார்வையில்');
  static String get tourReadingsBody => _t(
    'Pick a day in the week above to see its average. Tap here to record a reading.',
    'சராசரியைப் பார்க்க மேலே உள்ள வாரத்தில் ஒரு நாளைத் தேர்ந்தெடுக்கவும். அளவீட்டைப் பதிவு செய்ய இங்கே தட்டவும்.',
  );
  static String get tourHelpBookTitle => _t('Help Book', 'உதவி புத்தகம்');
  static String get tourHelpBookBody => _t(
    'Short topics on caring for a child with Type 1 diabetes.',
    'வகை 1 நீரிழிவு உள்ள குழந்தையைப் பராமரிப்பது பற்றிய சிறு தலைப்புகள்.',
  );
  static String get tourQuizzesTitle => _t('Quizzes', 'தேர்வுகள்');
  static String get tourQuizzesBody => _t(
    'Test what you have learnt and earn badges.',
    'கற்றதைச் சோதித்து பதக்கங்களைப் பெறுங்கள்.',
  );
  static String get tourHealthTitle => _t('Health', 'சுகாதாரம்');
  static String get tourHealthBody => _t(
    'Record glucose, insulin and food. Your parent PIN keeps it private.',
    'குளுக்கோஸ், இன்சுலின், உணவைப் பதிவு செய்யுங்கள். உங்கள் பெற்றோர் பின் அதைத் தனிப்பட்டதாக வைக்கும்.',
  );
}
