# Privacy-aware Analytics v2 integration

This module is reusable across standalone Buildiful web tools. In this repository it is named `js/buildiful-analytics-v2.js`; source code is MIT licensed.

## Active behavior

1. Runs only when `location.hostname` is in `CONFIG.allowedHosts`; disabled on forks, local files and localhost.
2. Sets Consent Mode v2 defaults (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`: all denied) before adding `gtag.js`. Advertising remains denied.
3. Checks browser GPC / DNT first and does not enable analytics if signaled.
4. Applies a saved explicit preference from shared origin local storage, valid for up to 365 days.
5. Otherwise requests coarse region data from `https://ipwho.is/` in a request with `credentials: omit` and `referrerPolicy: no-referrer`. Persists **only** a Boolean consent-region classification for 12 hours; never the returned IP or location data.
6. Shows an opt-in panel in EEA, UK, Switzerland, Quebec, and when country/province lookup fails. In other detected regions, enables optional GA4 measurement by default with a persistent Privacy control in the footer.
7. When granted, uses basic-mode consent update and configures GA4 without Signals or ad personalization. Avoids URL query strings/fragments and custom sensitive dimensions. Sends only two permitted UI events.
8. Denial prevents any GA script being loaded during that visit (if GA has already loaded before revocation, sends a consent denial and sets `ga-disable-<id>` to stop further hits).

## Implementation decisions

- **No third-party cookie banners on every page.** Geographically sensitive regions see an initial choice, other regions can reopen settings via Privacy in the footer.
- **No advanced cookieless pings.** Advanced consent mode may transmit visit data even after a decline; this implementation deliberately chooses basic mode.
- **No unconditional visitor counter** for rejected visits. A privacy-preserving aggregate counter would require a separate, reviewed endpoint and is not silently enabled.
- **Privacy versus location**: A client-side IP lookup reveals the visitor's address to the lookup provider. An operator who wants zero third-party pre-consent requests should disable regional lookup and prompt all visitors, or use a vetted first-party edge endpoint that provides a coarse jurisdiction response.
- **No legal guarantees**: Local regulations, browser behavior, free API limits, and analytics policies may change. Review with qualified privacy advice before production use across all jurisdictions.

## Reuse in another tool

Copy this JavaScript file; change `toolName`, `allowedHosts` and GA ID if appropriate; include the file with a `defer` script tag, a `<div id="analyticsConsentRoot"></div>`, and a footer `<button id="analyticsSettings" type="button">Privacy</button>` plus a `privacy.html` notice linked from the settings dialog. Adopt the two `.consent-*` CSS selectors or copy the styles. Emit only approved, non-sensitive action names using `window.BuildifulAnalytics?.track('image_convert')` adapted to that tool. The choice key `buildiful.analytics.v2.choice` is shared across all tools hosted on `buildiful.github.io`. Do not store implicit geographic auto-grants as explicit consent.

## Checklist before deploy

- Confirm GA4 measurement ID, allowed origin, site privacy/terms links, and location provider limits.
- Review GA4 Admin: disable Google Signals, ad personalization and advertising features; review linked advertising services and retention.
- Test outside the opt-in region (auto-enables unless GPC/DNT); test EEA/UK/CH/Quebec (banner, no tag before opt-in); test failures (banner, no tag); test accept, decline, reopen and revoke.
- Test the app with offline/blocked analytics and blocked geolocation (image conversion must still work).
- Inspect DevTools Network: no upload to any origin; no GA script or analytics requests before opt-in for required-consent paths; events contain no filename or user content.
