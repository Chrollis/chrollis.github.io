---
title: Example post
description: Post template. Delete this file.
date: 2026-01-01
category: NOTE
tags: [example]
draft: false
---

Every `.md` file in this directory becomes a post - no code changes needed.

| field         | required | notes                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `title`       | yes      | Falls back to the filename                                               |
| `description` | no       | Listings, meta tags, the feed. Falls back to the first 90 chars of body  |
| `date`        | yes      | `YYYY-MM-DD`. Posts sort newest first                                    |
| `category`    | no       | Badge next to the title. Defaults to `NOTE`                              |
| `tags`        | no       | `[a, b]` or a `- a` list. Powers the tag filter and search               |
| `draft`       | no       | `true` hides the post from production, keeps it visible in `npm run dev` |
| `slug`        | no       | Defaults to the filename. Only set it to preserve a URL                  |

`draft: true` is the only way to keep a post out of the site, the feed and the sitemap.
Clear the flag and write your own, or delete this file.

Standard GitHub-flavoured Markdown works: tables, task lists, footnotes and fenced code
blocks with syntax highlighting.

## Images

Put them in `public/notes/<slug>/` and reference them with a **leading slash**:

```markdown
![A screenshot](/notes/my-post/shot.png)
```

A post renders at `/blog/<slug>`, so a relative path resolves against that URL, hits the
SPA fallback and shows a broken image with no console error. `src/assets/` cannot be used:
post bodies are read as raw strings through `import.meta.glob`, so an `import` inside
Markdown renders as literal text.
