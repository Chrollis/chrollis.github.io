import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type { PluggableList } from 'unified'

/**
 * Markdown renderer. Two modes, because the two sources are not equally trusted:
 * `allowHtml=false` (posts) drops raw HTML; `allowHtml=true` (READMEs) needs it, since
 * nearly every README uses HTML for centred headers, badges and screenshots.
 *
 * With HTML enabled, `rehype-raw` parses it and `rehype-sanitize` immediately strips
 * anything dangerous. That order is what the docs specify, and the sanitize pass matters
 * because a repository is a separate trust boundary.
 *
 * `disableRelativeLinks` makes relative targets inert in README mode: `[LICENSE](LICENSE)`
 * means the repository's own file on GitHub, but would mean `chrollis.github.io/LICENSE`
 * here. See `docs/DESIGN.md`. Styling is the `.ak-prose` rules.
 */
export default function MarkdownBody({
  content,
  allowHtml = false,
  disableRelativeLinks = false,
}: {
  content: string
  allowHtml?: boolean
  /** Render relative targets as plain text. For repository READMEs. */
  disableRelativeLinks?: boolean
}) {
  /* Typed as PluggableList rather than `as const`: rehype wants a mutable tuple. */
  const highlight: PluggableList = [[rehypeHighlight, { detect: true, ignoreMissing: true }]]
  const rehypePlugins: PluggableList = allowHtml
    ? [rehypeRaw, rehypeSanitize, ...highlight]
    : highlight

  return (
    <div className="ak-prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          a({ href, children, ...props }) {
            const target = href ?? ''
            /* "Absolute" means the browser resolves it the same way from anywhere: a
               scheme, a protocol-relative host, or an in-page anchor. */
            const isAbsolute =
              target === '' ||
              target.startsWith('#') ||
              target.startsWith('//') ||
              /^[a-z][a-z0-9+.-]*:/i.test(target)

            if (disableRelativeLinks && !isAbsolute) {
              /* A span, not an anchor with the href stripped: `a` without an href is still
                 focusable, announced as a link and shows a pointer, so it would look like a
                 broken link rather than the plain text it is. */
              return <span className="ak-inert-link">{children}</span>
            }

            // Most links in prose point off-site; open those in a new tab and keep
            // the usual rel guards.
            const isExternal = /^https?:\/\//i.test(target)
            return (
              <a
                href={href}
                {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
