import '../providers/app_state.dart';

/// Terms & Conditions in both study languages.
///
/// ⚠️ The Tamil text below is a translation of the English terms prepared for
/// the app, not a document supplied by the study. Because these terms carry
/// consent and data-protection meaning, the Tamil version must be reviewed
/// and signed off by the study team (and, where required, the ethics
/// committee) before the trial runs — a mistranslation here is a consent
/// problem, not a UI problem.
String get termsFullText =>
    AppState.instance.locale == 'ta' ? termsFullTextTa : termsFullTextEn;

const String termsFullTextEn = '''
T1D Prajana Yandra — Terms & Conditions

1. Purpose of this app
T1D Prajana Yandra is an educational support tool for children with Type 1 diabetes and their families, developed as part of a nursing research study. It provides bilingual (English and Tamil) learning content, simple calculators, and short quizzes. It is not a medical device and does not provide diagnosis, treatment, or dosing instructions. Always follow the guidance of your child's diabetes care team.

2. What information we collect
When you create an account, we collect the child's first and last name, date of birth, sex, and year of diagnosis, along with the parent/guardian's email address. As you use the app, we also record which topics have been read, quiz attempts and scores, and basic usage timestamps, so progress can sync across sessions and be reviewed as part of the study.

3. How your information is used
Information is used to personalise the app's content, track study participation and educational outcomes, and generate anonymised, aggregated findings for the research study. Individual data is not sold, and is not shared publicly or with third parties outside the research team, except as required by law or with your explicit consent.

4. Data storage and security
Data is stored on secured servers accessible only to the study's authorised research and technical staff. Reasonable technical safeguards are used to protect your information, though no system can guarantee absolute security.

5. Your rights
You may ask your study coordinator at any time to review the information held about your child, correct inaccuracies, or request deletion of the account and associated data. Participation in data collection beyond the core educational features may be withdrawn at any time without affecting your ability to use the app's educational content.

6. Educational calculators
Any calculators provided (such as the Rule of 15 or insulin-related tools) are simplified teaching aids intended to reinforce concepts already taught by a care team. They must never be used as the sole basis for an actual dosing decision. Always confirm with a qualified healthcare professional before taking any medical action.

7. Parental/guardian consent
By creating an account, you confirm that you are the parent, legal guardian, or another caregiver authorised to make decisions on behalf of the child named on this account, and that you consent to the collection and use of information as described above.

8. Changes to these terms
These terms may be updated as the study or app evolves. Continued use of the app after changes take effect constitutes acceptance of the revised terms.

If you have questions about these terms or how your data is used, please contact your study coordinator.
''';

const String termsFullTextTa = '''
T1D பிரஜ்ஞா யந்திரா — விதிமுறைகள் & நிபந்தனைகள்

1. இந்தச் செயலியின் நோக்கம்
T1D பிரஜ்ஞா யந்திரா என்பது வகை 1 நீரிழிவு நோயுள்ள குழந்தைகளுக்கும் அவர்களது குடும்பங்களுக்கும் உதவும் ஒரு கல்விக் கருவியாகும். இது ஒரு செவிலியர் ஆய்வின் ஒரு பகுதியாக உருவாக்கப்பட்டது. இது ஆங்கிலம் மற்றும் தமிழ் ஆகிய இரு மொழிகளில் கற்றல் உள்ளடக்கம், எளிய கணிப்பான்கள் மற்றும் சிறு வினாடி வினாக்களை வழங்குகிறது. இது ஒரு மருத்துவ சாதனம் அல்ல; இது நோய் கண்டறிதல், சிகிச்சை அல்லது மருந்தளவு அறிவுரைகளை வழங்குவதில்லை. உங்கள் குழந்தையின் நீரிழிவு மருத்துவக் குழுவின் வழிகாட்டுதலை எப்போதும் பின்பற்றுங்கள்.

2. நாங்கள் சேகரிக்கும் தகவல்கள்
நீங்கள் கணக்கை உருவாக்கும்போது, குழந்தையின் முதல் மற்றும் கடைசிப் பெயர், பிறந்த தேதி, பாலினம், நோய் கண்டறியப்பட்ட ஆண்டு ஆகியவற்றையும், பெற்றோர்/பாதுகாவலரின் மின்னஞ்சல் முகவரியையும் சேகரிக்கிறோம். நீங்கள் செயலியைப் பயன்படுத்தும்போது, எந்தெந்தத் தலைப்புகள் படிக்கப்பட்டன, வினாடி வினா முயற்சிகள் மற்றும் மதிப்பெண்கள், அடிப்படைப் பயன்பாட்டு நேரங்கள் ஆகியவற்றையும் பதிவு செய்கிறோம். இதனால் முன்னேற்றத்தை ஒத்திசைக்கவும், ஆய்வின் ஒரு பகுதியாக மதிப்பாய்வு செய்யவும் முடியும்.

3. உங்கள் தகவல் எவ்வாறு பயன்படுத்தப்படுகிறது
செயலியின் உள்ளடக்கத்தைத் தனிப்பயனாக்கவும், ஆய்வுப் பங்கேற்பு மற்றும் கல்வி விளைவுகளைக் கண்காணிக்கவும், ஆய்வுக்காக அடையாளம் நீக்கப்பட்ட, தொகுக்கப்பட்ட முடிவுகளை உருவாக்கவும் தகவல்கள் பயன்படுத்தப்படுகின்றன. தனிநபர் தரவு விற்கப்படுவதில்லை; சட்டப்படி தேவைப்பட்டாலோ அல்லது உங்கள் வெளிப்படையான ஒப்புதலுடனோ தவிர, ஆய்வுக் குழுவுக்கு வெளியே பொதுவில் அல்லது மூன்றாம் தரப்பினருடன் பகிரப்படுவதில்லை.

4. தரவுச் சேமிப்பு மற்றும் பாதுகாப்பு
தரவு பாதுகாக்கப்பட்ட சேவையகங்களில் சேமிக்கப்படுகிறது; ஆய்வின் அங்கீகரிக்கப்பட்ட ஆராய்ச்சி மற்றும் தொழில்நுட்பப் பணியாளர்கள் மட்டுமே அணுக முடியும். உங்கள் தகவலைப் பாதுகாக்க நியாயமான தொழில்நுட்பப் பாதுகாப்புகள் பயன்படுத்தப்படுகின்றன; எனினும் எந்த அமைப்பும் முழுமையான பாதுகாப்பை உறுதியளிக்க முடியாது.

5. உங்கள் உரிமைகள்
உங்கள் குழந்தையைப் பற்றி வைத்திருக்கும் தகவலை மதிப்பாய்வு செய்யவும், தவறுகளைத் திருத்தவும், கணக்கு மற்றும் தொடர்புடைய தரவை நீக்கக் கோரவும் நீங்கள் எந்த நேரத்திலும் உங்கள் ஆய்வு ஒருங்கிணைப்பாளரிடம் கேட்கலாம். முக்கியக் கல்வி அம்சங்களுக்கு அப்பாற்பட்ட தரவுச் சேகரிப்பில் பங்கேற்பதை எந்த நேரத்திலும் திரும்பப் பெறலாம்; இது செயலியின் கல்வி உள்ளடக்கத்தைப் பயன்படுத்தும் உங்கள் திறனைப் பாதிக்காது.

6. கல்விக் கணிப்பான்கள்
வழங்கப்படும் எந்தக் கணிப்பான்களும் (15 விதி அல்லது இன்சுலின் தொடர்பான கருவிகள் போன்றவை) மருத்துவக் குழு ஏற்கெனவே கற்பித்த கருத்துக்களை வலுப்படுத்தும் நோக்கில் எளிமைப்படுத்தப்பட்ட கற்பித்தல் உதவிகள் மட்டுமே. உண்மையான மருந்தளவு முடிவுக்கு அவை ஒருபோதும் ஒரே ஆதாரமாகப் பயன்படுத்தப்படக் கூடாது. எந்த மருத்துவ நடவடிக்கையையும் எடுப்பதற்கு முன் தகுதிவாய்ந்த மருத்துவரிடம் எப்போதும் உறுதிப்படுத்திக் கொள்ளுங்கள்.

7. பெற்றோர்/பாதுகாவலர் ஒப்புதல்
கணக்கை உருவாக்குவதன் மூலம், இந்தக் கணக்கில் பெயரிடப்பட்டுள்ள குழந்தையின் சார்பாக முடிவெடுக்க அங்கீகரிக்கப்பட்ட பெற்றோர், சட்டப்பூர்வ பாதுகாவலர் அல்லது பராமரிப்பாளர் நீங்கள் என்பதையும், மேலே விவரிக்கப்பட்டுள்ளபடி தகவல் சேகரிப்பு மற்றும் பயன்பாட்டிற்கு நீங்கள் ஒப்புதல் அளிக்கிறீர்கள் என்பதையும் உறுதிப்படுத்துகிறீர்கள்.

8. இந்த விதிமுறைகளில் மாற்றங்கள்
ஆய்வு அல்லது செயலி வளர்ச்சியடையும்போது இந்த விதிமுறைகள் புதுப்பிக்கப்படலாம். மாற்றங்கள் அமலுக்கு வந்த பிறகு செயலியைத் தொடர்ந்து பயன்படுத்துவது திருத்தப்பட்ட விதிமுறைகளை ஏற்றுக்கொள்வதாகக் கருதப்படும்.

இந்த விதிமுறைகள் குறித்தோ அல்லது உங்கள் தரவு எவ்வாறு பயன்படுத்தப்படுகிறது என்பது குறித்தோ கேள்விகள் இருந்தால், உங்கள் ஆய்வு ஒருங்கிணைப்பாளரைத் தொடர்பு கொள்ளவும்.
''';
