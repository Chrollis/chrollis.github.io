/**
 * Brand and contact glyphs, inline SVG because lucide-react v1 dropped every brand icon.
 *
 * The Octocat is a GitHub trademark, used here under their brand guidelines, which permit it
 * for linking to GitHub - which is exactly this usage. Every other glyph is generic geometry.
 */
import type { SVGProps } from 'react'

/** Component signature shared by all icons in this file. */
export type BrandIconComponent = (props: { size?: number }) => React.ReactElement

type Props = SVGProps<SVGSVGElement> & { size?: number }

export function GithubIcon({ size = 16, ...props }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

export function MailIcon({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      {...props}
    >
      <rect x="1.75" y="3.25" width="12.5" height="9.5" />
      <path d="M2 4l6 4.5L14 4" />
    </svg>
  )
}

export function RssIcon({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      {...props}
    >
      <path d="M3 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
      <path d="M3 7.5A5.5 5.5 0 0 1 8.5 13" />
      <path d="M3 3.5A9.5 9.5 0 0 1 12.5 13" />
    </svg>
  )
}

export function ExternalIcon({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      {...props}
    >
      <path d="M6.5 3.5H3v9.5h9.5V9.5" />
      <path d="M9.5 3.5H12.5V6.5" />
      <path d="M12.5 3.5L7.5 8.5" />
    </svg>
  )
}

/**
 * Bilibili: a rounded television shape with the two antennae and two eyes.
 * Generic geometry, drawn to the same 16-unit grid as everything else.
 */
export function BilibiliIcon({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
      {...props}
    >
      <rect x="1.5" y="4.5" width="13" height="9.5" rx="2.2" />
      <path d="M4.2 1.8L6.4 4.5M11.8 1.8L9.6 4.5" />
      <path d="M5.4 8.2v1.4M10.6 8.2v1.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Afdian: a generic "support" mark - a filled heart inside an open frame.
 * Not a reproduction of their logo.
 */
export function AfdianIcon({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
      {...props}
    >
      <rect x="1.5" y="1.5" width="13" height="13" />
      <path
        d="M8 12.2S3.6 9.6 3.6 6.9c0-1.3 1-2.2 2.2-2.2.9 0 1.7.5 2.2 1.3.5-.8 1.3-1.3 2.2-1.3 1.2 0 2.2.9 2.2 2.2 0 2.7-4.4 5.3-4.4 5.3Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}
