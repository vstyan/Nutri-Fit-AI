import { describe, it, expect } from 'vitest';
import {
  CHOLESTEROL_CONVERSION_FACTOR,
  TRIGLYCERIDES_CONVERSION_FACTOR,
  mgDlToMmolL,
  mmolLToMgDl,
  formatLipidValue,
  getTotalCholesterolStatus,
  getLdlStatus,
  getHdlStatus,
  getTriglyceridesStatus,
  getCholesterolRatio,
  getNonHdlCholesterol
} from '../utils/lipidCalculator';

describe('Lipid Calculator - Conversion Constants and Units', () => {
  it('uses standard clinical conversion constants', () => {
    expect(CHOLESTEROL_CONVERSION_FACTOR).toBe(38.67);
    expect(TRIGLYCERIDES_CONVERSION_FACTOR).toBe(88.57);
  });

  describe('mgDlToMmolL', () => {
    it('accurately converts cholesterol biomarkers using 38.67 factor', () => {
      // 200 mg/dL / 38.67 = 5.172... -> 5.17
      expect(mgDlToMmolL(200, 'total')).toBe(5.17);
      // 100 mg/dL / 38.67 = 2.586... -> 2.59
      expect(mgDlToMmolL(100, 'ldl')).toBe(2.59);
      // 50 mg/dL / 38.67 = 1.293... -> 1.29
      expect(mgDlToMmolL(50, 'hdl')).toBe(1.29);
    });

    it('accurately converts triglycerides using 88.57 factor', () => {
      // 150 mg/dL / 88.57 = 1.693... -> 1.69
      expect(mgDlToMmolL(150, 'triglycerides')).toBe(1.69);
      // 200 mg/dL / 88.57 = 2.258... -> 2.26
      expect(mgDlToMmolL(200, 'triglycerides')).toBe(2.26);
    });

    it('gracefully handles 0, NaN, and negative inputs', () => {
      expect(mgDlToMmolL(0, 'total')).toBe(0);
      expect(mgDlToMmolL(NaN, 'ldl')).toBe(0);
    });
  });

  describe('mmolLToMgDl', () => {
    it('accurately converts mmol/L to mg/dL for cholesterol biomarkers', () => {
      // 5.17 * 38.67 = 199.92 -> 200
      expect(mmolLToMgDl(5.17, 'total')).toBe(200);
      // 2.59 * 38.67 = 100.15 -> 100
      expect(mmolLToMgDl(2.59, 'ldl')).toBe(100);
    });

    it('accurately converts mmol/L to mg/dL for triglycerides', () => {
      // 1.69 * 88.57 = 149.68 -> 150
      expect(mmolLToMgDl(1.69, 'triglycerides')).toBe(150);
    });

    it('gracefully handles 0 and NaN inputs', () => {
      expect(mmolLToMgDl(0, 'total')).toBe(0);
      expect(mmolLToMgDl(NaN, 'total')).toBe(0);
    });
  });

  describe('formatLipidValue', () => {
    it('formats values in mg/dL as rounded whole numbers', () => {
      expect(formatLipidValue(199.6, 'mg_dl', 'total')).toBe('200');
      expect(formatLipidValue(150.2, 'mg_dl', 'triglycerides')).toBe('150');
    });

    it('formats values in mmol/L with 2 decimal places', () => {
      expect(formatLipidValue(200, 'mmol_l', 'total')).toBe('5.17');
      expect(formatLipidValue(150, 'mmol_l', 'triglycerides')).toBe('1.69');
    });

    it('returns "--" for null or undefined values', () => {
      expect(formatLipidValue(undefined as unknown as number, 'mg_dl', 'total')).toBe('--');
      expect(formatLipidValue(null as unknown as number, 'mmol_l', 'ldl')).toBe('--');
    });
  });
});

describe('Lipid Status Evaluations & Clinical Thresholds', () => {
  describe('getTotalCholesterolStatus', () => {
    it('identifies Unknown status for invalid or zero inputs', () => {
      expect(getTotalCholesterolStatus(0).label).toBe('Unknown');
      expect(getTotalCholesterolStatus(-10).label).toBe('Unknown');
    });

    it('categorizes < 200 mg/dL as Desirable', () => {
      const res = getTotalCholesterolStatus(190);
      expect(res.label).toBe('Desirable');
      expect(res.status).toBe('desirable');
    });

    it('categorizes 200-239 mg/dL as Borderline', () => {
      expect(getTotalCholesterolStatus(200).label).toBe('Borderline');
      expect(getTotalCholesterolStatus(220).label).toBe('Borderline');
      expect(getTotalCholesterolStatus(239).label).toBe('Borderline');
    });

    it('categorizes >= 240 mg/dL as High risk', () => {
      expect(getTotalCholesterolStatus(240).label).toBe('High');
      expect(getTotalCholesterolStatus(300).label).toBe('High');
      expect(getTotalCholesterolStatus(240).status).toBe('high');
    });
  });

  describe('getLdlStatus', () => {
    it('identifies Unknown status for invalid inputs', () => {
      expect(getLdlStatus(0).label).toBe('Unknown');
    });

    it('categorizes < 100 mg/dL as Optimal', () => {
      const res = getLdlStatus(85);
      expect(res.label).toBe('Optimal');
      expect(res.status).toBe('optimal');
    });

    it('categorizes 100-129 mg/dL as Near Optimal', () => {
      expect(getLdlStatus(100).label).toBe('Near Optimal');
      expect(getLdlStatus(129).label).toBe('Near Optimal');
    });

    it('categorizes 130-159 mg/dL as Borderline', () => {
      expect(getLdlStatus(130).label).toBe('Borderline');
      expect(getLdlStatus(159).label).toBe('Borderline');
    });

    it('categorizes 160-189 mg/dL as High', () => {
      expect(getLdlStatus(160).label).toBe('High');
      expect(getLdlStatus(189).label).toBe('High');
    });

    it('categorizes >= 190 mg/dL as Very High', () => {
      const res = getLdlStatus(190);
      expect(res.label).toBe('Very High');
      expect(res.status).toBe('very_high');
    });
  });

  describe('getHdlStatus (Gender-Specific)', () => {
    it('identifies Protective (>= 60 mg/dL) for both men and women', () => {
      expect(getHdlStatus(60, 'male').label).toBe('Protective');
      expect(getHdlStatus(75, 'female').label).toBe('Protective');
      expect(getHdlStatus(60, 'male').status).toBe('optimal');
    });

    it('evaluates male thresholds (Normal: 40-59, Low: < 40)', () => {
      expect(getHdlStatus(40, 'male').label).toBe('Normal');
      expect(getHdlStatus(55, 'male').label).toBe('Normal');
      const low = getHdlStatus(38, 'male');
      expect(low.label).toBe('Low');
      expect(low.status).toBe('low');
    });

    it('evaluates female thresholds (Normal: 50-59, Low: < 50)', () => {
      expect(getHdlStatus(50, 'female').label).toBe('Normal');
      expect(getHdlStatus(55, 'female').label).toBe('Normal');
      const low = getHdlStatus(45, 'female');
      expect(low.label).toBe('Low');
      expect(low.status).toBe('low');
    });
  });

  describe('getTriglyceridesStatus', () => {
    it('categorizes < 150 mg/dL as Normal', () => {
      const res = getTriglyceridesStatus(130);
      expect(res.label).toBe('Normal');
      expect(res.status).toBe('optimal');
    });

    it('categorizes 150-199 mg/dL as Borderline', () => {
      expect(getTriglyceridesStatus(150).label).toBe('Borderline');
      expect(getTriglyceridesStatus(199).label).toBe('Borderline');
      expect(getTriglyceridesStatus(180).status).toBe('borderline');
    });

    it('categorizes 200-499 mg/dL as High', () => {
      expect(getTriglyceridesStatus(200).label).toBe('High');
      expect(getTriglyceridesStatus(499).label).toBe('High');
      expect(getTriglyceridesStatus(350).status).toBe('high');
    });

    it('categorizes >= 500 mg/dL as Very High', () => {
      expect(getTriglyceridesStatus(500).label).toBe('Very High');
      expect(getTriglyceridesStatus(600).status).toBe('very_high');
    });
  });

  describe('getCholesterolRatio (Total / HDL)', () => {
    it('returns null and Unknown status if values are missing or invalid', () => {
      const res = getCholesterolRatio(200, 0);
      expect(res.ratio).toBeNull();
      expect(res.ratioStr).toBe('--');
      expect(res.status.label).toBe('Unknown');
    });

    it('evaluates Optimal Ratio (< 3.5)', () => {
      // 160 / 50 = 3.2
      const res = getCholesterolRatio(160, 50);
      expect(res.ratio).toBe(3.2);
      expect(res.ratioStr).toBe('3.2');
      expect(res.status.label).toBe('Optimal Ratio');
      expect(res.status.status).toBe('optimal');
    });

    it('evaluates Average Ratio (3.5 - 5.0)', () => {
      // 200 / 50 = 4.0
      const res = getCholesterolRatio(200, 50);
      expect(res.ratio).toBe(4.0);
      expect(res.status.label).toBe('Average Ratio');
      expect(res.status.status).toBe('normal');
    });

    it('evaluates Elevated Ratio (> 5.0)', () => {
      // 260 / 45 = 5.777 -> 5.8
      const res = getCholesterolRatio(260, 45);
      expect(res.ratio).toBe(5.8);
      expect(res.status.label).toBe('Elevated Ratio');
      expect(res.status.status).toBe('high');
    });
  });

  describe('getNonHdlCholesterol (Total - HDL)', () => {
    it('returns null and Unknown when total <= HDL or inputs are invalid', () => {
      const res = getNonHdlCholesterol(150, 160, 'mg_dl');
      expect(res.valueMgDl).toBeNull();
      expect(res.formatted).toBe('--');
      expect(res.status.label).toBe('Unknown');
    });

    it('correctly calculates and categorizes non-HDL cholesterol', () => {
      // Optimal: < 130
      const opt = getNonHdlCholesterol(180, 60, 'mg_dl');
      expect(opt.valueMgDl).toBe(120);
      expect(opt.formatted).toBe('120');
      expect(opt.status.label).toBe('Optimal');

      // Borderline: 130 - 159
      const border = getNonHdlCholesterol(200, 55, 'mg_dl');
      expect(border.valueMgDl).toBe(145);
      expect(border.formatted).toBe('145');
      expect(border.status.label).toBe('Borderline');

      // High: >= 160
      const high = getNonHdlCholesterol(240, 50, 'mg_dl');
      expect(high.valueMgDl).toBe(190);
      expect(high.formatted).toBe('190');
      expect(high.status.label).toBe('High');
    });

    it('formats Non-HDL in mmol/L accurately', () => {
      // 120 mg/dL / 38.67 = 3.10 mmol/L
      const res = getNonHdlCholesterol(180, 60, 'mmol_l');
      expect(res.valueMgDl).toBe(120);
      expect(res.formatted).toBe('3.10');
    });
  });
});
