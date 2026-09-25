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

  static bool get isTamilNow => _l == 'ta';

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
  static String bothText(String Function() read) {
    final b = both(read);
    return b.en == b.ta ? b.en : '${b.en}\n${b.ta}';
  }

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
  static String enterNumberFor(String l) =>
      _t('Enter a number for "$l".', '"$l" க்கு ஒரு எண்ணை உள்ளிடவும்.');
  static String mustBeMoreThanZero(String l) => _t(
    '"$l" must be more than zero. Please check the number and enter it again.',
    '"$l" பூஜ்யத்தை விட அதிகமாக இருக்க வேண்டும். எண்ணைச் சரிபார்த்து மீண்டும் உள்ளிடவும்.',
  );
  static String get calcCouldNotWork => _t(
    'This could not be worked out with those numbers. Please check them.',
    'இந்த எண்களைக் கொண்டு கணக்கிட முடியவில்லை. அவற்றைச் சரிபார்க்கவும்.',
  );
  static String get timeInFuture =>
      _t('That time is in the future.', 'அந்த நேரம் எதிர்காலத்தில் உள்ளது.');

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
  static String get unitsShort => _t('u', 'அலகு');
  static String get todayWord => _t('today', 'இன்று');
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
  static String get switchLanguage => _t('Switch language', 'மொழியை மாற்று');
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
  static String get english => 'English';
  static String get tamil => 'தமிழ்';

  // ── Calculations ─────────────────────────────────────────────────────────
  static String get ruleOf15 => _t('Rule of 15', '15 விதி');
  static String get icIsf => _t('IC / ISF', 'IC / ISF');
  static String get calculators => _t('Calculators', 'கணக்கிடும் கருவிகள்');
  static String get calculatorsIntro => _t(
    "Work out ratios and doses from your child's own numbers.",
    'உங்கள் குழந்தையின் எண்களிலிருந்து விகிதங்களையும் அளவுகளையும் கணக்கிடுங்கள்.',
  );
  static String get noCalculators => _t(
    'No calculators are available right now.',
    'தற்போது எந்த கணக்கிடும் கருவிகளும் இல்லை.',
  );

  /// Where a pre-filled number came from. [when] is absent for a profile
  /// detail, which has no moment of its own.
  static String fromYourRecords([String? when]) => when == null
      ? _t('From your records', 'உங்கள் பதிவுகளிலிருந்து')
      : _t('From your records · $when', 'உங்கள் பதிவுகளிலிருந்து · $when');
  static String get enteredByYou => _t('Entered by you', 'நீங்கள் உள்ளிட்டது');
  static String get nothingOnFile => _t(
    'Nothing on file yet — please enter it yourself.',
    'இன்னும் பதிவு இல்லை — நீங்களே உள்ளிடவும்.',
  );
  static String get yourResult => _t('Your result', 'உங்கள் முடிவு');

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
  static String get calculatorsLine =>
      _t('Ratios and doses', 'விகிதங்கள் மற்றும் அளவுகள்');
  static String get recordDose => _t('Record a dose', 'அளவைப் பதிவு செய்');
  static String get newAnswerFromTeam =>
      _t('New answer from the team', 'குழுவிடமிருந்து புதிய பதில்');
  static String get questionsAndAnswers =>
      _t('Questions and answers', 'கேள்விகள் மற்றும் பதில்கள்');
  static String get noReadingThisDay => _t('No readings', 'அளவீடுகள் இல்லை');

  // ── Insulin ──────────────────────────────────────────────────────────────
  static String get insulin => _t('Insulin', 'இன்சுலின்');
  static String get logInsulin =>
      _t('Record an insulin dose', 'இன்சுலின் அளவைப் பதிவு செய்');
  static String get insulinRecordNote => _t(
    'This records what was given. It does not tell you how much to give — confirm doses with your diabetes team.',
    'இது கொடுக்கப்பட்டதைப் பதிவு செய்கிறது. எவ்வளவு கொடுக்க வேண்டும் என்று சொல்லாது — அளவுகளை உங்கள் நீரிழிவு குழுவிடம் உறுதிப்படுத்தவும்.',
  );
  static String get insulinKind => _t('Kind of insulin', 'இன்சுலின் வகை');
  static String get insulinName =>
      _t('Insulin name (e.g. Humalog)', 'இன்சுலின் பெயர் (எ.கா. Humalog)');
  static String get doseUnits => _t('Dose (units)', 'அளவு (யூனிட்கள்)');
  static String get whenGiven => _t('When it was given', 'கொடுத்த நேரம்');
  static String get recentDoses => _t('Recent doses', 'சமீபத்திய அளவுகள்');
  static String todayTotal(String units) =>
      _t('Today: $units units', 'இன்று: $units யூனிட்கள்');
  static String get doseSaved =>
      _t('Dose recorded', 'அளவு பதிவு செய்யப்பட்டது');
  static String get noDosesYet => _t(
    'No doses recorded yet.',
    'இதுவரை அளவுகள் எதுவும் பதிவு செய்யப்படவில்லை.',
  );
  static String get needInsulinName => _t(
    'Please enter the name of the insulin.',
    'இன்சுலினின் பெயரை உள்ளிடவும்.',
  );
  static String get badDose => _t(
    'Please check the dose — it should be more than 0 and no more than 300 units.',
    'அளவைச் சரிபார்க்கவும் — அது 0-க்கு மேல் 300 யூனிட்களுக்குள் இருக்க வேண்டும்.',
  );
  static String get rapidActing2 => _t('Rapid-acting', 'வேகமாகச் செயல்படும்');
  static String get shortActing => _t('Short-acting', 'குறுகிய-செயல்');
  static String get intermediateActing => _t('Intermediate', 'இடைநிலை');
  static String get longActing => _t('Long-acting', 'நீண்ட-செயல்');
  static String get premixed => _t('Premixed', 'கலப்பு');
  static String get otherInsulin => _t('Other', 'மற்றவை');

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
  static String get yourMessage => _t('Your message', 'உங்கள் செய்தி');
  static String get send => _t('Send', 'அனுப்பு');
  static String messagesLeftToday(int left, int limit) => _t(
    '$left of $limit messages left today',
    'இன்று $limit-ல் $left செய்திகள் மீதமுள்ளன',
  );
  static String get dailyLimitReached => _t(
    'You have sent all your messages for today. You can send more tomorrow — the team will reply here.',
    'இன்றைய செய்திகள் அனைத்தையும் அனுப்பிவிட்டீர்கள். நாளை மேலும் அனுப்பலாம் — குழு இங்கே பதிலளிக்கும்.',
  );
  static String get writeYourQuestion =>
      _t('Write your question here', 'உங்கள் கேள்வியை இங்கே எழுதுங்கள்');
  static String get writeReply => _t('Write a reply…', 'பதிலை எழுதுங்கள்…');
  static String get studyTeam => _t('Study team', 'ஆய்வுக் குழு');
  static String get you => _t('You', 'நீங்கள்');
  static String get newAnswer => _t('New answer', 'புதிய பதில்');
  static String get needMessage =>
      _t('Please write your message.', 'உங்கள் செய்தியை எழுதுங்கள்.');
  static String get enterIn => _t('Enter in', 'இதில் உள்ளிடவும்');
  static String get calculate => _t('Calculate', 'கணக்கிடு');
  static String get iUnderstand => _t('I understand', 'எனக்குப் புரிகிறது');
  static String get calculatorDisclaimerTitle => _t(
    'This tool is provided as an educational aid',
    'இந்த கருவி ஒரு கல்வி உதவியாக வழங்கப்படுகிறது',
  );
  static String calculatorDisclaimerBody(String calculatorName) => _t(
    "$calculatorName does not replace your diabetes team's guidance. "
        'Always confirm doses and thresholds with your clinician.',
    '$calculatorName உங்கள் நீரிழிவு குழுவின் வழிகாட்டுதலுக்குப் பதிலாக இல்லை. '
        'மருந்தளவு மற்றும் வரம்புகளை எப்போதும் உங்கள் மருத்துவரிடம் உறுதிப்படுத்தவும்.',
  );
  static String ruleOf15AboveRange(int bg) => _t(
    'Blood glucose is $bg mg/dL — the Rule of 15 is for readings below 70 mg/dL.',
    'இரத்த சர்க்கரை $bg mg/dL — 15 விதி 70 mg/dL-க்கும் குறைவான அளவீடுகளுக்கானது.',
  );
  static String ruleOf15Result(int grams, int servings) => _t(
    'Take about $grams g of fast-acting sugar (e.g. glucose tablets, '
        'juice, or $servings serving(s) of 15g carbs).\n\n'
        'Recheck blood glucose in 15 minutes. If still under 100 mg/dL, repeat with another 15g.',
    'சுமார் $grams கிராம் வேகமாகச் செயல்படும் சர்க்கரை எடுத்துக் கொள்ளுங்கள் '
        '(எ.கா. குளுக்கோஸ் மாத்திரைகள், சாறு, அல்லது 15கிராம் கார்போஹைட்ரேட்டின் $servings பரிமாணம்).\n\n'
        '15 நிமிடங்களில் இரத்த சர்க்கரையை மீண்டும் சரிபார்க்கவும். இன்னும் 100 mg/dL-க்குக் குறைவாக இருந்தால், '
        'மேலும் 15கிராம் எடுத்துக் கொள்ளுங்கள்.',
  );
  static String get totalDailyInsulinDose => _t(
    'Total daily insulin dose (units)',
    'மொத்த தினசரி இன்சுலின் அளவு (யூனிட்கள்)',
  );
  static String get rapidActingInsulin =>
      _t('Rapid-acting insulin', 'வேகமாகச் செயல்படும் இன்சுலின்');
  static String get uses1800Rule =>
      _t('Uses 1800 rule', '1800 விதியைப் பயன்படுத்துகிறது');
  static String get uses1500Rule => _t(
    'Uses 1500 rule (short-acting)',
    '1500 விதியைப் பயன்படுத்துகிறது (குறுகிய-செயல்)',
  );
  static String get computeRatiosFirst => _t(
    'Enter your total daily dose above and calculate your ratios first.',
    'முதலில் மேலே உங்கள் மொத்த தினசரி அளவை உள்ளிட்டு உங்கள் விகிதங்களைக் கணக்கிடவும்.',
  );
  static String get mealDoseTitle => _t('Meal dose', 'உணவு அளவு');
  static String get carbsInMeal => _t(
    'Carbohydrates in this meal (g)',
    'இந்த உணவில் உள்ள கார்போஹைட்ரேட் (கிராம்)',
  );
  static String get enterCarbs => _t(
    'Enter the carbohydrates for this meal.',
    'இந்த உணவிற்கான கார்போஹைட்ரேட்டை உள்ளிடவும்.',
  );
  static String mealDoseResult(
    String units,
    String carbs,
    String icRatio,
  ) => _t(
    '≈ $units unit(s) of bolus insulin for $carbs g of carbs, at your IC ratio of 1 unit '
        'per $icRatio g.\n\nConfirm with your diabetes team before dosing.',
    '$carbs கிராம் கார்போஹைட்ரேட்டுக்கு, உங்கள் IC விகிதமான $icRatio கிராமுக்கு 1 யூனிட் என்ற '
        'அடிப்படையில் ≈ $units யூனிட் போலஸ் இன்சுலின்.\n\nமருந்தளவு செய்யும் முன் உங்கள் '
        'நீரிழிவு குழுவிடம் உறுதிப்படுத்தவும்.',
  );
  static String icIsfResult(String icRatio, String isf) => _t(
    'IC ratio ≈ 1 unit per $icRatio g of carbs\n\n'
        'ISF (correction factor) ≈ 1 unit lowers blood glucose by $isf mg/dL\n\n'
        'These are starting-point ratios from the standard formula — your diabetes team should '
        'confirm and adjust them for you.',
    'IC விகிதம் ≈ 1 யூனிட் ஒவ்வொரு $icRatio கிராம் கார்போஹைட்ரேட்டுக்கும்\n\n'
        'ISF (திருத்தக் காரணி) ≈ 1 யூனிட் இரத்த சர்க்கரையை $isf mg/dL குறைக்கும்\n\n'
        'இவை நிலையான சூத்திரத்திலிருந்து தொடக்க-புள்ளி விகிதங்கள் — உங்கள் நீரிழிவு குழு இவற்றை '
        'உறுதிப்படுத்தி உங்களுக்கேற்ப சரிசெய்ய வேண்டும்.',
  );

  // ── Quizzes ──────────────────────────────────────────────────────────────
  static String get noQuizzesYet =>
      _t('No quizzes published yet.', 'இதுவரை வினாடி வினா எதுவும் இல்லை.');
  static String get startQuiz => _t('Start quiz', 'வினாடி வினாவைத் தொடங்கு');
  static String get answered => _t('Answered', 'பதிலளிக்கப்பட்டது');
  static String get unanswered => _t('Unanswered', 'பதிலளிக்கப்படவில்லை');
  static String answeredOfTotal(int answered, int total) => _t(
    '$answered of $total answered',
    '$total-ல் $answered பதிலளிக்கப்பட்டது',
  );
  static String get submitQuiz => _t('Submit quiz', 'வினாடி வினாவைச் சமர்ப்பி');
  static String get questionNumber => _t('Question', 'கேள்வி');
  static String get yourScore => _t('Your score', 'உங்கள் மதிப்பெண்');
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
  static String get quizComplete =>
      _t('Quiz complete', 'வினாடி வினா முடிந்தது');
  static String get done => _t('Done', 'முடிந்தது');
  static String get passed => _t('Passed', 'தேர்ச்சி பெற்றது');
  static String get notYetTryAgain => _t(
    'Not yet — try reviewing the topic again.',
    'இன்னும் இல்லை — தலைப்பை மீண்டும் பார்வையிடவும்.',
  );

  // ── Rewards ──────────────────────────────────────────────────────────────
  static String get myBadges => _t('My Badges', 'என் பதக்கங்கள்');
  static String get badgesEarned => _t('Badges', 'பதக்கங்கள்');
  static String get earnedBadges => _t('Your collection', 'உங்கள் சேகரிப்பு');
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
  static String get notYetEarned => _t('Not yet earned', 'இன்னும் பெறவில்லை');
  static String badgesOfQuizzes(int earned, int total) => _t(
    '$earned of $total quizzes conquered',
    '$total வினாடி வினாக்களில் $earned வென்றது',
  );
  static String get noBadgesYet => _t(
    'No badges yet.\nFinish a quiz to earn your first one!',
    'இதுவரை பதக்கங்கள் இல்லை.\nஉங்கள் முதல் பதக்கத்தைப் பெற ஒரு வினாடி வினாவை முடிக்கவும்!',
  );
  static String get newBadge => _t('New badge!', 'புதிய பதக்கம்!');
  static String get tryAgainQuote => _t(
    'Every expert started right where you are. Try once more!',
    'ஒவ்வொரு நிபுணரும் நீங்கள் இருக்கும் இடத்தில்தான் தொடங்கினார். மீண்டும் முயற்சிக்கவும்!',
  );
  static String get newBestScore =>
      _t('New best score!', 'புதிய சிறந்த மதிப்பெண்!');
  static String badgeEarnedFor(String tier) =>
      _t('You earned the $tier badge', '$tier பதக்கத்தை வென்றீர்கள்');
  static String get gaveYourBest => _t(
    'You gave it your best — try again to earn a badge!',
    'நீங்கள் சிறப்பாக முயற்சித்தீர்கள் — பதக்கம் பெற மீண்டும் முயற்சிக்கவும்!',
  );
  static String get bestKept => _t(
    'Your best score for this quiz is still safe.',
    'இந்த வினாடி வினாவுக்கான உங்கள் சிறந்த மதிப்பெண் பாதுகாப்பாக உள்ளது.',
  );

  // ── Children / household ─────────────────────────────────────────────────
  static String get whoIsLearning =>
      _t('Who is learning today?', 'இன்று யார் கற்கிறார்கள்?');
  static String get selectChild =>
      _t('Select a child', 'ஒரு குழந்தையைத் தேர்ந்தெடுக்கவும்');
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
  static String get switchChild => _t('Switch child', 'குழந்தையை மாற்று');
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
  static String get glucoseEntry => _t('Glucose entry', 'குளுக்கோஸ் பதிவு');
  static String get glucoseLevel => _t('Glucose level', 'குளுக்கோஸ் அளவு');
  static String get recentReadings =>
      _t('Recent readings', 'சமீபத்திய அளவீடுகள்');
  static String get noReadingsYet =>
      _t('No readings yet.', 'இதுவரை அளவீடுகள் இல்லை.');
  static String get saveReading => _t('Save reading', 'அளவீட்டைச் சேமி');
  static String get readingSaved =>
      _t('Reading saved', 'அளவீடு சேமிக்கப்பட்டது');
  static String get enterGlucoseValue =>
      _t('Enter a glucose value.', 'ஒரு குளுக்கோஸ் மதிப்பை உள்ளிடவும்.');
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
  static String get low => _t('Low', 'குறைவு');
  static String get inRange => _t('In range', 'வரம்பில்');
  static String get high => _t('High', 'அதிகம்');
  static String get glucoseDisabled => _t(
    'Glucose entry is not enabled for this study yet. Your study coordinator '
        'will turn it on when it is approved.',
    'இந்த ஆய்வுக்கு குளுக்கோஸ் பதிவு இன்னும் இயக்கப்படவில்லை. ஒப்புதல் பெற்றவுடன் '
        'உங்கள் ஆய்வு ஒருங்கிணைப்பாளர் அதை இயக்குவார்.',
  );
  static String get needAReadingFirst => _t(
    'Save a reading, or pick one from your recent log below.',
    'ஒரு அளவீட்டைச் சேமிக்கவும், அல்லது கீழே உள்ள உங்கள் சமீபத்திய பதிவிலிருந்து ஒன்றைத் தேர்வுசெய்யவும்.',
  );
  static String get glucoseCalculators =>
      _t('The glucose calculators', 'குளுக்கோஸ் கணிப்பான்கள்');
  static String get tapReadingToCheck => _t(
    'Tap a reading to check a dose against it.',
    'ஒரு மருந்தளவைச் சரிபார்க்க ஒரு அளவீட்டைத் தட்டவும்.',
  );
  static String get health => _t('Health', 'சுகாதாரம்');
  static String get healthTools => _t('Health tools', 'சுகாதார கருவிகள்');
  static String get filter => _t('Filter', 'வடிகட்டி');
  static String get sort => _t('Sort', 'வரிசைப்படுத்து');
  static String get allDates => _t('All dates', 'அனைத்து தேதிகளும்');
  static String get pickADate =>
      _t('Pick a date', 'ஒரு தேதியைத் தேர்ந்தெடுக்கவும்');
  static String get newestFirst => _t('Newest first', 'புதியது முதலில்');
  static String get oldestFirst => _t('Oldest first', 'பழையது முதலில்');
  static String get noReadingsForDate =>
      _t('No readings on this date.', 'இந்த தேதியில் அளவீடுகள் இல்லை.');
  static String nextReadingAt(String when) =>
      _t('Next reading available $when', 'அடுத்த அளவீடு $when கிடைக்கும்');
  static String lastRecordedAt(String when) =>
      _t('Last recorded $when', 'கடைசியாக $when பதிவு செய்யப்பட்டது');
  static String get enterRecentReading =>
      _t('Enter my recent reading', 'என் சமீபத்திய அளவீட்டை உள்ளிடு');
  static String get readingAvailableNow =>
      _t('A reading can be entered now', 'இப்போது ஒரு அளவீட்டை உள்ளிடலாம்');

  // ── MPIN ─────────────────────────────────────────────────────────────────
  static String get healthLockedTitle =>
      _t('Health records are private', 'சுகாதாரப் பதிவுகள் தனிப்பட்டவை');
  static String get healthLockedBody => _t(
    'Enter your 4-digit PIN to record readings and doses, and to work out a calculation.',
    'அளவீடுகள் மற்றும் மருந்தளவுகளைப் பதிவு செய்யவும், கணக்கிடவும் உங்கள் 4 இலக்க பின்னை உள்ளிடவும்.',
  );
  static String get timeToRecord => _t(
    'Time to record a glucose reading',
    'குளுக்கோஸ் அளவைப் பதிவு செய்ய வேண்டிய நேரம்',
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
  static String get goToProfile =>
      _t('Go to Profile', 'சுயவிவரத்திற்குச் செல்');
  static String get pinIncorrect => _t(
    'That PIN is not right. Please try again.',
    'பின் சரியில்லை. மீண்டும் முயற்சிக்கவும்.',
  );
  static String get pinDigitsHint => _t('4 digits', '4 இலக்கங்கள்');
  static String get forgotPinGoToProfile => _t(
    'Forgot your PIN? Reset it from Profile with your password.',
    'பின்னை மறந்துவிட்டீர்களா? உங்கள் கடவுச்சொல்லைக் கொண்டு சுயவிவரத்தில் மீட்டமைக்கவும்.',
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
  static String get contentUpToDate =>
      _t('Content is up to date.', 'உள்ளடக்கம் புதுப்பித்த நிலையில் உள்ளது.');
  static String get contentUpdated =>
      _t('New content downloaded.', 'புதிய உள்ளடக்கம் பதிவிறக்கப்பட்டது.');
  static String get couldNotReachServer => _t(
    'Could not reach the server. Try again later.',
    'சேவையகத்தை அணுக முடியவில்லை. பின்னர் முயற்சிக்கவும்.',
  );
  static String get lastUpdated =>
      _t('Last updated', 'கடைசியாகப் புதுப்பிக்கப்பட்டது');
  static String get never => _t('Never', 'இதுவரை இல்லை');
  static String get tapToFlip =>
      _t('Tap for settings', 'அமைப்புகளுக்குத் தட்டவும்');
  static String get backToCard => _t('Back to card', 'அட்டைக்குத் திரும்பு');
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
  static String get viewAllDetails =>
      _t('View all details', 'அனைத்து விவரங்களையும் காண்க');
  static String get viewAllDetailsHint => _t(
    'Everything on file for this child, filled or not',
    'இந்தக் குழந்தைக்கான அனைத்து விவரங்களும், நிரப்பப்பட்டதோ இல்லையோ',
  );
  static String get notProvided => _t('Not provided', 'வழங்கப்படவில்லை');
  static String completeProfileNudge(int remaining) => _t(
    '$remaining more detail${remaining == 1 ? '' : 's'} to complete this profile',
    'இந்த சுயவிவரத்தை முடிக்க $remaining மேலும் விவரங்கள்',
  );
  static String get phone => _t('Phone', 'தொலைபேசி');
  static String get city => _t('City', 'நகரம்');
  static String get country => _t('Country', 'நாடு');
  static String get height => _t('Height', 'உயரம்');
  static String get weight => _t('Weight', 'எடை');
  static String get bmi => _t('BMI', 'உடல் நிறை குறியீடு');
  static String get treatmentModality => _t('Treatment', 'சிகிச்சை');
  static String get emergencyContact => _t('Emergency contact', 'அவசர தொடர்பு');
  static String get emergencyContactName =>
      _t('Emergency contact name', 'அவசர தொடர்பு பெயர்');
  static String get emergencyContactPhone =>
      _t('Emergency contact phone', 'அவசர தொடர்பு தொலைபேசி');
  static String get primaryClinician =>
      _t("Treating doctor's name", 'சிகிச்சை அளிக்கும் மருத்துவரின் பெயர்');
  static String get isRequired => _t('is required.', 'தேவை.');
  static String get diagnosisYear =>
      _t('Diagnosis year', 'கண்டறியப்பட்ட ஆண்டு');
  static String get heightHint => _t('Height (cm)', 'உயரம் (செ.மீ)');
  static String get weightHint => _t('Weight (kg)', 'எடை (கிலோ)');
  static String get lifestyleOnly =>
      _t('Lifestyle only', 'வாழ்க்கை முறை மட்டும்');
  static String get oralMedication => _t('Oral medication', 'வாய்வழி மருந்து');
  static String get insulinTreatment => _t('Insulin', 'இன்சுலின்');
  static String get oralAndInsulin =>
      _t('Oral & insulin', 'வாய்வழி & இன்சுலின்');
  static String get nonInsulinInjectable =>
      _t('Non-insulin injectable', 'இன்சுலின் அல்லாத ஊசி மருந்து');
  static String get otherTreatment => _t('Other', 'மற்றவை');
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
  static String get continueReading =>
      _t('Continue where you left off', 'நிறுத்திய இடத்திலிருந்து தொடரவும்');
  static String get startLearning =>
      _t('Start learning', 'கற்கத் தொடங்குங்கள்');
  static String get tipOfTheDay => _t('Tip of the day', 'இன்றைய குறிப்பு');
  static String get yourProgress => _t('Your progress', 'உங்கள் முன்னேற்றம்');
  static String get quickActions => _t('Quick actions', 'விரைவு செயல்கள்');
  static String get allTopicsDone => _t(
    'All topics read. Well done!',
    'அனைத்து தலைப்புகளும் படித்தாகிவிட்டது. வாழ்த்துக்கள்!',
  );

  // ── Terms ────────────────────────────────────────────────────────────────
  static String get termsTitle =>
      _t('Terms & Conditions', 'விதிமுறைகள் & நிபந்தனைகள்');
  static String get agreeToTermsCheckbox => _t(
    'I agree to your Terms of Service and Privacy Policy',
    'உங்கள் சேவை விதிமுறைகள் மற்றும் தனியுரிமைக் கொள்கையை நான் ஏற்கிறேன்',
  );
}
