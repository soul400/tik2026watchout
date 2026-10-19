/**
 * LivePulse Intelligence Lab 2.0 — Centralized Evidence Sufficiency Policy
 * Enforces rigorous forensic standards, prevents fabricated/default scores,
 * and maintains clear separation between verified identity, behavioral similarity, and insufficient evidence.
 */

import { VerdictStatus } from "./intelligence-types";

export interface EvidencePolicyConfig {
  /** Minimum number of events required to attempt any behavioral analysis for a single account */
  minEventsForBehavioral: number;
  /** Minimum distinct broadcast sessions required for behavioral pattern stability */
  minSessionsForBehavioral: number;
  /** Minimum number of events required for each account when comparing a pair */
  minEventsPerAccountForComparison: number;
  /** Minimum distinct sessions per account for pair comparison */
  minSessionsPerAccountForComparison: number;
}

export const DEFAULT_EVIDENCE_POLICY: EvidencePolicyConfig = {
  minEventsForBehavioral: 5,
  minSessionsForBehavioral: 2,
  minEventsPerAccountForComparison: 3,
  minSessionsPerAccountForComparison: 1,
};

export interface SufficiencyEvaluation {
  isSufficient: boolean;
  status: "SUFFICIENT" | "INSUFFICIENT_DATA";
  reason: string;
  dataLimitations: string[];
}

export class EvidencePolicyEngine {
  /**
   * Evaluates evidence sufficiency for a single account.
   */
  static evaluateSingleAccountSufficiency(
    eventsCount: number,
    sessionsCount: number,
    diamondsTotal: number = 0,
    config: EvidencePolicyConfig = DEFAULT_EVIDENCE_POLICY
  ): SufficiencyEvaluation {
    const limitations: string[] = [];

    if (eventsCount === 0) {
      return {
        isSufficient: false,
        status: "INSUFFICIENT_DATA",
        reason: "لا توجد أي أحداث مرصودة لهذا الحساب في قاعدة البيانات.",
        dataLimitations: ["غياب كامل لسجلات الأحداث المباشرة (0 أحداث)."],
      };
    }

    if (eventsCount < 3) {
      limitations.push(
        `حجم العينة ضئيل جداً (${eventsCount} حدث فقط). القاعدة المعتمدة: حدث أو حدثان لا يكفيان لتأسيس نمط إحصائي.`
      );
    }

    if (sessionsCount < config.minSessionsForBehavioral) {
      limitations.push(
        `النشاط محصور في ${sessionsCount} جلسة بث فقط. يلزم ما لا يقل عن ${config.minSessionsForBehavioral} جلسات متباعدة للتأكد من استقرار السلوك.`
      );
    }

    if (diamondsTotal === 0 && eventsCount < config.minEventsForBehavioral) {
      limitations.push("الحساب مسجل برصيد دعم 0 ماسة ودون تفاعل دوري كافٍ.");
    }

    const isSufficient =
      eventsCount >= 3 &&
      (sessionsCount >= config.minSessionsForBehavioral || diamondsTotal > 0 || eventsCount >= config.minEventsForBehavioral);

    return {
      isSufficient,
      status: isSufficient ? "SUFFICIENT" : "INSUFFICIENT_DATA",
      reason: isSufficient
        ? `بيانات كافية للتحليل: ${eventsCount} حدثاً عبر ${sessionsCount} جلسة.`
        : `بيانات غير كافية: ${eventsCount} حدثاً عبر ${sessionsCount} جلسة (الحد الأدنى ${config.minEventsForBehavioral} أحداث وجلستان).`,
      dataLimitations: limitations,
    };
  }

  /**
   * Evaluates evidence sufficiency for a comparison pair (Account A and Account B).
   */
  static evaluatePairSufficiency(
    eventsA: number,
    sessionsA: number,
    eventsB: number,
    sessionsB: number,
    config: EvidencePolicyConfig = DEFAULT_EVIDENCE_POLICY
  ): SufficiencyEvaluation {
    const limitations: string[] = [];

    if (eventsA < config.minEventsPerAccountForComparison) {
      limitations.push(
        `الطرف الأول لديه ${eventsA} أحداث فقط (الحد الأدنى للمقارنة ${config.minEventsPerAccountForComparison} أحداث).`
      );
    }

    if (eventsB < config.minEventsPerAccountForComparison) {
      limitations.push(
        `الطرف الثاني لديه ${eventsB} أحداث فقط (الحد الأدنى للمقارنة ${config.minEventsPerAccountForComparison} أحداث).`
      );
    }

    const isSufficient =
      eventsA >= config.minEventsPerAccountForComparison &&
      eventsB >= config.minEventsPerAccountForComparison;

    return {
      isSufficient,
      status: isSufficient ? "SUFFICIENT" : "INSUFFICIENT_DATA",
      reason: isSufficient
        ? `بيانات كافية للمقارنة: الطرف الأول (${eventsA} أحداث) والطرف الثاني (${eventsB} أحداث).`
        : `بيانات المقارنة غير كافية لعدم بلوغ الحد الأدنى المطلوب لكلا الطرفين (${config.minEventsPerAccountForComparison} أحداث لكل طرف).`,
      dataLimitations: limitations,
    };
  }
}
