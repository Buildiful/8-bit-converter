/*
 * Buildiful Analytics v2 — shared, privacy-aware browser module.
 * Basic GA4 Consent Mode v2: Google tags do not load before consent in
 * opt-in regions, on a failed region lookup, or after explicit rejection.
 * Outside opt-in regions, optional analytics are enabled only after a
 * coarse country/province lookup. No filenames, pixel data or image URLs.
 */
(() => {
  'use strict';
  const CONFIG = Object.freeze({
    measurementId: 'G-TG14RBXLTF',
    allowedHosts: ['buildiful.github.io'],
    toolName: '8-Bit Converter',
    geoEndpoint: 'https://ipwho.is/',
    geoTimeoutMs: 4500,
    geoCacheMs: 12 * 60 * 60 * 1000,
    choiceMaxMs: 365 * 24 * 60 * 60 * 1000,
    policyVersion: 2
  });
  const STORE = 'buildiful.analytics.v2.choice';
  const REGION_STORE = 'buildiful.analytics.v2.region';
  const EEA = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE']);
  let state = 'off';
  let tagLoaded = false;
  let initialized = false;
  const root = document.getElementById('analyticsConsentRoot');
  const settingsButton = document.getElementById('analyticsSettings');
  const getJSON = key => { try {return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;} };
  const putJSON = (key,value) => { try {localStorage.setItem(key,JSON.stringify(value));}catch(_){/* private mode */} };
  const hasPrivacySignal = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  function setupTag() {
    // Keep consent defaults first in the queue. Advertising is always denied.
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',{
      analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', wait_for_update:500
    });
    window.gtag('set','ads_data_redaction',true);
  }
  function disableTracking() {
    state='denied';
    window['ga-disable-'+CONFIG.measurementId]=true;
    if(tagLoaded) window.gtag?.('consent','update',{
      analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'
    });
  }
  function enableTracking() {
    if(hasPrivacySignal()) { disableTracking(); return; }
    state='granted';
    window['ga-disable-'+CONFIG.measurementId]=false;
    window.gtag('consent','update',{
      analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'
    });
    if(tagLoaded) return;
    tagLoaded=true;
    window.gtag('js',new Date());
    window.gtag('config',CONFIG.measurementId,{
      send_page_view: true,
      page_location:location.origin+location.pathname,
      page_referrer:'',
      allow_google_signals:false,
      allow_ad_personalization_signals:false,
      anonymize_ip:true
    });
    const script=document.createElement('script');
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(CONFIG.measurementId);
    script.referrerPolicy='no-referrer';
    script.onerror=()=>{script.remove();tagLoaded=false;};
    document.head.appendChild(script);
  }
  function choice() {
    const saved=getJSON(STORE);
    if(!saved || saved.version !== CONFIG.policyVersion || !['granted','denied'].includes(saved.value) || !Number.isFinite(saved.at))return null;
    if(Date.now()-saved.at > CONFIG.choiceMaxMs || Date.now()<saved.at)return null;
    return saved.value;
  }
  function renderBanner(mode='initial') {
    if(!root) return;
    const settings=mode==='settings';
    root.innerHTML='';
    const banner=document.createElement('section');
    banner.className='consent-banner';
    banner.setAttribute('aria-label','Analytics privacy choices');
    const headline=document.createElement('h2');
    headline.textContent='Optional analytics';
    const description=document.createElement('p');
    description.textContent='May we use Google Analytics to understand visits? Your images are never uploaded. ';
    const link=document.createElement('a');
    link.href='./privacy.html';link.textContent='Privacy details';
    if(hasPrivacySignal()) {
      description.textContent='Analytics is disabled by your browser privacy setting. No Google Analytics data is sent. ';
    }
    // Keep the privacy notice accessible even when browser signals prevent analytics.
    description.appendChild(link);
    const controls=document.createElement('div');
    controls.className='consent-actions';
    const no=document.createElement('button');no.type='button';no.textContent='No thanks';
    const yes=document.createElement('button');yes.type='button';yes.textContent='Allow analytics';
    no.addEventListener('click',()=>remember('denied'));
    yes.addEventListener('click',()=>remember('granted'));
    if(hasPrivacySignal()) {no.textContent='Keep analytics off';controls.append(no);}
    else controls.append(no,yes);
    banner.append(headline,description,controls);
    if(settings) {
      const close=document.createElement('button');close.type='button';close.className='consent-close';
      close.textContent='Close';close.addEventListener('click',()=>{root.innerHTML='';});
      banner.appendChild(close);
    }
    root.appendChild(banner);
  }
  function remember(value) {
    if(value==='granted' && hasPrivacySignal())value='denied';
    putJSON(STORE,{value,at:Date.now(),version:CONFIG.policyVersion});
    if(value==='granted') enableTracking(); else disableTracking();
    root.innerHTML='';
  }
  function regionNeedsConsent(json) {
    if(!json || json.success === false) throw new Error('Region unavailable');
    const country=String(json.country_code||'').toUpperCase();
    const region=String(json.region_code||'').toUpperCase();
    if(!/^[A-Z]{2}$/.test(country))throw new Error('Invalid region');
    // Fail closed for Canada when its province is unavailable.
    if(country==='CA' && !region) return true;
    return EEA.has(country) || country==='GB' || country==='CH' || (country==='CA' && (region==='QC'||/QUEBEC/i.test(String(json.region||''))));
  }
  async function detectRegion() {
    const cached=getJSON(REGION_STORE);
    if(cached && typeof cached.needsConsent==='boolean' && Date.now()-cached.at < CONFIG.geoCacheMs && Date.now()>=cached.at) return cached.needsConsent;
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),CONFIG.geoTimeoutMs);
    try {
      const response=await fetch(CONFIG.geoEndpoint,{method:'GET',signal:abort.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
      if(!response.ok) throw new Error('Region lookup failed');
      const json=await response.json();
      const needsConsent=regionNeedsConsent(json);
      // Only the consent bucket is cached locally. Never retain IP or city.
      putJSON(REGION_STORE,{needsConsent,at:Date.now()});
      return needsConsent;
    } finally {clearTimeout(timer);}
  }
  async function init() {
    if(initialized)return;
    initialized=true;
    setupTag();
    if(settingsButton)settingsButton.addEventListener('click',()=>renderBanner('settings'));
    if(!CONFIG.allowedHosts.includes(location.hostname))return; // never track forks or local previews
    if(hasPrivacySignal()) { disableTracking(); return; }
    const prior=choice();
    if(prior) { if(prior==='granted')enableTracking(); else disableTracking(); return; }
    try {
      const needsConsent=await detectRegion();
      // Another choice may have been made while the location request was in flight.
      const newChoice=choice();
      if(newChoice==='denied' || hasPrivacySignal()) disableTracking();
      else if(newChoice==='granted') enableTracking();
      else if(needsConsent) renderBanner();
      else enableTracking(); // Non-opt-in regions: notice and opt-out accessible via the Privacy control
    } catch(_) {
      // Unknown location means no assumptions and no Google requests.
      if(choice()==='granted' && !hasPrivacySignal())enableTracking();
      else if(choice()==='denied' || hasPrivacySignal())disableTracking();
      else renderBanner();
    }
  }
  window.BuildifulAnalytics=Object.freeze({
    track(eventName) {
      if(state!=='granted'||!tagLoaded||hasPrivacySignal())return;
      if(!['image_convert','image_download'].includes(eventName))return;
      window.gtag?.('event',eventName,{tool_name:CONFIG.toolName});
    },
    openSettings() {renderBanner('settings');}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void init(),{once:true});else void init();
})();
