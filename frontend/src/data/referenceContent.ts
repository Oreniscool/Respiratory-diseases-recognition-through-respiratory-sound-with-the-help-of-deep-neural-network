export interface ReferenceEntry {
  id: string;
  name: string;
  shortName?: string;
  eyebrow: string;
  summary: string;
  commonSigns: string[];
  assessment: string;
  soundNote: string;
  sourceLabel: string;
  sourceUrl: string;
}

export const REFERENCE_ENTRIES: ReferenceEntry[] = [
  {
    id: "copd",
    name: "Chronic obstructive pulmonary disease",
    shortName: "COPD",
    eyebrow: "Long-term airflow limitation",
    summary:
      "COPD restricts airflow and can make breathing progressively more difficult. Tobacco smoke, polluted air, and workplace dust or fumes are important risk factors.",
    commonSigns: ["Breathlessness", "Long-term cough", "Phlegm", "Wheezing", "Tiredness"],
    assessment:
      "Clinical assessment normally includes symptoms, exposure history, examination, and spirometry. A recording cannot confirm or exclude COPD.",
    soundNote:
      "Wheezes may occur, but they are also heard in other conditions and can be absent in COPD.",
    sourceLabel: "WHO: Chronic obstructive pulmonary disease",
    sourceUrl:
      "https://www.who.int/news-room/fact-sheets/detail/chronic-obstructive-pulmonary-disease-(copd)",
  },
  {
    id: "pneumonia",
    name: "Pneumonia",
    eyebrow: "Infection of the lungs",
    summary:
      "Pneumonia is a lung infection with several possible causes. Its symptoms overlap with many respiratory illnesses, so context and clinical assessment matter.",
    commonSigns: ["Cough", "Fever or chills", "Shortness of breath", "Tiredness", "Pain when breathing or coughing"],
    assessment:
      "Assessment may use history, examination, oxygen measurements, imaging, or laboratory tests depending on the situation.",
    soundNote:
      "Crackles can occur in pneumonia, but they are not specific enough to identify pneumonia or its cause from audio alone.",
    sourceLabel: "CDC: About pneumonia",
    sourceUrl: "https://www.cdc.gov/pneumonia/about/index.html",
  },
  {
    id: "bronchiectasis",
    name: "Bronchiectasis",
    eyebrow: "Widened or scarred airways",
    summary:
      "Bronchiectasis affects how well airways clear mucus and can lead to repeated infections and a long-term productive cough.",
    commonSigns: ["Persistent productive cough", "Repeated chest infections", "Breathlessness", "Wheeze", "Fatigue"],
    assessment:
      "Clinical assessment and tests such as CT imaging may be required. Audio analysis is not equivalent to imaging.",
    soundNote:
      "Crackles and wheezes may be present, but neither sound proves bronchiectasis.",
    sourceLabel: "NHLBI: Bronchiectasis",
    sourceUrl: "https://www.nhlbi.nih.gov/health/bronchiectasis",
  },
  {
    id: "bronchiolitis",
    name: "Bronchiolitis",
    eyebrow: "Small-airway illness in young children",
    summary:
      "Bronchiolitis mainly affects babies and children under two. It is usually viral and is frequently associated with respiratory syncytial virus (RSV).",
    commonSigns: ["Cough", "Faster or difficult breathing", "Feeding difficulty", "Wheeze", "Crackles"],
    assessment:
      "Age, breathing effort, hydration, feeding, and other clinical findings are important. Audio cannot identify RSV.",
    soundNote:
      "Wheezes or crackles may occur, but they do not establish the cause or severity.",
    sourceLabel: "NHS: Bronchiolitis",
    sourceUrl: "https://www.nhs.uk/conditions/bronchiolitis/",
  },
  {
    id: "asthma",
    name: "Asthma",
    eyebrow: "Variable airway inflammation and narrowing",
    summary:
      "Asthma can cause episodes of cough, wheeze, chest tightness, and breathlessness that vary over time and with triggers.",
    commonSigns: ["Variable wheeze", "Cough", "Chest tightness", "Breathlessness"],
    assessment:
      "Diagnosis can involve history, examination, and lung-function testing. Symptoms may be absent between episodes.",
    soundNote:
      "Wheeze is not unique to asthma, and asthma can be present without audible wheeze during a recording.",
    sourceLabel: "WHO: Asthma",
    sourceUrl: "https://www.who.int/news-room/fact-sheets/detail/asthma",
  },
  {
    id: "urti",
    name: "Upper respiratory tract infection",
    shortName: "URTI",
    eyebrow: "Nose, sinuses, and throat",
    summary:
      "URTI is an anatomical grouping rather than one disease. It includes infections affecting the upper airways, often with overlapping symptoms and causes.",
    commonSigns: ["Cough", "Sneezing", "Blocked or runny nose", "Sore throat", "Headache"],
    assessment:
      "Symptoms, duration, examination, and individual risk guide assessment. A lung recording alone does not locate an infection.",
    soundNote:
      "Upper-airway noise can contaminate lung recordings and should not be treated as a disease signature.",
    sourceLabel: "NHS: Respiratory tract infections",
    sourceUrl: "https://www.nhs.uk/conditions/respiratory-tract-infection/",
  },
  {
    id: "lrti",
    name: "Lower respiratory tract infection",
    shortName: "LRTI",
    eyebrow: "Airways and lungs",
    summary:
      "LRTI is another anatomical grouping, covering infections below the throat. It does not identify a specific organism or a fixed level of severity.",
    commonSigns: ["Cough", "Breathlessness", "Fever", "Chest discomfort", "Fatigue"],
    assessment:
      "The term covers different conditions. Clinical context is needed to determine cause, location, and severity.",
    soundNote:
      "Crackles or wheezes may appear in lower-airway illness, but audio alone cannot determine the infection location.",
    sourceLabel: "NHS: Respiratory tract infections",
    sourceUrl: "https://www.nhs.uk/conditions/respiratory-tract-infection/",
  },
  {
    id: "no-adventitious-sound",
    name: "No adventitious sound label",
    shortName: "Dataset label: Healthy",
    eyebrow: "A label, not a clean bill of health",
    summary:
      "The project dataset includes a “Healthy” class. In this interface it is described more carefully as a recording that matches the model’s no-adventitious-sound pattern.",
    commonSigns: ["No crackle label", "No wheeze label", "Recording quality still matters"],
    assessment:
      "A model score cannot rule out disease, assess overall health, or replace history, examination, imaging, or laboratory tests.",
    soundNote:
      "A quiet or typical-sounding recording is an acoustic observation, not a medical conclusion.",
    sourceLabel: "ERS: Standardized respiratory sound terminology",
    sourceUrl: "https://publications.ersnet.org/content/erj/47/3/724",
  },
];

export const GLOSSARY = [
  { term: "Crackle", definition: "A brief, discontinuous respiratory sound. Crackles can occur in more than one condition." },
  { term: "Wheeze", definition: "A relatively continuous, musical or whistling respiratory sound. It is not specific to one disease." },
  { term: "Spectrogram", definition: "A view of how signal energy is distributed across time and frequency." },
  { term: "Model score", definition: "A number produced by the classifier. Here it is uncalibrated and must not be read as a clinical probability." },
  { term: "Attribution", definition: "An experimental view of where a model was sensitive. It does not establish cause or prove a prediction is correct." },
];
