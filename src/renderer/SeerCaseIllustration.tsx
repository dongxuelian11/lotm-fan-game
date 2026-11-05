import { SeerBookmark } from "./SeerBookmark";

/** Original pen-and-ink material studies, drawn for this game.
 * Only objects named in the public case opening appear here. The marks are
 * decorative, not readable evidence; no defect, answer or outcome is pictured.
 * Deliberately accepts no status, observation, choice or saved-state data.
 */
export function SeerCaseIllustration({ caseId }: { caseId: string }) {
  if (caseId === "folded-bookmark") return <SeerBookmark />;
  if (!["packing-list", "loose-display", "copied-warning"].includes(caseId)) return null;

  return (
    <svg className="seer-case-illustration" viewBox="0 0 100 116" aria-hidden="true" focusable="false" data-case-art={caseId}>
      <ellipse cx="51" cy="105" rx="35" ry="4" fill="#61533d18" />
      <g stroke="#79684f" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
        {caseId === "packing-list" && <>
          <path d="m24 12 51 3-5 85-52-4Z" fill="#f0e7cf" />
          <path d="m30 21 32 2m-33 4 23 2m-25 8 37 2m-38 7 37 2m-37 7 36 2m-37 7 37 2m-37 7 36 2m-36 7 35 2m-5-51-3 53" fill="none" strokeOpacity=".5" />
          <path d="m26 87 11 1m5 0 9 1m6 0 6 1" fill="none" strokeOpacity=".4" />
        </>}
        {caseId === "loose-display" && <>
          <path d="m18 21 65 4-5 76-66-5Z" fill="#efe7d1" />
          <g fill="none" stroke="#62716b">
            <path d="m29 40 29 2 12-6-30-2Zm0 0-2 38m31-36-2 38m14-44-2 38M28 56l29 2 12-6M27 72l29 2 12-6" />
            <path d="m32 58 20 1m-21 4 20 1m10-9 4-2" strokeOpacity=".35" />
            <path d="m22 84 45 3m-45-2 2-3m41 6 2-3M76 41l-2 37m-2-36 6-1m-7 36 6 1" strokeWidth=".7" strokeOpacity=".6" />
          </g>
          <path d="m24 29 9 1m-11 62 16 1m6 0 11 1m5 0 8 1" fill="none" strokeOpacity=".4" />
          <path d="m17 99 18-2m32 5 17-2" fill="none" strokeOpacity=".25" />
        </>}
        {caseId === "copied-warning" && <>
          <path d="m13 19 43-6 11 78-44 7Z" fill="#ded1b1" />
          <path d="m20 27 27-4m-27 9 30-4m-29 12 29-4m-28 12 28-4m-27 12 28-4m-27 12 28-4m-27 12 27-4m-26 12 23-3" fill="none" strokeOpacity=".35" />
          <path d="m43 24 39 5-8 72-42-5Z" fill="#f0e7cf" />
          <path d="m82 29-2 15-12-2 2-15" fill="#e2d6b9" />
          <path d="m49 36 12 2m-13 6 14 2m-15 7 26 3m-27 5 26 3m-27 6 26 3m-27 5 25 3m-26 6 17 2" fill="none" strokeOpacity=".5" />
          <path d="m36 99 14 2m7 1 14 2" fill="none" strokeOpacity=".25" />
        </>}
      </g>
    </svg>
  );
}
