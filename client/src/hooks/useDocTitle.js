import { useEffect } from 'react';

const DEFAULT_TITLE = 'TourneyRun | Golf Office Pools & Fantasy Golf';
const BASE_URL = 'https://www.tourneyrun.app';

export function useDocTitle(title) {
  useEffect(() => {
    document.title = title;

    // Update canonical link element
    let canonical = document.querySelector("link[rel='canonical']");
    if (canonical) {
      canonical.href = BASE_URL + window.location.pathname;
    }

    // Update og:title and twitter:title for JS-rendered crawlers
    const ogTitle = document.querySelector("meta[property='og:title']");
    if (ogTitle) ogTitle.setAttribute('content', title);
    const twTitle = document.querySelector("meta[name='twitter:title']");
    if (twTitle) twTitle.setAttribute('content', title);

    // Update og:url and canonical to current page
    const ogUrl = document.querySelector("meta[property='og:url']");
    if (ogUrl) ogUrl.setAttribute('content', BASE_URL + window.location.pathname);

    return () => {
      document.title = DEFAULT_TITLE;
      if (canonical) canonical.href = BASE_URL + '/';
      if (ogTitle) ogTitle.setAttribute('content', DEFAULT_TITLE);
      if (twTitle) twTitle.setAttribute('content', DEFAULT_TITLE);
      if (ogUrl) ogUrl.setAttribute('content', BASE_URL + '/');
    };
  }, [title]);
}
