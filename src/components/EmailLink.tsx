import { fullEmail } from '@/data/site'

/**
 * The contact address, linked. Used in the footer, the About facts table and the contact
 * page, so it lives here rather than three times over.
 *
 * Shown **plainly** as a normal `mailto:`. Obfuscation (`user [at] domain`) and
 * hover-to-reveal were both tried and dropped: an address nobody can copy is not a contact
 * address, and the hover variant broke middle-click and right-click copy-link-address.
 *
 * The address is not one string in the source: `fullEmail()` joins two halves at runtime, so
 * a scraper that regexes the `.js` files without executing them finds no `user@domain`.
 * Anything that renders the page gets it, and that is accepted - it is a SimpleLogin alias,
 * so the response to abuse is replacing the alias. See `docs/CONVENTIONS.md`.
 */
export default function EmailLink({
  className,
  children,
}: {
  className?: string
  /** Visible label. Falls back to the address itself. */
  children?: React.ReactNode
}) {
  const address = fullEmail()

  return (
    <a href={`mailto:${address}`} title={address} className={className}>
      {children ?? address}
    </a>
  )
}
