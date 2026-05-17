// Shared SEO helper — inject meta tags, JSON-LD, canonical
const SITE = {
  name: "Bun SQL Editor",
  url: "https://bun-sql-editor.pages.dev",
  logo: "https://bun-sql-editor.pages.dev/og-image.png",
  twitter: "@BunSQLEditor",
  description: "A lightweight, open-source SQL workbench that runs as a single local binary. Connect to PostgreSQL, MySQL, MongoDB, and ClickHouse. No cloud. No signup.",
};

export function injectSEO({
  title,
  description,
  canonical,
  type = "website",
  jsonld = null,
  breadcrumbs = [],
}) {
  const fullTitle = title === SITE.name ? title : `${title} — ${SITE.name}`;
  const url = canonical ? `${SITE.url}${canonical}` : SITE.url;

  document.title = fullTitle;

  const head = document.head;

  function meta(name, content, prop = false) {
    const el = document.createElement("meta");
    el.setAttribute(prop ? "property" : "name", name);
    el.setAttribute("content", content);
    head.appendChild(el);
  }

  function link(rel, href) {
    const el = document.createElement("link");
    el.rel = rel;
    el.href = href;
    head.appendChild(el);
  }

  function jsonldTag(data) {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(data, null, 2);
    head.appendChild(el);
  }

  // Basic
  meta("robots", "index, follow");
  meta("author", SITE.name);

  // Canonical
  link("canonical", url);

  // Open Graph
  meta("og:type", type, true);
  meta("og:site_name", SITE.name, true);
  meta("og:title", fullTitle, true);
  meta("og:description", description || SITE.description, true);
  meta("og:url", url, true);
  meta("og:image", SITE.logo, true);
  meta("og:image:width", "1200", true);
  meta("og:image:height", "630", true);

  // Twitter Card
  meta("twitter:card", "summary_large_image");
  meta("twitter:site", SITE.twitter);
  meta("twitter:title", fullTitle);
  meta("twitter:description", description || SITE.description);
  meta("twitter:image", SITE.logo);

  // WebSite schema (always)
  jsonldTag({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE.name,
    "url": SITE.url,
    "description": SITE.description,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE.url}/wiki/index.html?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  });

  // SoftwareApplication schema (homepage)
  if (type === "website" && !canonical?.includes("/blog/") && !canonical?.includes("/wiki/")) {
    jsonldTag({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": SITE.name,
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "macOS, Windows, Linux",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "url": SITE.url,
      "description": SITE.description,
      "license": "https://github.com/BunAgents/bun-sql-editor/blob/main/LICENSE",
      "codeRepository": "https://github.com/BunAgents/bun-sql-editor",
      "downloadUrl": "https://github.com/BunAgents/bun-sql-editor/releases"
    });
  }

  // Custom JSON-LD (Article, BlogPosting, etc.)
  if (jsonld) jsonldTag(jsonld);

  // BreadcrumbList
  if (breadcrumbs.length > 0) {
    jsonldTag({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": b.name,
        "item": `${SITE.url}${b.path}`
      }))
    });
  }
}

export function injectArticleSEO(post) {
  injectSEO({
    title: post.title,
    description: post.description,
    canonical: `/blog/post.html?slug=${post.slug}`,
    type: "article",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.description,
      "datePublished": post.date,
      "dateModified": post.date,
      "author": { "@type": "Organization", "name": SITE.name, "url": SITE.url },
      "publisher": { "@type": "Organization", "name": SITE.name, "url": SITE.url, "logo": SITE.logo },
      "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE.url}/blog/post.html?slug=${post.slug}` },
      "keywords": post.tags?.join(", ") ?? "",
      "articleSection": post.category,
    },
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog/index.html" },
      { name: post.title, path: `/blog/post.html?slug=${post.slug}` },
    ],
  });
}

export { SITE };
