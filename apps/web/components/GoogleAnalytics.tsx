import Script from 'next/script';

/**
 * Google Analytics 4 (gtag.js) loader.
 *
 * Emits Google's two-part install snippet through next/script with the
 * `afterInteractive` strategy so it loads once the page is interactive
 * rather than during paint. Client-side route changes are picked up by
 * GA4's Enhanced Measurement (on by default on the property side),
 * which listens to History API mutations.
 *
 * Mount only for environments that should report traffic — this repo
 * gates it to cloud mode from the root layout so the desktop bundle
 * doesn't phone home.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
