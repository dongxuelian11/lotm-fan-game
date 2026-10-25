import type { ReactNode } from "react";

/** Original pen-and-engraving studies for the four existing actions; decorative, not inventory. */
export function LifeActionVignette({ kind }: { kind: string }) {
  const studies: Record<string, ReactNode> = {
    WORK: <>
      <path className="life-vignette-wash" d="M13 18H65V40H13Z" />
      <path d="M13 18H65V40H13ZM13 18L18 13H60L65 18M28 13V7H50V13M32 13V10H46V13M13 26H65M35 24H43V31H35Z" />
      <path className="life-vignette-etch" d="M18 30V36M22 31V37M26 31V37M53 30V37M57 30V37M61 29V36M17 21H31M47 21H61" />
      <path d="M8 43H69" />
    </>,
    LEARN: <>
      <path className="life-vignette-wash" d="M10 14L37 18L67 13V39L38 44L10 39Z" />
      <path d="M10 14V39L38 44L67 39V13M38 17V40M13 10Q26 8 38 17Q51 8 64 10V35Q51 33 38 40Q26 33 13 35ZM13 35L10 39M64 35L67 39" />
      <path className="life-vignette-etch" d="M18 17Q25 16 32 20M18 23Q25 22 32 26M18 29L30 31M44 20Q51 16 59 17M44 26Q51 22 59 23M46 31L58 29M16 39L32 42M44 42L62 39" />
    </>,
    INVESTIGATE: <>
      <path className="life-vignette-wash" d="M13 10H45L52 17V40H13Z" />
      <path d="M13 10H45L52 17V40H13ZM44 10V18H52M17 20H25M17 26H24M17 32H28" />
      <circle cx="42" cy="23" r="13" /><circle cx="42" cy="23" r="10" />
      <path d="M50 33L63 45L68 40L55 28M34 22Q35 17 40 16" />
      <path className="life-vignette-etch" d="M55 34L59 31M58 37L62 34M61 40L65 37M18 36H30" />
    </>,
    REST: <>
      <path className="life-vignette-wash" d="M19 19H54V31Q52 40 37 40Q22 40 19 31Z" />
      <ellipse cx="37" cy="19" rx="18" ry="4" />
      <path d="M19 19V30Q20 40 37 40Q53 40 55 30V19M55 22H60Q69 23 63 32L55 34M57 25H60Q64 25 60 29L56 30M17 35Q5 39 18 43Q36 48 59 42Q67 39 56 36" />
      <path className="life-vignette-etch" d="M23 26L26 35M28 28L30 37M33 29L35 38M29 12Q25 8 30 4M42 12Q38 8 43 4M24 42H48" />
    </>,
  };
  return <svg className="life-action-vignette" viewBox="0 0 80 48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {studies[kind]}
  </svg>;
}
