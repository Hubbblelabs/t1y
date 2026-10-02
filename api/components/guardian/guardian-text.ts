import type { GlucoseSlotKey } from "@/lib/health-data-config";

export type Lang = "en" | "ta";

type Dict = {
  title: string;
  intro: string;
  codeTitle: string;
  codeHelp: string;
  codeLabel: string;
  unlock: string;
  checking: string;
  yourName: string;
  yourNameHelp: string;
  insulin: string;
  carbs: string;
  carbsFood: string;
  carbsFoodHint: string;
  exercise: string;
  save: string;
  nothingDue: string;
  checkTitle: string;
  checkBody: string;
  goBack: string;
  confirm: string;
  saving: string;
  doneTitle: string;
  doneBody: string;
  badLinkTitle: string;
  loading: string;
  needName: string;
  needValue: string;
  badNumber: string;
  network: string;
  glucoseLabel: (slot: string) => string;
  kinds: { glucose: string; insulin: string; carbs: string; exercise: string };
  hints: { glucose: string; insulin: string; carbs: string; exercise: string };
  fields: { glucose: string; insulin: string; carbs: string; exercise: string };
  whichReading: string;
  yourNameTitle: string;
  parentNote: string;
  entered: string;
  slot: Record<GlucoseSlotKey, string>;
  values: { glucose: string; insulin: string; carbs: string; food: string; exercise: string; by: string };
  units: { mgdl: string; units: string; grams: string; minutes: string };
};

export const TEXT: Record<Lang, Dict> = {
  en: {
    title: "Record your child's readings",
    intro:
      "A parent has asked you to record a few readings for their child. This link works once and expires after you save.",
    codeTitle: "Enter the 6-digit code",
    codeHelp: "The parent shared a 6-digit code with you separately from this link.",
    codeLabel: "6-digit code",
    unlock: "Continue",
    checking: "Checking…",
    yourName: "Your name",
    yourNameHelp: "So the parent knows who entered these.",
    insulin: "Insulin given",
    carbs: "Carbohydrates eaten",
    carbsFood: "What was eaten (optional)",
    carbsFoodHint: "e.g. 2 dosa",
    exercise: "Exercise time",
    save: "Review and save",
    nothingDue: "Nothing is due right now. All of today's readings for this child have been recorded.",
    checkTitle: "Please check these carefully",
    checkBody:
      "These numbers are used to make decisions about the child's care. Make sure each one is exactly right before you save. You cannot change them after saving.",
    goBack: "Go back and edit",
    confirm: "Yes, these are correct — save",
    saving: "Saving…",
    doneTitle: "Saved — thank you",
    doneBody: "The parent has been told. This link has now expired and can't be used again.",
    badLinkTitle: "This link can't be used",
    loading: "Loading…",
    needName: "Please enter your name.",
    needValue: "Enter at least one reading before saving.",
    badNumber: "Please check the number you entered.",
    network: "Could not reach the server. Check your connection and try again.",
    glucoseLabel: (slot) => `${slot} glucose reading`,
    kinds: { glucose: "Glucose", insulin: "Insulin", carbs: "Carbs", exercise: "Exercise" },
    hints: {
      glucose: "Read the number on the meter and enter it.",
      insulin: "Enter the units given. This records what was given — it does not tell you how much to give.",
      carbs: "Whenever the child eats, enter the carbohydrates in the food.",
      exercise: "Whenever the child exercises, enter how long they did it.",
    },
    fields: {
      glucose: "Glucose reading (mg/dL)",
      insulin: "Units given",
      carbs: "Carbohydrates eaten (g)",
      exercise: "Exercise time (minutes)",
    },
    whichReading: "Which reading is this?",
    yourNameTitle: "Who is entering these?",
    parentNote: "Note from the parent",
    entered: "Entered",
    slot: {
      PRE_BREAKFAST: "Pre-breakfast",
      POST_BREAKFAST: "Post-breakfast",
      PRE_LUNCH: "Pre-lunch",
      POST_LUNCH: "Post-lunch",
      PRE_DINNER: "Pre-dinner",
      POST_DINNER: "Post-dinner",
    },
    values: { glucose: "Glucose", insulin: "Insulin", carbs: "Carbohydrates", food: "Food", exercise: "Exercise", by: "Entered by" },
    units: { mgdl: "mg/dL", units: "units", grams: "g", minutes: "minutes" },
  },
  ta: {
    title: "குழந்தையின் அளவீடுகளைப் பதிவு செய்யுங்கள்",
    intro:
      "பெற்றோர் தங்கள் குழந்தையின் சில அளவீடுகளைப் பதிவு செய்ய உங்களிடம் கேட்டுள்ளனர். இந்த இணைப்பு ஒருமுறை மட்டுமே செயல்படும்; சேமித்த பிறகு காலாவதியாகும்.",
    codeTitle: "6 இலக்க குறியீட்டை உள்ளிடவும்",
    codeHelp: "இந்த இணைப்பிலிருந்து தனியாக பெற்றோர் உங்களுக்கு 6 இலக்க குறியீட்டைப் பகிர்ந்திருப்பார்.",
    codeLabel: "6 இலக்க குறியீடு",
    unlock: "தொடரவும்",
    checking: "சரிபார்க்கிறது…",
    yourName: "உங்கள் பெயர்",
    yourNameHelp: "யார் இவற்றை உள்ளிட்டார் என்பதைப் பெற்றோர் அறிய.",
    insulin: "கொடுத்த இன்சுலின்",
    carbs: "சாப்பிட்ட கார்போஹைட்ரேட்",
    carbsFood: "என்ன சாப்பிட்டார் (விருப்பம்)",
    carbsFoodHint: "எ.கா. 2 தோசை",
    exercise: "உடற்பயிற்சி நேரம்",
    save: "சரிபார்த்து சேமிக்கவும்",
    nothingDue: "இப்போது எதுவும் பதிவு செய்ய வேண்டியதில்லை. இன்றைய அனைத்து அளவீடுகளும் பதிவாகிவிட்டன.",
    checkTitle: "இவற்றை கவனமாகச் சரிபார்க்கவும்",
    checkBody:
      "இந்த எண்கள் குழந்தையின் பராமரிப்பு முடிவுகளுக்குப் பயன்படுத்தப்படுகின்றன. சேமிக்கும் முன் ஒவ்வொன்றும் சரியாக உள்ளதா என்பதை உறுதிசெய்யவும். சேமித்த பிறகு மாற்ற முடியாது.",
    goBack: "திரும்பிச் சென்று திருத்து",
    confirm: "ஆம், இவை சரி — சேமி",
    saving: "சேமிக்கிறது…",
    doneTitle: "சேமிக்கப்பட்டது — நன்றி",
    doneBody: "பெற்றோருக்குத் தெரிவிக்கப்பட்டது. இந்த இணைப்பு இப்போது காலாவதியாகிவிட்டது; மீண்டும் பயன்படுத்த முடியாது.",
    badLinkTitle: "இந்த இணைப்பைப் பயன்படுத்த முடியாது",
    loading: "ஏற்றுகிறது…",
    needName: "உங்கள் பெயரை உள்ளிடவும்.",
    needValue: "சேமிக்கும் முன் குறைந்தது ஒரு அளவீட்டை உள்ளிடவும்.",
    badNumber: "நீங்கள் உள்ளிட்ட எண்ணைச் சரிபார்க்கவும்.",
    network: "சேவையகத்தை அடைய முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
    glucoseLabel: (slot) => `${slot} குளுக்கோஸ் அளவு`,
    kinds: { glucose: "குளுக்கோஸ்", insulin: "இன்சுலின்", carbs: "கார்ப்ஸ்", exercise: "உடற்பயிற்சி" },
    hints: {
      glucose: "மீட்டரில் உள்ள எண்ணைப் படித்து உள்ளிடவும்.",
      insulin: "கொடுத்த யூனிட்களை உள்ளிடவும். இது கொடுக்கப்பட்டதைப் பதிவு செய்கிறது — எவ்வளவு கொடுக்க வேண்டும் என்று சொல்லாது.",
      carbs: "குழந்தை சாப்பிடும்போதெல்லாம், உணவில் உள்ள கார்போஹைட்ரேட்டை உள்ளிடவும்.",
      exercise: "குழந்தை உடற்பயிற்சி செய்யும்போதெல்லாம், எவ்வளவு நேரம் செய்தது என்பதை உள்ளிடவும்.",
    },
    fields: {
      glucose: "குளுக்கோஸ் அளவு (mg/dL)",
      insulin: "கொடுத்த யூனிட்கள்",
      carbs: "சாப்பிட்ட கார்போஹைட்ரேட் (கிராம்)",
      exercise: "உடற்பயிற்சி நேரம் (நிமிடங்கள்)",
    },
    whichReading: "இது எந்த அளவீடு?",
    yourNameTitle: "இவற்றை உள்ளிடுபவர் யார்?",
    parentNote: "பெற்றோரின் குறிப்பு",
    entered: "உள்ளிடப்பட்டது",
    slot: {
      PRE_BREAKFAST: "காலை உணவுக்கு முன்",
      POST_BREAKFAST: "காலை உணவுக்குப் பின்",
      PRE_LUNCH: "மதிய உணவுக்கு முன்",
      POST_LUNCH: "மதிய உணவுக்குப் பின்",
      PRE_DINNER: "இரவு உணவுக்கு முன்",
      POST_DINNER: "இரவு உணவுக்குப் பின்",
    },
    values: { glucose: "குளுக்கோஸ்", insulin: "இன்சுலின்", carbs: "கார்போஹைட்ரேட்", food: "உணவு", exercise: "உடற்பயிற்சி", by: "உள்ளிட்டவர்" },
    units: { mgdl: "mg/dL", units: "யூனிட்கள்", grams: "கி", minutes: "நிமிடங்கள்" },
  },
};
