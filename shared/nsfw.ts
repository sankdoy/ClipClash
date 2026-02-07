/**
 * NSFW URL filter — blocks known adult/explicit domains and URL path keywords.
 * Cannot scan actual video content, but catches the obvious cases.
 */

const NSFW_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
  'redtube.com', 'youporn.com', 'tube8.com', 'spankbang.com',
  'eporner.com', 'beeg.com', 'tnaflix.com', 'drtuber.com',
  'onlyfans.com', 'fansly.com', 'justforfans.com', 'loyalfans.com',
  'chaturbate.com', 'stripchat.com', 'bongacams.com', 'cam4.com',
  'myfreecams.com', 'livejasmin.com', 'camsoda.com',
  'manyvids.com', 'clips4sale.com', 'iwantclips.com',
  'nhentai.net', 'hanime.tv', 'hentaihaven.xxx',
  'rule34.xxx', 'e621.net', 'gelbooru.com', 'danbooru.donmai.us',
  'sex.com', 'literotica.com', 'fetlife.com',
  'brazzers.com', 'bangbros.com', 'realitykings.com', 'naughtyamerica.com'
]

const NSFW_PATH_KEYWORDS = [
  'porn', 'xxx', 'nsfw', 'nude', 'naked', 'hentai',
  'sex', 'adult', 'onlyfans', 'fansly', 'escort',
  'blowjob', 'handjob', 'cumshot', 'dildo', 'fetish'
]

export function isNsfwUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (NSFW_DOMAINS.some((domain) => host === domain || host.endsWith('.' + domain))) {
      return true
    }

    const pathAndQuery = (parsed.pathname + parsed.search).toLowerCase()
    if (NSFW_PATH_KEYWORDS.some((keyword) => pathAndQuery.includes(keyword))) {
      return true
    }

    return false
  } catch {
    return false
  }
}
