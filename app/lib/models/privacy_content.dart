import '../providers/app_state.dart';

/// "How your data is used", in both study languages.
///
/// Kept in step with the Terms & Conditions (terms_content.dart), the web
/// privacy policy (api/app/privacy/page.tsx) and api/docs/COMPLIANCE.md — they
/// all describe the same collection, and Google Play checks that they agree
/// with the Data safety form.
///
/// ⚠️ The Tamil below is a translation prepared for the app. Because it
/// describes consent and data protection, it should be reviewed by a Tamil
/// speaker on the study team before release.
typedef PrivacySection = ({String title, String body});

List<PrivacySection> get privacySections =>
    AppState.instance.locale == 'ta' ? _ta : _en;

const List<PrivacySection> _en = [
  (
    title: 'Who we are',
    body:
        'T1D Prajana Yandra is an educational app for families of children '
        'with Type 1 diabetes, used in a nursing research study at the '
        'Maadhuram Diabetic Center, Coimbatore. The study team runs the app '
        'and is responsible for your information.',
  ),
  (
    title: 'What we collect',
    body:
        '• About the parent or guardian: email address, password (stored only '
        'in scrambled form), phone number if you give it, and your preferred '
        'language.\n'
        '• About the child: name, date of birth, sex, year of diagnosis, '
        'treatment, height and weight, city, doctor, emergency contact, and '
        'answers to any extra questions the study asks.\n'
        '• Health records you enter: glucose readings, insulin doses and the '
        'carbohydrates your child eats, each with the time.\n'
        '• Learning: Help Book topics opened, quiz answers and scores, and '
        'badges earned.\n'
        '• Messages you send to the study team through Help and support.\n'
        '• Your parent PIN, stored only in scrambled form.',
  ),
  (
    title: 'What we do not collect',
    body:
        'We do not collect your location, contacts, photos, camera, '
        'microphone or advertising ID. The app shows no advertisements and '
        'does not sell or share your information for marketing.',
  ),
  (
    title: 'Why we use it',
    body:
        'To run the app for you — the Help Book, quizzes, badges and your '
        "child's records — and for the research study, where the team looks "
        'at how families use the app and how children are doing. Research '
        'results are published only in a form that does not identify any '
        'child or family.',
  ),
  (
    title: 'Who can see it',
    body:
        'Your family, on your phone — health records sit behind your parent '
        'PIN. The authorised study team, through the study dashboard; every '
        "time a staff member opens a child's records it is logged. We do not "
        'share it with anyone else unless the law requires it.',
  ),
  (
    title: 'How it is protected',
    body:
        'Information travels over an encrypted connection and is stored on '
        'secured servers. Passwords and PINs are never stored in readable '
        'form.',
  ),
  (
    title: 'How long we keep it',
    body:
        "For as long as your child takes part in the study and as the study's "
        'ethics approval requires. If you delete your account, the details '
        "that identify your child and family are removed straight away; the "
        'readings, doses and quiz results are kept without a name, as part of '
        'the research data.',
  ),
  (
    title: 'Your choices',
    body:
        "• See and correct your child's details: Settings → Details.\n"
        '• Delete your account: Settings → Correct or delete your data.\n'
        '• Turn reminders on or off: Settings → Reminders.\n'
        '• Withdraw from the study, or ask anything about your data: contact '
        'your study coordinator, or write to the team in Help and support.',
  ),
  (
    title: 'Children',
    body:
        'The app is for parents and guardians of children aged 6 to 15 with '
        'Type 1 diabetes. The account is created by the parent or guardian, '
        "who agrees to these terms on the child's behalf.",
  ),
];

const List<PrivacySection> _ta = [
  (
    title: 'நாங்கள் யார்',
    body:
        'T1D பிரஜ்ஞா யந்திரா என்பது வகை 1 நீரிழிவு உள்ள குழந்தைகளின் '
        'குடும்பங்களுக்கான கல்விச் செயலி. இது கோயம்புத்தூர் மாதுரம் நீரிழிவு '
        'மையத்தில் நடைபெறும் ஒரு செவிலியர் ஆய்வில் பயன்படுத்தப்படுகிறது. '
        'ஆய்வுக் குழுவே இந்தச் செயலியை நடத்துகிறது; உங்கள் தகவலுக்கு அதுவே '
        'பொறுப்பு.',
  ),
  (
    title: 'நாங்கள் சேகரிப்பவை',
    body:
        '• பெற்றோர் அல்லது பாதுகாவலர் பற்றி: மின்னஞ்சல் முகவரி, கடவுச்சொல் '
        '(மறைகுறியாக்கப்பட்ட வடிவில் மட்டும்), நீங்கள் கொடுத்தால் தொலைபேசி '
        'எண், நீங்கள் விரும்பும் மொழி.\n'
        '• குழந்தை பற்றி: பெயர், பிறந்த தேதி, பாலினம், நோய் கண்டறியப்பட்ட '
        'ஆண்டு, சிகிச்சை, உயரம் மற்றும் எடை, நகரம், மருத்துவர், அவசரத் '
        'தொடர்பு, ஆய்வு கேட்கும் கூடுதல் கேள்விகளுக்கான பதில்கள்.\n'
        '• நீங்கள் பதிவு செய்யும் சுகாதாரப் பதிவுகள்: குளுக்கோஸ் அளவுகள், '
        'இன்சுலின் அளவுகள், உங்கள் குழந்தை சாப்பிடும் கார்போஹைட்ரேட் — '
        'ஒவ்வொன்றும் நேரத்துடன்.\n'
        '• கற்றல்: திறந்த உதவி புத்தகத் தலைப்புகள், தேர்வுப் பதில்கள் மற்றும் '
        'மதிப்பெண்கள், பெற்ற பதக்கங்கள்.\n'
        '• உதவி மற்றும் ஆதரவு மூலம் ஆய்வுக் குழுவுக்கு நீங்கள் அனுப்பும் '
        'செய்திகள்.\n'
        '• உங்கள் பெற்றோர் பின் (மறைகுறியாக்கப்பட்ட வடிவில் மட்டும்).',
  ),
  (
    title: 'நாங்கள் சேகரிக்காதவை',
    body:
        'உங்கள் இருப்பிடம், தொடர்புகள், புகைப்படங்கள், கேமரா, மைக்ரோஃபோன் '
        'அல்லது விளம்பர அடையாளத்தை நாங்கள் சேகரிப்பதில்லை. செயலியில் '
        'விளம்பரங்கள் இல்லை; உங்கள் தகவல் விற்கப்படுவதோ சந்தைப்படுத்தலுக்காகப் '
        'பகிரப்படுவதோ இல்லை.',
  ),
  (
    title: 'ஏன் பயன்படுத்துகிறோம்',
    body:
        'உங்களுக்காகச் செயலியை இயக்க — உதவி புத்தகம், தேர்வுகள், பதக்கங்கள், '
        'உங்கள் குழந்தையின் பதிவுகள் — மற்றும் ஆய்வுக்காக: குடும்பங்கள் '
        'செயலியை எப்படிப் பயன்படுத்துகின்றன, குழந்தைகள் எப்படி இருக்கிறார்கள் '
        'என்பதை ஆய்வுக் குழு பார்க்கும். ஆய்வு முடிவுகள் எந்தக் குழந்தையையும் '
        'குடும்பத்தையும் அடையாளம் காட்டாத வடிவில் மட்டுமே வெளியிடப்படும்.',
  ),
  (
    title: 'யார் பார்க்க முடியும்',
    body:
        'உங்கள் குடும்பம், உங்கள் தொலைபேசியில் — சுகாதாரப் பதிவுகள் உங்கள் '
        'பெற்றோர் பின்னுக்குப் பின்னால் உள்ளன. அங்கீகரிக்கப்பட்ட ஆய்வுக் குழு, '
        'ஆய்வு டாஷ்போர்டு மூலம்; ஒரு பணியாளர் குழந்தையின் பதிவுகளைத் '
        'திறக்கும் ஒவ்வொரு முறையும் அது பதிவு செய்யப்படுகிறது. சட்டம் '
        'கோரினால் தவிர வேறு யாருடனும் பகிரப்படுவதில்லை.',
  ),
  (
    title: 'எப்படிப் பாதுகாக்கப்படுகிறது',
    body:
        'தகவல் மறைகுறியாக்கப்பட்ட இணைப்பு வழியாகச் செல்கிறது; பாதுகாக்கப்பட்ட '
        'சேவையகங்களில் சேமிக்கப்படுகிறது. கடவுச்சொற்களும் பின்களும் ஒருபோதும் '
        'படிக்கக்கூடிய வடிவில் சேமிக்கப்படுவதில்லை.',
  ),
  (
    title: 'எவ்வளவு காலம் வைத்திருக்கிறோம்',
    body:
        'உங்கள் குழந்தை ஆய்வில் பங்கேற்கும் வரையும், ஆய்வின் நெறிமுறை ஒப்புதல் '
        'கோரும் காலம் வரையும். உங்கள் கணக்கை நீக்கினால், உங்கள் குழந்தையையும் '
        'குடும்பத்தையும் அடையாளம் காட்டும் விவரங்கள் உடனே அகற்றப்படும்; '
        'அளவீடுகள், மருந்தளவுகள் மற்றும் தேர்வு முடிவுகள் பெயர் இல்லாமல் '
        'ஆய்வுத் தரவின் ஒரு பகுதியாக வைக்கப்படும்.',
  ),
  (
    title: 'உங்கள் தேர்வுகள்',
    body:
        '• உங்கள் குழந்தையின் விவரங்களைப் பார்க்க, திருத்த: அமைப்புகள் → '
        'விவரங்கள்.\n'
        '• உங்கள் கணக்கை நீக்க: அமைப்புகள் → தரவைத் திருத்த அல்லது நீக்க.\n'
        '• நினைவூட்டல்களை இயக்க அல்லது அணைக்க: அமைப்புகள் → '
        'நினைவூட்டல்கள்.\n'
        '• ஆய்விலிருந்து விலக, அல்லது உங்கள் தரவு பற்றி எதையும் கேட்க: உங்கள் '
        'ஆய்வு ஒருங்கிணைப்பாளரைத் தொடர்பு கொள்ளுங்கள், அல்லது உதவி மற்றும் '
        'ஆதரவில் குழுவுக்கு எழுதுங்கள்.',
  ),
  (
    title: 'குழந்தைகள்',
    body:
        'இந்தச் செயலி வகை 1 நீரிழிவு உள்ள 6 முதல் 15 வயதுக் குழந்தைகளின் '
        'பெற்றோர் மற்றும் பாதுகாவலர்களுக்கானது. கணக்கைப் பெற்றோர் அல்லது '
        'பாதுகாவலர் உருவாக்குகிறார்; குழந்தையின் சார்பாக இந்த விதிமுறைகளை '
        'அவரே ஏற்கிறார்.',
  ),
];
