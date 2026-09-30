/**
 * NutriFit AI - Terms of Service & Health Disclaimer Content
 * Version 1.0 (September 2026)
 */

export const TERMS_VERSION = '1.0';
export const TERMS_LAST_UPDATED = 'September 2026';

export interface TermsSection {
  id: string;
  number: number;
  title: string;
  badge?: string;
  badgeColor?: string;
  paragraphs: string[];
  bulletPoints?: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'acceptance',
    number: 1,
    title: 'Acceptance of Terms',
    paragraphs: [
      'By downloading, accessing, installing, or using NutriFit AI ("the Application"), you ("the User") agree to be legally bound by these Terms of Service and Health Disclaimer ("Agreement"). If you do not agree with any part of this Agreement, you must not access or use the Application.'
    ]
  },
  {
    id: 'medical-disclaimer',
    number: 2,
    title: 'NOT Medical Advice — Informational & Educational Use Only',
    badge: 'Crucial Notice',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    paragraphs: [
      'No Doctor-Patient Relationship: NutriFit AI is a personal lifestyle, wellness, and dietary logging software application. The Application, its developers, and its operators do not provide medical advice, clinical diagnoses, medical treatment, or prescriptions.',
      'Consult Your Physician: The Application is not a substitute for professional medical advice, diagnosis, or treatment by a licensed physician, registered dietitian, or certified healthcare provider. Always consult a qualified medical professional before starting any diet, caloric deficit or surplus, macronutrient modification, intermittent fasting protocol, cardiovascular regimen, or weight-training program, especially if you have pre-existing medical conditions (including, but not limited to, diabetes, cardiovascular disease, hypertension, kidney disease, eating disorders, or metabolic conditions).',
      'Emergency Situations: If you believe you are experiencing a medical emergency, acute chest pain, shortness of breath, severe hypoglycemia, or an allergic reaction, immediately stop using the Application and call 911 (or your local emergency services).'
    ]
  },
  {
    id: 'ai-disclaimer',
    number: 3,
    title: 'Artificial Intelligence (AI) Output & Accuracy Disclaimer',
    badge: 'AI Technology',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    paragraphs: [
      'Probabilistic Technology: NutriFit AI utilizes generative artificial intelligence (including Google Gemini models) for computer vision meal recognition, nutritional estimations, voice workout parsing, and automated coaching recommendations.',
      'Potential for Errors & Hallucinations: You acknowledge that AI technology is inherently experimental and probabilistic. AI-generated analyses, macronutrient estimates, and coaching feedback may contain errors, omissions, misidentifications, or inaccuracies.',
      'User Verification Responsibility: You are solely responsible for verifying the accuracy of food portions, ingredients, nutritional values, allergen warnings, and exercise metrics before relying on them. Never consume foods or engage in exercises based solely on an automated AI recommendation without your own independent verification and common sense.'
    ]
  },
  {
    id: 'allergies',
    number: 4,
    title: 'Food Allergies & Dietary Restrictions',
    badge: 'Allergen Warning',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    paragraphs: [
      'NutriFit AI cannot guarantee the identification of allergens (such as peanuts, tree nuts, gluten, dairy, shellfish, eggs, or sulfites) in scanned photos, ingredient lists, or voice descriptions. You assume full and sole responsibility for verifying that foods you consume are safe for your specific allergies and dietary restrictions.'
    ]
  },
  {
    id: 'assumption-of-risk',
    number: 5,
    title: 'Assumption of Risk & "Use at Your Own Risk"',
    badge: 'Sole Risk',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    paragraphs: [
      'Voluntary Participation: You acknowledge that physical exercise and dietary changes carry inherent risks of illness, injury, or physical harm.',
      'Sole Risk: YOU EXPRESSLY AGREE THAT YOUR USE OF NUTRIFIT AI IS AT YOUR OWN SOLE AND EXCLUSIVE RISK. You voluntarily assume all known and unknown risks associated with your nutrition and physical activities.'
    ]
  },
  {
    id: 'limitation-of-liability',
    number: 6,
    title: 'Limitation of Liability & "AS IS" Provision',
    paragraphs: [
      'Provided "AS IS": NutriFit AI is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied, including fitness for a particular purpose or accuracy of data.',
      'Release of Claims: To the fullest extent permitted by applicable law, in no event shall the developer, creator, or operators of NutriFit AI be liable for any direct, indirect, incidental, punitive, consequential, or special damages, injuries, illnesses, or claims arising out of or in connection with your use of the Application, reliance on AI coach recommendations, or synchronization with third-party services (such as Google Fit).'
    ]
  }
];
