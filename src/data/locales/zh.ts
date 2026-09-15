/**
 * Chinese overrides. Only the keys whose Chinese differs from English; everything else
 * is inherited at runtime, so an untranslated key exists once and cannot drift.
 *
 * Only **prose** is translated. Labels, counters, brand names, readout values and
 * **placeholders** stay English in both locales: the first group is 9-11px tracked
 * uppercase micro-type, part of the instrument look rather than reading matter, and the
 * second is an example or an invitation ("Example@example.com", "What should I call
 * you?") - and the one string a locale flip cannot animate, because `Scramble` writes a
 * text node while a placeholder is an attribute. See `docs/CONVENTIONS.md`.
 *
 * `DeepPartial<Strings>` makes a key that does not exist in `en.ts` a compile error, so
 * this file cannot invent one or outlive a deletion.
 */
import type { DeepPartial, Strings } from './en'

export const zh: DeepPartial<Strings> = {
  /* The one place a locale genuinely has to differ: the toggle shows the language you
     are reading, and its label says where clicking takes you. */
  locale: {
    short: '中',
    switchTo: '切换到英文',
  },

  /* Screen-reader names, so a Chinese page is announced in Chinese. */
  nav: {
    primary: '主导航',
    drawer: '移动端导航',
    footer: '页脚导航',
  },

  /* Search results and link previews, one per route. `{count}` is filled by the caller. */
  meta: {
    site: 'Chrollis 的个人主页。',
    projects: '来自 GitHub 的仓库。',
    about: '个人简介与统计数据。',
    blog: '笔记与小说，共 {count} 篇。',
    contact: '联系方式。',
    notFound: '页面不存在。',
  },

  content: {
    description: '写代码是因为觉得好玩，希望等工作以后也还是这样。',
    bio: [
      '我大概过不来那种每天排满的日子。听听课，做点事，累了打游戏，困了就睡。',
      '和人打交道真的挺累。经常是别人说了一句，我在心里过两遍还是不知道怎么接，时间长了就懒得主动了，也说不清是我的问题，还是本来就没那么多好说的。',
      '不过自己认准的事，我不会含糊。其他都能将就，唯独这一件不行。',
    ],
  },

  cover: {
    note: '我的项目和文章都在这儿。',
  },

  projects: {
    intro: '来自 GitHub 的仓库。展开卡片可以看它的 README。',
  },

  blog: {
    intro: '我的笔记和小说都在这里。',
    emptyHint: '还没有发过东西。',
  },

  contact: {
    intro: '项目相关的事，请到对应仓库开 issue。其他事，请通过下面这些渠道联系。',
    notConfiguredHelp: '表单暂时不可用，请改用邮件联系。',
    /* No `namePlaceholder` / `emailPlaceholder` / `subjectPlaceholder` /
       `messagePlaceholder` here on purpose: placeholders stay English in both locales, so
       they have no override to carry. See the note in `en.ts` and `docs/CONVENTIONS.md`. */
  },

  /* `search` has no override: its only text was the field's placeholder, which is English
     in both locales. */

  notFound: {
    body: '这里没有东西。链接也许过期了，也许这个页面本来就不在。',
  },

  crash: {
    title: '出错了。',
    body: '页面渲染失败，刷新一般能解决。若反复出现，浏览器控制台里有详细信息。',
  },
}
