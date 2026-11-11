import { htmlToPlainText, isHtmlEmpty, sanitizeHtml, truncate } from '../../src/lib/html';

describe('sanitizeHtml (XSS)', () => {
  it.each([
    ['<p>ok</p><script>window.__xss = 1</script>', '<p>ok</p>'],
    ['<img src=x onerror="window.__xss=1">', ''],
    ['<p onclick="alert(1)">hola</p>', '<p>hola</p>'],
    ['<a href="javascript:alert(1)">x</a>', 'x'],
    ['<iframe src="https://evil.test"></iframe><p>a</p>', '<p>a</p>'],
    ['<svg><script>alert(1)</script></svg>', ''],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('conserva el formato del editor', () => {
    const html = '<p><strong>B</strong> <em>i</em> <code>c</code></p><ul><li>uno</li></ul><pre><code>x</code></pre>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});

describe('htmlToPlainText', () => {
  it('extrae texto, separa bloques y decodifica entidades', () => {
    expect(htmlToPlainText('<p>Hola&nbsp;<strong>mundo</strong></p><ul><li>a &amp; b</li><li>&lt;c&gt;</li></ul>')).toBe(
      'Hola mundo a & b <c>',
    );
  });

  it('no incluye el contenido de scripts', () => {
    expect(htmlToPlainText('<p>a</p><script>malo()</script>')).toBe('a');
  });
});

describe('isHtmlEmpty', () => {
  it.each(['', '<p></p>', '<p> </p>', '<p><br></p>', '<p>&nbsp;</p>', '<ul><li></li></ul>', null, undefined])(
    '%j es vacío', (v) => {
      expect(isHtmlEmpty(v)).toBe(true);
    });

  it('texto real no es vacío', () => {
    expect(isHtmlEmpty('<p>x</p>')).toBe(false);
  });
});

it('truncate', () => {
  expect(truncate('abcdef', 4)).toBe('abc…');
  expect(truncate('abc', 4)).toBe('abc');
});
