// Disease knowledge base used by the Disease Library page and chatbot
export interface DiseaseInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
  tagline: string;
  description: string;
  symptoms: string[];
  acousticProfile: {
    crackles: boolean;
    wheezes: boolean;
    notes: string;
  };
  riskFactors: string[];
  treatment: string[];
  severity: "mild" | "moderate" | "severe";
  prevalence: string;
  keywords: string[];
}

export const DISEASES: DiseaseInfo[] = [
  {
    id: "copd",
    name: "COPD",
    color: "#ef4444",
    icon: "🫁",
    tagline: "Chronic Obstructive Pulmonary Disease",
    description:
      "A chronic inflammatory lung disease causing obstructed airflow. Characterised by long-term respiratory symptoms and airflow limitation, often caused by smoking.",
    symptoms: [
      "Persistent cough with mucus",
      "Shortness of breath during activities",
      "Wheezing and chest tightness",
      "Frequent respiratory infections",
      "Fatigue and reduced exercise tolerance",
    ],
    acousticProfile: {
      crackles: true,
      wheezes: false,
      notes:
        "Prolonged expiratory phase, reduced breath sound intensity, end-inspiratory crackles in advanced disease.",
    },
    riskFactors: [
      "Smoking (primary)",
      "Air pollution",
      "Occupational dust/chemicals",
      "Alpha-1 antitrypsin deficiency",
    ],
    treatment: [
      "Bronchodilators (LABA/LAMA)",
      "Inhaled corticosteroids",
      "Pulmonary rehabilitation",
      "Oxygen therapy (severe)",
      "Smoking cessation",
    ],
    severity: "severe",
    prevalence: "~57 patients / 91 recordings in ICBHI dataset",
    keywords: [
      "copd",
      "chronic obstructive",
      "emphysema",
      "chronic bronchitis",
    ],
  },
  {
    id: "pneumonia",
    name: "Pneumonia",
    color: "#3b82f6",
    icon: "🦠",
    tagline: "Lung Parenchyma Infection",
    description:
      "An infection that inflames the air sacs in one or both lungs. Caused by bacteria, viruses, or fungi. Presents with consolidation patterns visible in acoustic features.",
    symptoms: [
      "High fever and chills",
      "Productive cough with coloured sputum",
      "Sharp chest pain when breathing",
      "Rapid breathing and shortness of breath",
      "Fatigue and nausea",
    ],
    acousticProfile: {
      crackles: true,
      wheezes: true,
      notes:
        "Fine end-inspiratory crackles, bronchial breath sounds over consolidated areas, possible pleural rub.",
    },
    riskFactors: [
      "Advanced age",
      "Immunosuppression",
      "Smoking",
      "Chronic disease",
      "Hospital exposure",
    ],
    treatment: [
      "Antibiotics (bacterial)",
      "Antivirals (viral)",
      "Rest and hydration",
      "Oxygen therapy",
      "Hospitalisation for severe cases",
    ],
    severity: "severe",
    prevalence: "~36 patients in ICBHI dataset",
    keywords: [
      "pneumonia",
      "lung infection",
      "consolidation",
      "respiratory infection",
    ],
  },
  {
    id: "bronchiectasis",
    name: "Bronchiectasis",
    color: "#8b5cf6",
    icon: "🔬",
    tagline: "Chronic Bronchial Dilation",
    description:
      "A chronic condition where the bronchi are permanently widened due to repeated infections or inflammation. Leads to mucus accumulation and persistent lung infections.",
    symptoms: [
      "Persistent daily cough producing large amounts of sputum",
      "Recurrent chest infections",
      "Breathlessness during physical activity",
      "Clubbing of fingers (advanced)",
      "Haemoptysis (coughing up blood)",
    ],
    acousticProfile: {
      crackles: true,
      wheezes: false,
      notes:
        "Persistent coarse crackles throughout inspiration and expiration. Characteristic of dilated bronchi with secretions.",
    },
    riskFactors: [
      "Cystic fibrosis",
      "Recurrent pneumonia",
      "Immune deficiency",
      "Allergic bronchopulmonary aspergillosis",
    ],
    treatment: [
      "Airway clearance techniques",
      "Long-term antibiotics",
      "Bronchodilators",
      "Surgery (localised disease)",
      "Vaccination",
    ],
    severity: "moderate",
    prevalence: "~44 patients in ICBHI dataset",
    keywords: [
      "bronchiectasis",
      "bronchial dilation",
      "dilated bronchi",
      "sputum",
    ],
  },
  {
    id: "bronchiolitis",
    name: "Bronchiolitis",
    color: "#f59e0b",
    icon: "👶",
    tagline: "Small Airway Inflammation",
    description:
      "An acute viral lower respiratory infection, predominantly affecting infants and young children. Causes inflammation and congestion in the bronchioles.",
    symptoms: [
      "Runny nose and mild fever initially",
      "Rapid or difficult breathing",
      "Wheezing on expiration",
      "Feeding difficulties in infants",
      "Persistent cough",
    ],
    acousticProfile: {
      crackles: true,
      wheezes: true,
      notes:
        "Combined crackles and high-pitched wheezes. Small-airway involvement creates a distinctive bilateral pattern easily distinguished from COPD.",
    },
    riskFactors: [
      "Age < 2 years",
      "RSV (primary pathogen)",
      "Premature birth",
      "Congenital heart disease",
      "Immunodeficiency",
    ],
    treatment: [
      "Supportive care (hydration, oxygen)",
      "Nebulised hypertonic saline",
      "Nasal suction",
      "Hospitalisation for severe cases",
      "No antibiotics unless secondary infection",
    ],
    severity: "moderate",
    prevalence: "~30 patients in ICBHI dataset",
    keywords: ["bronchiolitis", "rsv", "infant respiratory", "small airway"],
  },
  {
    id: "urti",
    name: "URTI",
    color: "#06b6d4",
    icon: "🤧",
    tagline: "Upper Respiratory Tract Infection",
    description:
      "Acute infections affecting the nose, sinuses, pharynx, or larynx. Most commonly caused by rhinovirus. Usually self-limiting but can progress to lower tract involvement.",
    symptoms: [
      "Runny or stuffy nose",
      "Sore throat and hoarseness",
      "Sneezing and mild cough",
      "Low-grade fever",
      "Nasal congestion",
    ],
    acousticProfile: {
      crackles: false,
      wheezes: true,
      notes:
        "Increased turbulence in upper airways. Mild wheezing pattern consistent with inflamed upper airway structures. Lower lung sounds are typically clear.",
    },
    riskFactors: [
      "Viral exposure (rhinovirus, coronavirus)",
      "Weakened immunity",
      "Cold dry weather",
      "Crowded environments",
      "Children in daycare",
    ],
    treatment: [
      "Rest and hydration",
      "Analgesics for pain/fever",
      "Decongestants",
      "Saline nasal rinse",
      "Self-limiting — antibiotics not effective",
    ],
    severity: "mild",
    prevalence: "~53 patients in ICBHI dataset",
    keywords: [
      "urti",
      "upper respiratory",
      "cold",
      "sore throat",
      "rhinitis",
      "common cold",
    ],
  },
  {
    id: "healthy",
    name: "Healthy",
    color: "#10b981",
    icon: "✅",
    tagline: "Normal Respiratory Function",
    description:
      "Normal lung sounds with a regular breathing pattern. No adventitious sounds detected. The respiratory cycle is regular and amplitude is consistent across all lung zones.",
    symptoms: [
      "No respiratory complaints",
      "Regular breathing pattern",
      "Clear breath sounds bilaterally",
      "Normal exercise tolerance",
      "No nocturnal symptoms",
    ],
    acousticProfile: {
      crackles: false,
      wheezes: false,
      notes:
        "Vesicular breath sounds in peripheral lung fields. Bronchovesicular sounds near the main bronchi. No adventitious sounds.",
    },
    riskFactors: ["N/A — normal respiratory state"],
    treatment: [
      "Maintain regular exercise",
      "Avoid smoking and pollutants",
      "Annual flu vaccination",
      "Good hand hygiene",
    ],
    severity: "mild",
    prevalence: "~36 patients in ICBHI dataset",
    keywords: ["healthy", "normal", "clear lungs", "no disease"],
  },
  {
    id: "lrti",
    name: "LRTI",
    color: "#14b8a6",
    icon: "🫀",
    tagline: "Lower Respiratory Tract Infection",
    description:
      "Infections involving the trachea, bronchi, bronchioles, or lung parenchyma. Encompasses acute bronchitis, pneumonia, and bronchiolitis as subtypes.",
    symptoms: [
      "Productive cough lasting more than 5 days",
      "Breathlessness and chest pain",
      "Fever and malaise",
      "Purulent sputum production",
      "Crackles on auscultation",
    ],
    acousticProfile: {
      crackles: true,
      wheezes: true,
      notes:
        "Variable presentation depending on specific pathogen. Crackles and wheezes co-present due to involvement of multiple airway levels.",
    },
    riskFactors: [
      "Viral URI progression",
      "Elderly or very young",
      "Immunocompromised",
      "Chronic lung disease",
      "Aspiration",
    ],
    treatment: [
      "Antibiotics if bacterial",
      "Bronchodilators",
      "Cough suppressants (use with caution)",
      "Hospitalisation if severe",
      "Oxygen as needed",
    ],
    severity: "moderate",
    prevalence: "Less common class in ICBHI dataset",
    keywords: ["lrti", "lower respiratory", "bronchitis", "chest infection"],
  },
  {
    id: "asthma",
    name: "Asthma",
    color: "#ec4899",
    icon: "💨",
    tagline: "Chronic Airway Hyperresponsiveness",
    description:
      "A chronic inflammatory condition of the airways resulting in recurrent episodes of wheezing, breathlessness, and coughing triggered by various stimuli.",
    symptoms: [
      "Episodic wheezing, especially at night",
      "Chest tightness",
      "Shortness of breath during attacks",
      "Coughing triggered by exercise or allergens",
      "Symptoms improve with bronchodilators",
    ],
    acousticProfile: {
      crackles: false,
      wheezes: true,
      notes:
        "High-pitched polyphonic wheezes on expiration. During severe attacks wheezes may be absent (silent chest) — a medical emergency.",
    },
    riskFactors: [
      "Family history",
      "Atopy (allergies, eczema)",
      "Air pollution",
      "Exercise",
      "Viral infections",
      "Aspirin sensitivity",
    ],
    treatment: [
      "Short-acting bronchodilators (SABA)",
      "Inhaled corticosteroids (ICS)",
      "Long-acting bronchodilators (LABA)",
      "Monoclonal antibodies (severe)",
      "Allergen avoidance",
    ],
    severity: "moderate",
    prevalence: "Present in ICBHI dataset as additional class",
    keywords: [
      "asthma",
      "wheeze",
      "airway hyperresponsiveness",
      "bronchospasm",
      "inhaler",
    ],
  },
];

export const CLASS_COLORS: Record<string, string> = {
  Asthma: "#ec4899",
  Bronchiectasis: "#8b5cf6",
  Bronchiolitis: "#f59e0b",
  COPD: "#ef4444",
  Healthy: "#10b981",
  LRTI: "#14b8a6",
  Pneumonia: "#3b82f6",
  URTI: "#06b6d4",
};

export const REPORT_DATA: Array<{
  cls: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}> = [];

export const RUNS_DATA = {
  labels: ["Epoch 50"],
  trainAccuracy: [82.12],
  valAccuracy: [73.44],
};
