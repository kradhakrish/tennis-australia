const ARTICLE_LIST_ENDPOINT = 'https://publish-p158407-e1689364.adobeaemcloud.com/graphql/execute.json/tennis-australia/article-list';
const ARTICLE_BASE_PATH = '/news';

/**
 * Formats an ISO date string for display, e.g. "30 September 2026".
 * @param {string} value ISO date string
 * @returns {string} formatted date, or an empty string if invalid
 */
export function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  });
}

function toPlainText(markdown = '') {
  return markdown.replace(/\s+/g, ' ').trim();
}

function readLimit(block) {
  const value = Number.parseInt(block.textContent.trim(), 10);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

async function fetchArticles() {
  // The publish CDN does not vary its cache by Origin, so key the request per origin
  // to avoid receiving a cached response without CORS headers.
  const url = new URL(ARTICLE_LIST_ENDPOINT);
  url.searchParams.set('origin', window.location.host);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Article list request failed: ${resp.status}`);
  const json = await resp.json();
  const items = json?.data?.articleList?.items || [];
  return items.map(({ _id: id, ...article }) => ({ id, ...article }));
}

function buildCard(article) {
  const li = document.createElement('li');
  const url = `${ARTICLE_BASE_PATH}/${article.id}`;

  const body = document.createElement('div');
  body.className = 'news-listing-card-body';

  const published = formatDate(article.pubdate);
  if (published) {
    const time = document.createElement('time');
    time.dateTime = article.pubdate;
    time.textContent = published;
    body.append(time);
  }

  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = url;
  link.textContent = article.title?.trim() || 'Untitled article';
  heading.append(link);
  body.append(heading);

  const summary = toPlainText(article.subTitle?.markdown);
  if (summary) {
    const p = document.createElement('p');
    p.textContent = summary;
    body.append(p);
  }

  const more = document.createElement('p');
  more.className = 'news-listing-more';
  const moreLink = document.createElement('a');
  moreLink.href = url;
  moreLink.textContent = 'Read article';
  moreLink.setAttribute('aria-label', `Read article: ${link.textContent}`);
  more.append(moreLink);
  body.append(more);

  li.append(body);
  return li;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const limit = readLimit(block);
  const list = document.createElement('ul');
  block.replaceChildren(list);
  block.setAttribute('aria-busy', 'true');

  try {
    const articles = (await fetchArticles())
      .filter((article) => article.id && article.title)
      .sort((a, b) => new Date(b.pubdate || 0) - new Date(a.pubdate || 0));
    const visible = limit ? articles.slice(0, limit) : articles;

    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'news-listing-empty';
      empty.textContent = 'There are no news articles yet.';
      block.replaceChildren(empty);
      return;
    }

    list.append(...visible.map(buildCard));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('news-listing: unable to load articles', error);
    const message = document.createElement('p');
    message.className = 'news-listing-empty';
    message.textContent = 'News articles could not be loaded. Please try again later.';
    block.replaceChildren(message);
  } finally {
    block.removeAttribute('aria-busy');
  }
}
