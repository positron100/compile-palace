import { useEffect } from "react";

/** Canonical origin of the deployed frontend. */
export const SITE_URL = "https://compile-palace.vercel.app";

interface PageMeta {
  title: string;
  description?: string;
  /** Route path, e.g. "/auth". Used for the canonical and og:url. Ignored when noindex. */
  path: string;
  /** Private or session-only screens: keep out of the index. */
  noindex?: boolean;
}

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Per-route head metadata for a client-rendered SPA. Static defaults live in
 * index.html; this keeps title, description, canonical and robots correct for
 * the route actually on screen (Google renders JavaScript and reads them).
 */
export function usePageMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    const url = SITE_URL + path;
    document.title = title;
    if (description) {
      setMeta('meta[name="description"]', "name", "description", description);
      setMeta('meta[property="og:description"]', "property", "og:description", description);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    }
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[property="og:url"]', "property", "og:url", noindex ? SITE_URL + "/" : url);

    // A noindex page never declares itself canonical; private paths (room IDs)
    // must not be echoed into the head.
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (noindex) {
      link?.remove();
      setMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
      return;
    }
    if (link) link.href = url;
    else {
      const el = document.createElement("link");
      el.rel = "canonical";
      el.href = url;
      document.head.appendChild(el);
    }
    document.head.querySelector('meta[name="robots"]')?.remove();
  }, [title, description, path, noindex]);
}
