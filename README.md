# 8-Bit Converter by Buildiful®

Turn PNG, JPEG and WebP images into old-school pixel art directly in your browser.

**Live app:** https://buildiful.github.io/8-bit-converter/

## Features

- Choose or drag an image, click **Convert**, then **Download PNG**.
- Adjustable pixel-detail grid (32–128 samples along the longest side).
- Four palettes: Arcade 256 (RGB 3:3:2), Classic 16, Pastel 12, Handheld 4.
- Optional, gently weighted Floyd–Steinberg dithering to minimize speckling in limited palettes.
- Transparency is preserved for transparent input images.
- No image uploads, dependencies, accounts, backend, build step, or API keys.
- Responsive layout, large controls, keyboard operability, and accessible status messages.
- Export uses original aspect ratio, up to 4096 pixels on the longest edge. For safety, input is limited to 35 MB and 65 megapixels. Image processing uses HTML Canvas and nearest-neighbor enlargement.

## Local development

Open `index.html` directly in a recent browser, or run:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Publish on GitHub Pages

Put the contents of this folder at the root of your `8-bit-converter` repository, select **Settings → Pages → Deploy from a branch → main / (root)** and visit the URL above when published under the Buildiful organization. The application contains relative asset paths and needs no server-side functions.

`assets/` includes the official Buildiful® logo and favicon supplied for this tool. The actual image converter source code is available for reuse under the MIT License; logos, wordmarks and trademarks are **not** licensed under MIT. See `TRADEMARKS.md`.

## Analytics and privacy

The `js/buildiful-analytics-v2.js` module uses Google Analytics 4 measurement ID `G-TG14RBXLTF` **only on** the official `buildiful.github.io` origin. Forks and local previews do not send analytics. It reads approximate country/province classification via the external `https://ipwho.is/` endpoint in order to apply an opt-in consent flow in the EEA, UK, Switzerland and Quebec. Unknown region = no tracking until opt-in; a failed geolocation request does not block the converter. Visitors elsewhere can opt out via the footer Privacy control (which opens analytics settings). Respect GPC/DNT; choices share first-party local storage across compatible tools on the same origin.

This is **Basic Consent Mode v2**: no Google tag is loaded while consent is required and not granted, or after explicit rejection. It does not send advanced-mode cookieless pings for declined visits. Advertising consent remains denied; Google Signals and ad personalization are disabled in the tag configuration. Only `image_convert` and `image_download` button events are sent when analytics is active; no image content, file name, dimensions or URL parameters.

**Deployment note:** Regional IP lookup necessarily sends an ordinary request containing the visitor's IP address to the chosen location provider. Its free browser endpoint has traffic limits and may not fit every scale or jurisdiction; review its terms and privacy policies and change `geoEndpoint`/deploy an appropriate privacy-reviewed service as needed. The site's local opt-in/opt-out UI is not a substitute for legal review, a complete CMP where necessary, or a privacy notice customized to your operations. GA4 property-level advertising features, linkages, data retention and Google Signals settings must be verified separately in Google Analytics Admin.

More detail is in `privacy.html` and `ANALYTICS.md`.

## Technical notes

- Images never leave browser image-processing code. A file object URL is used for the original preview; a local canvas is converted to a PNG Blob for the final download.
- Converting a photo to an 8-bit **style** is not a conversion into an 8-bit game ROM. "Arcade 256" applies exactly 256 possible RGB colors; other palettes are intentional, more limited retro styles.
- Transparent PNG/WebP imagery remains transparent; some edge pixels with partial opacity may appear different due to resampling and quantization.
- The app has no telemetry for failures and avoids storing selected images.

## License

MIT for original source code. Official Buildiful® brand assets retain their respective rights. See `LICENSE` and `TRADEMARKS.md`.
