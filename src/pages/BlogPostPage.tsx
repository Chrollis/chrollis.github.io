import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'

import CommentBox from '@/components/CommentBox'
import MarkdownBody from '@/components/MarkdownBody'
import { useLocale } from '@/lib/locale'
import { fadeUp, pageStagger } from '@/lib/motion'
import { getAdjacentPosts, getPost } from '@/lib/posts'
import { useSeo } from '@/lib/seo'
import { formatDate } from '@/lib/utils'
import NotFoundPage from '@/pages/NotFoundPage'

export default function BlogPostPage() {
  const { t } = useLocale()
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined
  const adjacent = slug ? getAdjacentPosts(slug) : {}

  useSeo({
    title: post?.title ?? t.blog.notFound,
    description: post?.description,
    path: `/blog/${slug ?? ''}`,
    type: 'article',
    publishedTime: post?.date,
    tags: post?.tags,
  })

  if (!post) return <NotFoundPage />

  return (
    <motion.article initial="hidden" animate="show" variants={pageStagger} className="pb-section">
      <header className="ak-container border-b border-ak-border pb-8 pt-12 md:pt-16">
        <motion.div variants={fadeUp}>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 font-mono text-2xs tracking-ak text-ak-muted transition-colors hover:text-ak-accent"
          >
            <ArrowLeft size={11} aria-hidden />
            {t.blog.backToNotes}
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-3">
          <span className="ak-index">{post.code}</span>
          <span className="border border-ak-border px-1.5 py-px font-mono text-[0.5625rem] tracking-ak text-ak-muted">
            {post.category}
          </span>
          <span className="h-px w-6 bg-ak-border" />
          <span className="font-mono text-2xs text-ak-muted">{formatDate(post.date)}</span>
          <span className="flex items-center gap-1 font-mono text-2xs text-ak-muted">
            <Clock size={10} aria-hidden />
            {post.readingMinutes} {t.common.minRead}
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="ak-text-balance mt-5 max-w-3xl text-2xl font-bold leading-snug text-ak-text md:text-4xl"
        >
          {post.title}
        </motion.h1>

        {post.description && (
          <motion.p
            variants={fadeUp}
            className="ak-text-pretty mt-4 max-w-2xl text-sm leading-relaxed text-ak-muted md:text-base"
          >
            {post.description}
          </motion.p>
        )}

        {post.tags.length > 0 && (
          <motion.ul variants={fadeUp} className="mt-5 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li key={tag} className="ak-chip">
                {tag}
              </li>
            ))}
          </motion.ul>
        )}
      </header>

      <div className="ak-container max-w-3xl pt-10">
        <motion.div variants={fadeUp}>
          <MarkdownBody content={post.content} />
        </motion.div>

        <CommentBox term={`blog/${post.slug}`} />
      </div>

      {(adjacent.prev || adjacent.next) && (
        <motion.nav
          variants={fadeUp}
          className="ak-container mt-14 grid gap-px border-t border-ak-border bg-ak-border sm:grid-cols-2"
          aria-label={t.blog.postNav}
        >
          {adjacent.prev ? (
            <Link
              to={`/blog/${adjacent.prev.slug}`}
              className="group flex flex-col gap-1 bg-ak-surface px-4 py-5 transition-colors duration-ak hover:bg-ak-surface-2"
            >
              <span className="flex items-center gap-1.5 font-mono text-2xs tracking-ak text-ak-muted">
                <ArrowLeft size={11} aria-hidden />
                {t.blog.newer}
              </span>
              <span className="mt-1 text-sm text-ak-text transition-colors group-hover:text-ak-accent">
                {adjacent.prev.title}
              </span>
            </Link>
          ) : (
            <span className="hidden bg-ak-surface sm:block" />
          )}

          {adjacent.next ? (
            <Link
              to={`/blog/${adjacent.next.slug}`}
              className="group flex flex-col items-end gap-1 bg-ak-surface px-4 py-5 text-right transition-colors duration-ak hover:bg-ak-surface-2"
            >
              <span className="flex items-center gap-1.5 font-mono text-2xs tracking-ak text-ak-muted">
                {t.blog.older}
                <ArrowRight size={11} aria-hidden />
              </span>
              <span className="mt-1 text-sm text-ak-text transition-colors group-hover:text-ak-accent">
                {adjacent.next.title}
              </span>
            </Link>
          ) : (
            <span className="hidden bg-ak-surface sm:block" />
          )}
        </motion.nav>
      )}
    </motion.article>
  )
}
