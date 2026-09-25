import '../providers/app_state.dart';

/// Terms & Conditions (with the privacy notice) in both study languages.
///
/// Kept in step with privacy_content.dart, the web privacy policy
/// (api/app/privacy/page.tsx) and api/docs/COMPLIANCE.md — they describe the
/// same collection, and Google Play checks that they agree with the app's
/// Data safety form.
///
/// ⚠️ The Tamil text below is a translation of the English terms prepared for
/// the app, not a document supplied by the study. Because these terms carry
/// consent and data-protection meaning, the Tamil version must be reviewed
/// and signed off by the study team (and, where required, the ethics
/// committee) before release — a mistranslation here is a consent problem,
/// not a UI problem.
String get termsFullText =>
    AppState.instance.locale == 'ta' ? termsFullTextTa : termsFullTextEn;

const String termsFullTextEn = '''
T1D Prajana Yandra — Terms & Conditions and Privacy

1. What this app is
T1D Prajana Yandra is an educational app for families of children aged 6 to 15 with Type 1 diabetes. It is part of a nursing research study at the Maadhuram Diabetic Center, Coimbatore. It offers a Help Book, quizzes and badges in English and Tamil, and a place to record glucose readings, insulin doses and carbohydrates. It is not a medical device. It does not diagnose, treat, or tell you what dose to give. Always follow your child's diabetes care team, and in an emergency contact a doctor or hospital straight away.

2. Who can use it
The account is created by a parent or legal guardian (or another caregiver authorised to make decisions for the child). By creating it you confirm this, and you agree to these terms on the child's behalf.

3. What we collect
- About you: email address, password (stored only in scrambled form), phone number if you give it, and your preferred language.
- About your child: name, date of birth, sex, year of diagnosis, treatment, height and weight, city, doctor, emergency contact, and answers to any extra questions the study asks.
- Health records you choose to enter: glucose readings, insulin doses and carbohydrates eaten, each with the time.
- Learning: Help Book topics opened, quiz answers and scores, badges.
- Messages you send the study team through Help and support.
- Your parent PIN, stored only in scrambled form.
We do not collect your location, contacts, photos, camera, microphone or advertising ID. There are no advertisements.

4. How we use it
To run the app for you, and for the research study: the study team looks at how families use the app and how children are doing. Research results are published only in a form that does not identify any child or family. Your information is never sold, and is not shared with anyone outside the study team unless the law requires it.

5. Who can see it
Your family, on your phone (health records sit behind your parent PIN), and the authorised study team through the study dashboard. Every time a staff member opens a child's records it is logged.

6. Security
Information travels over an encrypted connection and is stored on secured servers. No system is perfectly secure, but passwords and PINs are never stored in readable form and staff access is recorded.

7. Reminders
If you turn reminders on in Settings, the app asks your phone for permission and shows a reminder when it has been six hours since the last glucose reading. You can turn them off at any time.

8. Keeping and deleting your information
We keep your information while your child takes part in the study and as the study's ethics approval requires. You can see and correct your child's details in the app (Settings → Details), and delete your account at any time (Settings → Correct or delete your data). Deleting removes your child's name, date of birth, contact details, answers to extra questions and help messages straight away, and ends your sign-in. Readings, doses and quiz results are kept without a name, as part of the research data. To withdraw from the study, contact your study coordinator.

9. Changes
These terms may be updated as the study or the app changes. We will show the new terms in the app, and continuing to use it means you accept them.

10. Contact
For any question about these terms or your information, contact your study coordinator at the clinic, or write to the study team in the app under Help and support.
''';

const String termsFullTextTa = '''
T1D பிரஜ்ஞா யந்திரா — விதிமுறைகள், நிபந்தனைகள் மற்றும் தனியுரிமை

1. இந்தச் செயலி என்ன
T1D பிரஜ்ஞா யந்திரா என்பது வகை 1 நீரிழிவு உள்ள 6 முதல் 15 வயதுக் குழந்தைகளின் குடும்பங்களுக்கான கல்விச் செயலி. இது கோயம்புத்தூர் மாதுரம் நீரிழிவு மையத்தில் நடைபெறும் ஒரு செவிலியர் ஆய்வின் ஒரு பகுதி. இது ஆங்கிலம் மற்றும் தமிழில் உதவி புத்தகம், தேர்வுகள், பதக்கங்களை வழங்குகிறது; குளுக்கோஸ் அளவுகள், இன்சுலின் அளவுகள், கார்போஹைட்ரேட்டைப் பதிவு செய்யவும் இடம் தருகிறது. இது ஒரு மருத்துவ சாதனம் அல்ல. இது நோய் கண்டறிவதோ, சிகிச்சை அளிப்பதோ, எந்த அளவு மருந்து கொடுக்க வேண்டும் என்று சொல்வதோ இல்லை. உங்கள் குழந்தையின் நீரிழிவு மருத்துவக் குழுவின் வழிகாட்டுதலை எப்போதும் பின்பற்றுங்கள்; அவசர நிலையில் உடனே மருத்துவர் அல்லது மருத்துவமனையைத் தொடர்பு கொள்ளுங்கள்.

2. யார் பயன்படுத்தலாம்
கணக்கைப் பெற்றோர் அல்லது சட்டப்பூர்வப் பாதுகாவலர் (அல்லது குழந்தைக்காக முடிவெடுக்க அங்கீகரிக்கப்பட்ட பராமரிப்பாளர்) உருவாக்குகிறார். கணக்கை உருவாக்குவதன் மூலம் நீங்கள் இதை உறுதிப்படுத்துகிறீர்கள்; குழந்தையின் சார்பாக இந்த விதிமுறைகளை ஏற்கிறீர்கள்.

3. நாங்கள் சேகரிப்பவை
- உங்களைப் பற்றி: மின்னஞ்சல் முகவரி, கடவுச்சொல் (மறைகுறியாக்கப்பட்ட வடிவில் மட்டும்), நீங்கள் கொடுத்தால் தொலைபேசி எண், நீங்கள் விரும்பும் மொழி.
- உங்கள் குழந்தையைப் பற்றி: பெயர், பிறந்த தேதி, பாலினம், நோய் கண்டறியப்பட்ட ஆண்டு, சிகிச்சை, உயரம் மற்றும் எடை, நகரம், மருத்துவர், அவசரத் தொடர்பு, ஆய்வு கேட்கும் கூடுதல் கேள்விகளுக்கான பதில்கள்.
- நீங்கள் பதிவு செய்யத் தேர்ந்தெடுக்கும் சுகாதாரப் பதிவுகள்: குளுக்கோஸ் அளவுகள், இன்சுலின் அளவுகள், சாப்பிட்ட கார்போஹைட்ரேட் — ஒவ்வொன்றும் நேரத்துடன்.
- கற்றல்: திறந்த உதவி புத்தகத் தலைப்புகள், தேர்வுப் பதில்கள் மற்றும் மதிப்பெண்கள், பதக்கங்கள்.
- உதவி மற்றும் ஆதரவு மூலம் ஆய்வுக் குழுவுக்கு நீங்கள் அனுப்பும் செய்திகள்.
- உங்கள் பெற்றோர் பின் (மறைகுறியாக்கப்பட்ட வடிவில் மட்டும்).
உங்கள் இருப்பிடம், தொடர்புகள், புகைப்படங்கள், கேமரா, மைக்ரோஃபோன் அல்லது விளம்பர அடையாளத்தை நாங்கள் சேகரிப்பதில்லை. விளம்பரங்கள் இல்லை.

4. எப்படிப் பயன்படுத்துகிறோம்
உங்களுக்காகச் செயலியை இயக்கவும், ஆய்வுக்காகவும்: குடும்பங்கள் செயலியை எப்படிப் பயன்படுத்துகின்றன, குழந்தைகள் எப்படி இருக்கிறார்கள் என்பதை ஆய்வுக் குழு பார்க்கும். ஆய்வு முடிவுகள் எந்தக் குழந்தையையும் குடும்பத்தையும் அடையாளம் காட்டாத வடிவில் மட்டுமே வெளியிடப்படும். உங்கள் தகவல் ஒருபோதும் விற்கப்படுவதில்லை; சட்டம் கோரினால் தவிர ஆய்வுக் குழுவுக்கு வெளியே யாருடனும் பகிரப்படுவதில்லை.

5. யார் பார்க்க முடியும்
உங்கள் குடும்பம், உங்கள் தொலைபேசியில் (சுகாதாரப் பதிவுகள் உங்கள் பெற்றோர் பின்னுக்குப் பின்னால் உள்ளன), மற்றும் ஆய்வு டாஷ்போர்டு மூலம் அங்கீகரிக்கப்பட்ட ஆய்வுக் குழு. ஒரு பணியாளர் குழந்தையின் பதிவுகளைத் திறக்கும் ஒவ்வொரு முறையும் அது பதிவு செய்யப்படுகிறது.

6. பாதுகாப்பு
தகவல் மறைகுறியாக்கப்பட்ட இணைப்பு வழியாகச் சென்று பாதுகாக்கப்பட்ட சேவையகங்களில் சேமிக்கப்படுகிறது. எந்த அமைப்பும் முழுமையாகப் பாதுகாப்பானது அல்ல; ஆனால் கடவுச்சொற்களும் பின்களும் ஒருபோதும் படிக்கக்கூடிய வடிவில் சேமிக்கப்படுவதில்லை, பணியாளர் அணுகல் பதிவு செய்யப்படுகிறது.

7. நினைவூட்டல்கள்
அமைப்புகளில் நினைவூட்டல்களை இயக்கினால், செயலி உங்கள் தொலைபேசியிடம் அனுமதி கேட்கும்; கடைசி குளுக்கோஸ் அளவீட்டிற்குப் பிறகு ஆறு மணி நேரம் ஆனதும் நினைவூட்டலைக் காட்டும். எப்போது வேண்டுமானாலும் அணைக்கலாம்.

8. தகவலை வைத்திருத்தல் மற்றும் நீக்குதல்
உங்கள் குழந்தை ஆய்வில் பங்கேற்கும் வரையும், ஆய்வின் நெறிமுறை ஒப்புதல் கோரும் காலம் வரையும் உங்கள் தகவலை வைத்திருக்கிறோம். உங்கள் குழந்தையின் விவரங்களைச் செயலியில் பார்க்கலாம், திருத்தலாம் (அமைப்புகள் → விவரங்கள்); எப்போது வேண்டுமானாலும் கணக்கை நீக்கலாம் (அமைப்புகள் → தரவைத் திருத்த அல்லது நீக்க). நீக்கினால் உங்கள் குழந்தையின் பெயர், பிறந்த தேதி, தொடர்பு விவரங்கள், கூடுதல் கேள்விகளுக்கான பதில்கள், உதவிச் செய்திகள் உடனே அகற்றப்படும்; உள்நுழைவும் முடிவடையும். அளவீடுகள், மருந்தளவுகள், தேர்வு முடிவுகள் பெயர் இல்லாமல் ஆய்வுத் தரவின் ஒரு பகுதியாக வைக்கப்படும். ஆய்விலிருந்து விலக, உங்கள் ஆய்வு ஒருங்கிணைப்பாளரைத் தொடர்பு கொள்ளுங்கள்.

9. மாற்றங்கள்
ஆய்வு அல்லது செயலி மாறும்போது இந்த விதிமுறைகள் புதுப்பிக்கப்படலாம். புதிய விதிமுறைகளைச் செயலியில் காட்டுவோம்; தொடர்ந்து பயன்படுத்துவது அவற்றை ஏற்பதாகும்.

10. தொடர்பு
இந்த விதிமுறைகள் அல்லது உங்கள் தகவல் பற்றிய எந்தக் கேள்விக்கும், மருத்துவமனையில் உள்ள உங்கள் ஆய்வு ஒருங்கிணைப்பாளரைத் தொடர்பு கொள்ளுங்கள், அல்லது செயலியில் உதவி மற்றும் ஆதரவில் ஆய்வுக் குழுவுக்கு எழுதுங்கள்.
''';
