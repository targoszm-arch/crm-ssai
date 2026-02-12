import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'img',
      'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'pre', 'code', 'hr', 'sub', 'sup', 'b', 'i', 'font',
      'center', 'small', 'big', 'dl', 'dt', 'dd',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'target',
      'rel', 'width', 'height', 'border', 'cellpadding', 'cellspacing',
      'align', 'valign', 'bgcolor', 'color', 'size', 'face',
      'colspan', 'rowspan', 'dir',
    ],
    ALLOW_DATA_ATTR: false,
  });
}
