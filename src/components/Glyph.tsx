import type { ProjectGlyph } from '@/data/projects'

/**
 * Project illustrations: hand-drawn SVG on a 48x48 grid with 1px strokes. No third-party
 * artwork, so no licensing questions, a tiny payload, and colours that follow
 * `currentColor`.
 */
export default function Glyph({ glyph, className }: { glyph: ProjectGlyph; className?: string }) {
  const common = {
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1,
    'aria-hidden': true,
    className,
  }

  switch (glyph) {
    /* Crosshair - carross */
    case 'crosshair':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="13" />
          <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
          <path d="M24 2v9M24 37v9M2 24h9M37 24h9" />
          <path d="M12 12l4 4M36 12l-4 4M12 36l4-4M36 36l-4-4" opacity="0.5" />
        </svg>
      )

    /* Waveform - necokara */
    case 'wave':
      return (
        <svg {...common}>
          <path d="M6 24h4M42 24h-4" />
          <rect x="12" y="17" width="2" height="14" fill="currentColor" stroke="none" />
          <rect
            x="17"
            y="11"
            width="2"
            height="26"
            fill="currentColor"
            stroke="none"
            opacity="0.7"
          />
          <rect x="22" y="6" width="2" height="36" fill="currentColor" stroke="none" />
          <rect
            x="27"
            y="14"
            width="2"
            height="20"
            fill="currentColor"
            stroke="none"
            opacity="0.7"
          />
          <rect
            x="32"
            y="20"
            width="2"
            height="8"
            fill="currentColor"
            stroke="none"
            opacity="0.5"
          />
          <path d="M4 4h40M4 44h40" opacity="0.35" />
        </svg>
      )

    /* Neural net - mnist-playground */
    case 'neural':
      return (
        <svg {...common}>
          <circle cx="10" cy="14" r="3" />
          <circle cx="10" cy="34" r="3" />
          <circle cx="24" cy="24" r="3" />
          <circle cx="38" cy="12" r="3" />
          <circle cx="38" cy="36" r="3" />
          <path d="M13 15l8 7M13 33l8-7M27 22l8-8M27 26l8 8" opacity="0.65" />
          <path d="M10 17v14" opacity="0.35" />
        </svg>
      )

    /* Ruby segmentation - jumanlrc-lib */
    case 'blocks':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="12" height="12" />
          <rect x="19" y="10" width="24" height="12" opacity="0.55" />
          <rect x="5" y="26" width="24" height="12" />
          <rect x="31" y="26" width="12" height="12" opacity="0.55" />
        </svg>
      )

    /* Orbit - games and toys */
    case 'orbit':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" />
          <circle cx="24" cy="24" r="8" opacity="0.55" />
          <circle cx="24" cy="8" r="3" fill="currentColor" stroke="none" />
          <circle cx="38" cy="32" r="2" fill="currentColor" stroke="none" opacity="0.7" />
        </svg>
      )

    /* Terminal - command line tools and build systems */
    case 'terminal':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="42" height="34" />
          <path d="M3 15h42" opacity="0.6" />
          <path d="M9 23l5 4-5 4" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M19 31h10" strokeLinecap="round" />
          <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" opacity="0.6" />
          <circle cx="14" cy="11" r="1" fill="currentColor" stroke="none" opacity="0.6" />
        </svg>
      )

    /* Layers - stacks, pipelines and composed systems */
    case 'layers':
      return (
        <svg {...common}>
          <path d="M24 6L44 16 24 26 4 16z" />
          <path d="M4 24l20 10 20-10" opacity="0.65" />
          <path d="M4 32l20 10 20-10" opacity="0.4" />
        </svg>
      )

    /* Pulse - signals, audio and anything time-based */
    case 'pulse':
      return (
        <svg {...common}>
          <path d="M3 24h8l5-13 6 26 5-16 4 8h14" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M3 8h42M3 40h42" opacity="0.3" />
        </svg>
      )

    /* Circuit - low-level and hardware-adjacent work */
    case 'circuit':
      return (
        <svg {...common}>
          <rect x="14" y="14" width="20" height="20" />
          <path d="M14 24H4M44 24H34M24 14V4M24 44V34" />
          <path d="M19 19h10v10H19z" opacity="0.5" fill="currentColor" stroke="none" />
          <circle cx="4" cy="24" r="2" fill="currentColor" stroke="none" />
          <circle cx="44" cy="24" r="2" fill="currentColor" stroke="none" />
          <circle cx="24" cy="4" r="2" fill="currentColor" stroke="none" />
          <circle cx="24" cy="44" r="2" fill="currentColor" stroke="none" />
        </svg>
      )

    /* Grid - data and experiments */
    case 'grid':
    default:
      return (
        <svg {...common}>
          <path d="M4 16h40M4 32h40M16 4v40M32 4v40" opacity="0.5" />
          <rect
            x="16"
            y="16"
            width="16"
            height="16"
            fill="currentColor"
            stroke="none"
            opacity="0.85"
          />
          <rect x="4" y="4" width="40" height="40" />
        </svg>
      )
  }
}
