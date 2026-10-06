import { formatDate } from '../news-listing/news-listing.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    const cell = row.firstElementChild || row;
    const text = cell.textContent.trim();

    if (ISO_DATE.test(text)) {
      const formatted = formatDate(text);
      if (!formatted) {
        row.remove();
        return;
      }
      const time = document.createElement('time');
      time.dateTime = text;
      time.textContent = formatted;
      const p = document.createElement('p');
      p.className = 'article-header-date';
      p.append(time);
      row.replaceWith(p);
      return;
    }

    if (cell.querySelector('a') && !cell.querySelector('h1')) {
      const nav = document.createElement('nav');
      nav.className = 'article-header-breadcrumb';
      nav.setAttribute('aria-label', 'Breadcrumb');
      nav.append(...cell.childNodes);
      row.replaceWith(nav);
      return;
    }

    row.replaceWith(...cell.childNodes);
  });
}
