const MAX_HEADING_LENGTH = 90;

function isHeadingText(text) {
  return text.length > 0
    && text.length <= MAX_HEADING_LENGTH
    && !text.includes(':')
    && !/[.!;,]$/.test(text);
}

function isSentence(text) {
  return text.length > MAX_HEADING_LENGTH || /[.!?]$/.test(text);
}

/**
 * Splits a paragraph into its <br>-separated lines, each as a list of nodes.
 * @param {Element} p paragraph element
 * @returns {Node[][]} lines
 */
function splitLines(p) {
  const lines = [[]];
  [...p.childNodes].forEach((node) => {
    if (node.nodeName === 'BR') lines.push([]);
    else lines[lines.length - 1].push(node);
  });
  return lines.filter((line) => line.some((node) => node.textContent.trim()));
}

function lineText(line) {
  return line.map((node) => node.textContent).join('').trim();
}

function joinLines(lines) {
  const p = document.createElement('p');
  lines.forEach((line, index) => {
    if (index) p.append(document.createElement('br'));
    p.append(...line);
  });
  return p;
}

function heading(line) {
  const el = document.createElement(lineText(line).endsWith('?') ? 'h3' : 'h2');
  el.append(...line);
  return el;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const content = block.querySelector(':scope > div > div') || block;
  const pageTitle = document.querySelector('h1')?.textContent.trim();
  const output = [];

  [...content.children].forEach((el) => {
    if (el.tagName !== 'P') {
      output.push(el);
      return;
    }

    let lines = splitLines(el);
    if (!output.length && lines.length && lineText(lines[0]) === pageTitle) lines = lines.slice(1);
    if (!lines.length) return;

    const [first, ...rest] = lines;
    const firstText = lineText(first);
    const leadsSentence = rest.length && isSentence(lineText(rest[0]));

    if (isHeadingText(firstText) && (!rest.length || leadsSentence)) {
      output.push(heading(first));
      if (rest.length) output.push(joinLines(rest));
    } else {
      output.push(joinLines(lines));
    }
  });

  const article = document.createElement('div');
  article.className = 'article-body-content';
  article.append(...output);
  block.replaceChildren(article);
}
