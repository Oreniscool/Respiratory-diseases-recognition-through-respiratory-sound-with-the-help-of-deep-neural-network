// Disease knowledge base used by the Disease Library page and chatbot
export interface DiseaseInfo {
  id: string
  name: string
  color: string
  icon: string
  tagline: string
  description: string
  symptoms: string[]
  acousticProfile: {
    crackles: boolean
    wheezes: boolean
    notes: string
  }
  riskFactors: string[]
  treatment: string[]
  severity: 'mild' | 'moderate' | 'severe'
  prevalence: string
  keywords: string[]
}

export const DISEASES: DiseaseInfo[] = [
  {
    id: 'copd',
    name: 'COPD',
    color: '#ef4444',
    icon: '🫁',
    tagline: 'Chronic Obstructive Pulmonary Disease',
    description:
      'A chronic inflammatory lung disease causing obstructed airflow. Characterised by long-term respiratory symptoms and airflow limitation, often caused by smoking.',
    symptoms: [
      'Persistent cough with mucus',
      'Shortness of breath during activities',
      'Wheezing and chest tightness',
      'Frequent respiratory infections',
      'Fatigue and reduced exercise tolerance',
    ],
    acousticProfile: {
      crackles: true,
      wheezes: false,
      notes:
        'Prolonged expiratory phase, reduced breath sound intensity, end-inspiratory crackles in advanced disease.',
    },
    riskFactors: ['Smoking (primary)', 'Air pollution', 'Occupational dust/chemicals', 'Alpha-1 antitrypsin deficiency'],
    treatment: ['Bronchodilators (LABA/LAMA)', 'Inhaled corticosteroids', 'Pulmonary rehabilitation', 'Oxygen therapy (severe)', 'Smoking cessation'],
    severity: 'severe',
    prevalence: '~57 patients / 91 recordings in ICBHI dataset',
    keywords: ['copd', 'chronic obstructive', 'emphysema', 'chronic bronchitis'],
  },
  {
    id: 'pneumonia',
    name: 'Pneumonia',
    color: '#3b82f6',
    icon: '🦠',
    tagline: 'Lung Parenchyma Infection',
    description:
      'An infection that inflames the air sacs in one or both lungs. Caused by bacteria, viruses, or fungi. Presents with consolidation patterns visible in acoustic features.',
    symptoms: [
      'High fever and chills',
      'Productive cough with coloured sputum',
      'Sharp chest pain when breathing',
      'Rapid breathing and shortness of breath',
      'Fatigue and nausea',
    ],
    acousticProfile: {
      crackles: true,
      wheezes: true,
      notes:
        'Fine end-inspiratory crackles, bronchial breath sounds over consolidated areas, possible pleural rub.',
    },
    riskFactors: ['Advanced age', 'Immunosuppression', 'Smoking', 'Chronic disease', 'Hospital exposure'],
    treatment: ['Antibiotics (bacterial)', 'Antivirals (viral)', 'Rest and hydration', 'Oxygen therapy', 'Hospitalisation for severe cases'],
    severity: 'severe',
    prevalence: '~36 patients in ICBHI dataset',
    keywords: ['pneumonia', 'lung infection', 'consolidation', 'respiratory infection'],
  },
  {
    id: 'bronchiectasis',
    name: 'Bronchiectasis',
    color: '#8b5cf6',
    icon: '🔬',
    tagline: 'Chronic Bronchial Dilation',
    description:
      'A chronic condition where the bronchi are permanently widened due to repeated infections or inflammation. Leads to mucus accumulation and persistent lung infections.',
    symptoms: [
      'Persistent daily cough producing large amounts of sputum',
      'Recurrent chest infections',
      'Breathlessness during physical activity',
      'Clubbing of fingers (advanced)',
      'Haemoptysis (coughing up blood)',
    ],
    acousticProfile: {
      crackles: true,
      wheezes: false,
      notes:
        'Persistent coarse crackles throughout inspiration and expiration. Characteristic of dilated bronchi with secretions.',
    },
    riskFactors: ['Cystic fibrosis', 'Recurrent pneumonia', 'Immune deficiency', 'Allergic bronchopulmonary aspergillosis'],
    treatment: ['Airway clearance techniques', 'Long-term antibiotics', 'Bronchodilators', 'Surgery (localised disease)', 'Vaccination'],
    severity: 'moderate',
    prevalence: '~44 patients in ICBHI dataset',
    keywords: ['bronchiectasis', 'bronchial dilation', 'dilated bronchi', 'sputum'],
  },
  {
    id: 'bronchiolitis',
    name: 'Bronchiolitis',
    color: '#f59e0b',
    icon: '👶',
    tagline: 'Small Airway Inflammation',
    description:
      'An acute viral lower respiratory infection, predominantly affecting infants and young children. Causes inflammation and congestion in the bronchioles.',
    symptoms: [
      'Runny nose and mild fever initially',
      'Rapid or difficult breathing',
      'Wheezing on expiration',
      'Feeding difficulties in infants',
      'Persistent cough',
    ],
    acousticProfile: {
      crackles: true,
      wheezes: true,
      notes:
        'Combined crackles and high-pitched wheezes. Small-airway involvement creates a distinctive bilateral pattern easily distinguished from COPD.',
    },
    riskFactors: ['Age < 2 years', 'RSV (primary pathogen)', 'Premature birth', 'Congenital heart disease', 'Immunodeficiency'],
    treatment: ['Supportive care (hydration, oxygen)', 'Nebulised hypertonic saline', 'Nasal suction', 'Hospitalisation for severe cases', 'No antibiotics unless secondary infection'],
    severity: 'moderate',
    prevalence: '~30 patients in ICBHI dataset',
    keywords: ['bronchiolitis', 'rsv', 'infant respiratory', 'small airway'],
  },
  {
    id: 'urti',
    name: 'URTI',
    color: '#06b6d4',
    icon: '🤧',
    tagline: 'Upper Respiratory Tract Infection',
    description:
      'Acute infections affecting the nose, sinuses, pharynx, or larynx. Most commonly caused by rhinovirus. Usually self-limiting but can progress to lower tract involvement.',
    symptoms: [
      'Runny or stuffy nose',
      'Sore throat and hoarseness',
      'Sneezing and mild cough',
      'Low-grade fever',
      'Nasal congestion',
    ],
    acousticProfile: {
      crackles: false,
      wheezes: true,
      notes:
        'Increased turbulence in upper airways. Mild wheezing pattern consistent with inflamed upper airway structures. Lower lung sounds are typically clear.',
    },
    riskFactors: ['Viral exposure (rhinovirus, coronavirus)', 'Weakened immunity', 'Cold dry weather', 'Crowded environments', 'Children in daycare'],
    treatment: ['Rest and hydration', 'Analgesics for pain/fever', 'Decongestants', 'Saline nasal rinse', 'Self-limiting — antibiotics not effective'],
    severity: 'mild',
    prevalence: '~53 patients in ICBHI dataset',
    keywords: ['urti', 'upper respiratory', 'cold', 'sore throat', 'rhinitis', 'common cold'],
  },
  {
    id: 'healthy',
    name: 'Healthy',
    color: '#10b981',
    icon: '✅',
    tagline: 'Normal Respiratory Function',
    description:
      'Normal lung sounds with a regular breathing pattern. No adventitious sounds detected. The respiratory cycle is regular and amplitude is consistent across all lung zones.',
    symptoms: [
      'No respiratory complaints',
      'Regular breathing pattern',
      'Clear breath sounds bilaterally',
      'Normal exercise tolerance',
      'No nocturnal symptoms',
    ],
    acousticProfile: {
      crackles: false,
      wheezes: false,
      notes:
        'Vesicular breath sounds in peripheral lung fields. Bronchovesicular sounds near the main bronchi. No adventitious sounds.',
    },
    riskFactors: ['N/A — normal respiratory state'],
    treatment: ['Maintain regular exercise', 'Avoid smoking and pollutants', 'Annual flu vaccination', 'Good hand hygiene'],
    severity: 'mild',
    prevalence: '~36 patients in ICBHI dataset',
    keywords: ['healthy', 'normal', 'clear lungs', 'no disease'],
  },
  {
    id: 'lrti',
    name: 'LRTI',
    color: '#14b8a6',
    icon: '🫀',
    tagline: 'Lower Respiratory Tract Infection',
    description:
      'Infections involving the trachea, bronchi, bronchioles, or lung parenchyma. Encompasses acute bronchitis, pneumonia, and bronchiolitis as subtypes.',
    symptoms: [
      'Productive cough lasting more than 5 days',
      'Breathlessness and chest pain',
      'Fever and malaise',
      'Purulent sputum production',
      'Crackles on auscultation',
    ],
    acousticProfile: {
      crackles: true,
      wheezes: true,
      notes:
        'Variable presentation depending on specific pathogen. Crackles and wheezes co-present due to involvement of multiple airway levels.',
    },
    riskFactors: ['Viral URI progression', 'Elderly or very young', 'Immunocompromised', 'Chronic lung disease', 'Aspiration'],
    treatment: ['Antibiotics if bacterial', 'Bronchodilators', 'Cough suppressants (use with caution)', 'Hospitalisation if severe', 'Oxygen as needed'],
    severity: 'moderate',
    prevalence: 'Less common class in ICBHI dataset',
    keywords: ['lrti', 'lower respiratory', 'bronchitis', 'chest infection'],
  },
  {
    id: 'asthma',
    name: 'Asthma',
    color: '#ec4899',
    icon: '💨',
    tagline: 'Chronic Airway Hyperresponsiveness',
    description:
      'A chronic inflammatory condition of the airways resulting in recurrent episodes of wheezing, breathlessness, and coughing triggered by various stimuli.',
    symptoms: [
      'Episodic wheezing, especially at night',
      'Chest tightness',
      'Shortness of breath during attacks',
      'Coughing triggered by exercise or allergens',
      'Symptoms improve with bronchodilators',
    ],
    acousticProfile: {
      crackles: false,
      wheezes: true,
      notes:
        'High-pitched polyphonic wheezes on expiration. During severe attacks wheezes may be absent (silent chest) — a medical emergency.',
    },
    riskFactors: ['Family history', 'Atopy (allergies, eczema)', 'Air pollution', 'Exercise', 'Viral infections', 'Aspirin sensitivity'],
    treatment: ['Short-acting bronchodilators (SABA)', 'Inhaled corticosteroids (ICS)', 'Long-acting bronchodilators (LABA)', 'Monoclonal antibodies (severe)', 'Allergen avoidance'],
    severity: 'moderate',
    prevalence: 'Present in ICBHI dataset as additional class',
    keywords: ['asthma', 'wheeze', 'airway hyperresponsiveness', 'bronchospasm', 'inhaler'],
  },
]

export const CLASS_COLORS: Record<string, string> = {
  Asthma: '#ec4899',
  Bronchiectasis: '#8b5cf6',
  Bronchiolitis: '#f59e0b',
  COPD: '#ef4444',
  Healthy: '#10b981',
  LRTI: '#14b8a6',
  Pneumonia: '#3b82f6',
  URTI: '#06b6d4',
}

export const REPORT_DATA = [
  { cls: 'Bronchiectasis', precision: 0.98, recall: 1.0,  f1: 0.99, support: 44 },
  { cls: 'Bronchiolitis',  precision: 1.0,  recall: 1.0,  f1: 1.0,  support: 30 },
  { cls: 'COPD',          precision: 1.0,  recall: 0.91, f1: 0.95, support: 57 },
  { cls: 'Healthy',       precision: 0.94, recall: 0.92, f1: 0.93, support: 36 },
  { cls: 'Pneumonia',     precision: 0.92, recall: 1.0,  f1: 0.96, support: 36 },
  { cls: 'URTI',          precision: 0.94, recall: 0.96, f1: 0.94, support: 53 },
]

export const RUNS_DATA = {
  labels: ['Run 1','Run 2','Run 3','Run 4','Run 5','Run 6','Run 7','Run 8','Run 9','Run 10'],
  accuracy:  [95.25,95.67,96.05,94.90,94.86,96.04,95.65,96.04,95.65,96.04],
  precision: [95.48,95.89,96.21,95.07,95.09,96.23,95.89,96.18,95.99,96.25],
  recall:    [95.26,95.65,96.05,94.86,94.86,96.05,95.65,96.05,95.65,96.05],
  f1:        [95.22,95.66,96.04,94.85,94.87,96.03,95.66,96.04,95.66,96.01],
}

export const MOCK_RESULTS: Record<string, {
  prediction: string; confidence: number; probabilities: Record<string, number>; duration_s: number; sample_rate: number
}> = {
  healthy:        { prediction: 'Healthy',        confidence: 94.2, duration_s: 24.7, sample_rate: 44100, probabilities: { Healthy: 94.2, COPD: 1.8, URTI: 1.5, Bronchiectasis: 1.2, Pneumonia: 0.8, Bronchiolitis: 0.5 } },
  copd:           { prediction: 'COPD',            confidence: 91.3, duration_s: 18.3, sample_rate: 44100, probabilities: { COPD: 91.3, Healthy: 4.1, URTI: 2.8, Bronchiectasis: 1.0, Pneumonia: 0.5, Bronchiolitis: 0.3 } },
  urti:           { prediction: 'URTI',            confidence: 96.7, duration_s: 32.1, sample_rate: 44100, probabilities: { URTI: 96.7, Healthy: 1.4, COPD: 0.8, Bronchiectasis: 0.6, Pneumonia: 0.3, Bronchiolitis: 0.2 } },
  bronchiectasis: { prediction: 'Bronchiectasis',  confidence: 98.5, duration_s: 21.5, sample_rate: 44100, probabilities: { Bronchiectasis: 98.5, Healthy: 0.7, COPD: 0.4, URTI: 0.2, Pneumonia: 0.1, Bronchiolitis: 0.1 } },
  pneumonia:      { prediction: 'Pneumonia',        confidence: 92.1, duration_s: 28.6, sample_rate: 44100, probabilities: { Pneumonia: 92.1, Healthy: 3.4, URTI: 2.1, COPD: 1.5, Bronchiectasis: 0.6, Bronchiolitis: 0.3 } },
  bronchiolitis:  { prediction: 'Bronchiolitis',   confidence: 99.2, duration_s: 16.8, sample_rate: 44100, probabilities: { Bronchiolitis: 99.2, Pneumonia: 0.4, COPD: 0.2, Healthy: 0.1, URTI: 0.1, Bronchiectasis: 0.0 } },
}
