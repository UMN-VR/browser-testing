/** Application DOM observations only; no renderer/viewer/worker is constructed here. */
export function campusSelectorDocument() {
  const navs = [...document.querySelectorAll('nav[aria-label="Campus tours"]')];
  const namedText = (element, attribute) => (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ');
  const cards = [...(navs[0]?.querySelectorAll('li > a') ?? [])].map(anchor => {
    const images = [...anchor.querySelectorAll('img')];
    const image = images[0];
    return {
      path: new URL(anchor.href).pathname,
      label: namedText(anchor, 'aria-labelledby') || anchor.textContent.trim(),
      description: namedText(anchor, 'aria-describedby'),
      flat: anchor.parentElement?.tagName === 'LI' && anchor.parentElement.parentElement?.tagName === 'UL'
        && anchor.parentElement.parentElement.parentElement === navs[0],
      nestedLinks: anchor.querySelectorAll('a').length,
      imageCount: images.length,
      image: { src: image?.src ?? '', alt: image?.alt ?? '', complete: image?.complete ?? false, naturalWidth: image?.naturalWidth ?? 0 },
    };
  });
  const elements = [...document.querySelectorAll('*')];
  const skip = document.querySelector('a[href="#campus-tours"]');
  return {
    path: location.pathname, mainCount: document.querySelectorAll('main').length, navCount: navs.length,
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    skipTarget: skip && document.getElementById('campus-tours') ? 'campus-tours' : null,
    scriptCount: document.querySelectorAll('script').length,
    inlineHandlers: elements.flatMap(element => [...element.attributes]).filter(attribute => /^on/i.test(attribute.name)).length,
    javascriptURLs: [...document.querySelectorAll('[href],[src]')].filter(element => /^javascript:/i.test(element.getAttribute('href') ?? element.getAttribute('src') ?? '')).length,
    canvasCount: document.querySelectorAll('canvas').length,
    cards, text: document.body.textContent ?? '',
  };
}

/** Fetch only the exact supplied public document URL; its byte seal is checked by Campus assertions. */
export function publicDocumentExpression(url) {
  return `(async () => { const response = await fetch(${JSON.stringify(url)}, { cache: 'no-store' });
    if (!response.ok) throw new Error('Compiled scene HTTP ' + response.status);
    return { url: response.url, status: response.status, text: await response.text() }; })()`;
}

export const SELECTOR_EXPRESSION = `(${campusSelectorDocument.toString()})()`;
