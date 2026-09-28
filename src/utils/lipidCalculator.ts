import { BloodLipidRecord, LipidUnit } from '../types';

export const CHOLESTEROL_CONVERSION_FACTOR = 38.67; // 1 mmol/L = 38.67 mg/dL
export const TRIGLYCERIDES_CONVERSION_FACTOR = 88.57; // 1 mmol/L = 88.57 mg/dL

export type BiomarkerType = 'total' | 'ldl' | 'hdl' | 'triglycerides';

export interface LipidStatus {
  label: string;
  status: 'optimal' | 'desirable' | 'normal' | 'borderline' | 'high' | 'very_high' | 'low';
  color: string; // Tailwind text color
  badgeBg: string; // Tailwind bg
  badgeBorder: string; // Tailwind border
  description: string;
}

/**
 * Convert value from mg/dL to mmol/L
 */
export function mgDlToMmolL(value: number, type: BiomarkerType): number {
  if (!value || isNaN(value)) return 0;
  const factor = type === 'triglycerides' ? TRIGLYCERIDES_CONVERSION_FACTOR : CHOLESTEROL_CONVERSION_FACTOR;
  return Math.round((value / factor) * 100) / 100;
}

/**
 * Convert value from mmol/L to mg/dL
 */
export function mmolLToMgDl(value: number, type: BiomarkerType): number {
  if (!value || isNaN(value)) return 0;
  const factor = type === 'triglycerides' ? TRIGLYCERIDES_CONVERSION_FACTOR : CHOLESTEROL_CONVERSION_FACTOR;
  return Math.round(value * factor);
}

/**
 * Format a canonical mg/dL value into the desired display unit string
 */
export function formatLipidValue(mgDlValue: number, unit: LipidUnit, type: BiomarkerType): string {
  if (!mgDlValue && mgDlValue !== 0) return '--';
  if (unit === 'mmol_l') {
    return mgDlToMmolL(mgDlValue, type).toFixed(2);
  }
  return String(Math.round(mgDlValue));
}

/**
 * Clinical assessment for Total Cholesterol (mg/dL)
 */
export function getTotalCholesterolStatus(mgDl: number): LipidStatus {
  if (!mgDl || mgDl <= 0) {
    return {
      label: 'Unknown',
      status: 'normal',
      color: 'text-slate-400',
      badgeBg: 'bg-slate-800/80',
      badgeBorder: 'border-slate-700',
      description: 'Enter your test result'
    };
  }
  if (mgDl < 200) {
    return {
      label: 'Desirable',
      status: 'desirable',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/70',
      badgeBorder: 'border-emerald-500/30',
      description: 'Optimal target (< 200 mg/dL / < 5.2 mmol/L)'
    };
  }
  if (mgDl <= 239) {
    return {
      label: 'Borderline',
      status: 'borderline',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/70',
      badgeBorder: 'border-amber-500/30',
      description: 'Borderline high (200–239 mg/dL / 5.2–6.2 mmol/L)'
    };
  }
  return {
    label: 'High',
    status: 'high',
    color: 'text-rose-400',
    badgeBg: 'bg-rose-950/70',
    badgeBorder: 'border-rose-500/30',
    description: 'High risk (≥ 240 mg/dL / ≥ 6.2 mmol/L)'
  };
}

/**
 * Clinical assessment for LDL Cholesterol (mg/dL)
 */
export function getLdlStatus(mgDl: number): LipidStatus {
  if (!mgDl || mgDl <= 0) {
    return {
      label: 'Unknown',
      status: 'normal',
      color: 'text-slate-400',
      badgeBg: 'bg-slate-800/80',
      badgeBorder: 'border-slate-700',
      description: 'Enter your LDL'
    };
  }
  if (mgDl < 100) {
    return {
      label: 'Optimal',
      status: 'optimal',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/70',
      badgeBorder: 'border-emerald-500/30',
      description: 'Optimal target (< 100 mg/dL / < 2.6 mmol/L)'
    };
  }
  if (mgDl <= 129) {
    return {
      label: 'Near Optimal',
      status: 'normal',
      color: 'text-teal-400',
      badgeBg: 'bg-teal-950/70',
      badgeBorder: 'border-teal-500/30',
      description: 'Acceptable (100–129 mg/dL / 2.6–3.3 mmol/L)'
    };
  }
  if (mgDl <= 159) {
    return {
      label: 'Borderline',
      status: 'borderline',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/70',
      badgeBorder: 'border-amber-500/30',
      description: 'Borderline high (130–159 mg/dL / 3.4–4.1 mmol/L)'
    };
  }
  if (mgDl <= 189) {
    return {
      label: 'High',
      status: 'high',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-950/70',
      badgeBorder: 'border-rose-500/30',
      description: 'High (160–189 mg/dL / 4.1–4.9 mmol/L)'
    };
  }
  return {
    label: 'Very High',
    status: 'very_high',
    color: 'text-rose-500',
    badgeBg: 'bg-rose-950/90',
    badgeBorder: 'border-rose-500/50',
    description: 'Very high risk (≥ 190 mg/dL / ≥ 4.9 mmol/L)'
  };
}

/**
 * Clinical assessment for HDL Cholesterol (mg/dL) - Higher is better!
 */
export function getHdlStatus(mgDl: number, gender: 'male' | 'female' = 'male'): LipidStatus {
  if (!mgDl || mgDl <= 0) {
    return {
      label: 'Unknown',
      status: 'normal',
      color: 'text-slate-400',
      badgeBg: 'bg-slate-800/80',
      badgeBorder: 'border-slate-700',
      description: 'Enter your HDL'
    };
  }
  if (mgDl >= 60) {
    return {
      label: 'Protective',
      status: 'optimal',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/70',
      badgeBorder: 'border-emerald-500/30',
      description: 'High & cardio-protective (≥ 60 mg/dL / ≥ 1.55 mmol/L)'
    };
  }
  const lowThreshold = gender === 'female' ? 50 : 40;
  if (mgDl >= lowThreshold) {
    return {
      label: 'Normal',
      status: 'normal',
      color: 'text-sky-400',
      badgeBg: 'bg-sky-950/70',
      badgeBorder: 'border-sky-500/30',
      description: 'Acceptable range (40–59 mg/dL)'
    };
  }
  return {
    label: 'Low',
    status: 'low',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-950/70',
    badgeBorder: 'border-amber-500/30',
    description: `Low (< ${lowThreshold} mg/dL, risk factor)`
  };
}

/**
 * Clinical assessment for Triglycerides (mg/dL)
 */
export function getTriglyceridesStatus(mgDl: number): LipidStatus {
  if (!mgDl || mgDl <= 0) {
    return {
      label: 'Unknown',
      status: 'normal',
      color: 'text-slate-400',
      badgeBg: 'bg-slate-800/80',
      badgeBorder: 'border-slate-700',
      description: 'Enter triglycerides'
    };
  }
  if (mgDl < 150) {
    return {
      label: 'Normal',
      status: 'optimal',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/70',
      badgeBorder: 'border-emerald-500/30',
      description: 'Normal (< 150 mg/dL / < 1.7 mmol/L)'
    };
  }
  if (mgDl <= 199) {
    return {
      label: 'Borderline',
      status: 'borderline',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/70',
      badgeBorder: 'border-amber-500/30',
      description: 'Borderline high (150–199 mg/dL / 1.7–2.3 mmol/L)'
    };
  }
  if (mgDl <= 499) {
    return {
      label: 'High',
      status: 'high',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-950/70',
      badgeBorder: 'border-rose-500/30',
      description: 'High (200–499 mg/dL / 2.3–5.6 mmol/L)'
    };
  }
  return {
    label: 'Very High',
    status: 'very_high',
    color: 'text-rose-500',
    badgeBg: 'bg-rose-950/90',
    badgeBorder: 'border-rose-500/50',
    description: 'Very high (≥ 500 mg/dL / ≥ 5.7 mmol/L)'
  };
}

/**
 * Calculate Total / HDL Ratio
 */
export function getCholesterolRatio(totalMgDl: number, hdlMgDl: number): {
  ratio: number | null;
  ratioStr: string;
  status: LipidStatus;
} {
  if (!totalMgDl || !hdlMgDl || hdlMgDl <= 0) {
    return {
      ratio: null,
      ratioStr: '--',
      status: {
        label: 'Unknown',
        status: 'normal',
        color: 'text-slate-400',
        badgeBg: 'bg-slate-800/80',
        badgeBorder: 'border-slate-700',
        description: 'Requires Total & HDL'
      }
    };
  }

  const ratio = Math.round((totalMgDl / hdlMgDl) * 10) / 10;
  const ratioStr = ratio.toFixed(1);

  if (ratio < 3.5) {
    return {
      ratio,
      ratioStr,
      status: {
        label: 'Optimal Ratio',
        status: 'optimal',
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-950/70',
        badgeBorder: 'border-emerald-500/30',
        description: 'Ideal cardiovascular ratio (< 3.5)'
      }
    };
  }
  if (ratio <= 5.0) {
    return {
      ratio,
      ratioStr,
      status: {
        label: 'Average Ratio',
        status: 'normal',
        color: 'text-sky-400',
        badgeBg: 'bg-sky-950/70',
        badgeBorder: 'border-sky-500/30',
        description: 'Standard risk ratio (3.5–5.0)'
      }
    };
  }
  return {
    ratio,
    ratioStr,
    status: {
      label: 'Elevated Ratio',
      status: 'high',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-950/70',
      badgeBorder: 'border-rose-500/30',
      description: 'Elevated cardiovascular risk (> 5.0)'
    }
  };
}

/**
 * Calculate Non-HDL Cholesterol (Total - HDL)
 */
export function getNonHdlCholesterol(totalMgDl: number, hdlMgDl: number, unit: LipidUnit): {
  valueMgDl: number | null;
  formatted: string;
  status: LipidStatus;
} {
  if (!totalMgDl || !hdlMgDl || totalMgDl <= hdlMgDl) {
    return {
      valueMgDl: null,
      formatted: '--',
      status: {
        label: 'Unknown',
        status: 'normal',
        color: 'text-slate-400',
        badgeBg: 'bg-slate-800/80',
        badgeBorder: 'border-slate-700',
        description: 'Total - HDL'
      }
    };
  }

  const nonHdl = Math.round(totalMgDl - hdlMgDl);
  const formatted = formatLipidValue(nonHdl, unit, 'ldl');

  if (nonHdl < 130) {
    return {
      valueMgDl: nonHdl,
      formatted,
      status: {
        label: 'Optimal',
        status: 'optimal',
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-950/70',
        badgeBorder: 'border-emerald-500/30',
        description: 'Optimal target (< 130 mg/dL / < 3.4 mmol/L)'
      }
    };
  }
  if (nonHdl <= 159) {
    return {
      valueMgDl: nonHdl,
      formatted,
      status: {
        label: 'Borderline',
        status: 'borderline',
        color: 'text-amber-400',
        badgeBg: 'bg-amber-950/70',
        badgeBorder: 'border-amber-500/30',
        description: 'Borderline (130–159 mg/dL / 3.4–4.1 mmol/L)'
      }
    };
  }
  return {
    valueMgDl: nonHdl,
    formatted,
    status: {
      label: 'High',
      status: 'high',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-950/70',
      badgeBorder: 'border-rose-500/30',
      description: 'High atherogenic particles (≥ 160 mg/dL)'
    }
  };
}
