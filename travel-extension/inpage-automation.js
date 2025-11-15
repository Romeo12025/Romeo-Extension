// inpage-automation.js (adapted to target '#explore-grid' by default)
(function(){
  function waitFor(fn, timeout=30000, interval=500){
    return new Promise((resolve, reject)=>{
      const start = Date.now();
      (function poll(){
        try{ if(fn()) return resolve(true); }catch(e){}
        if(Date.now() - start > timeout) return resolve(false);
        setTimeout(poll, interval);
      })();
    });
  }

  window.__romeo_automation_cancel = false;
  window.__romeo_cancel_automation = function(){ window.__romeo_automation_cancel = true; };

  window.__romeo_run_click_automation = async function(opts){
    opts = opts || {};
    const delay = typeof opts.delay === 'number' ? opts.delay : 3000;
    const previewDelay = typeof opts.previewDelay === 'number' ? opts.previewDelay : 2500;
    const maxProfiles = typeof opts.maxProfiles === 'number' && opts.maxProfiles>0 ? opts.maxProfiles : Infinity;

    const container = document.querySelector('#explore-grid') || document.querySelector('#profiles.search-results.js-refreshable, #profiles') || document;
    let anchors = Array.from(container.querySelectorAll('a[aria-label][href*="/profile/"]'));
    if(anchors.length === 0) anchors = Array.from(container.querySelectorAll('a[href*="/profile/"]'));
    if(maxProfiles !== Infinity) anchors = anchors.slice(0, maxProfiles);

    const results = [];
    for(let i=0;i<anchors.length;i++){
      if(window.__romeo_automation_cancel) break;
      const a = anchors[i];
      try{
        const prevHref = location.href;
        try{ a.scrollIntoView({block:'center'}); }catch(e){}
        a.click();

        const profileLoaded = await waitFor(()=> location.href.includes('/profile/') || !!document.querySelector('h1') || !!document.querySelector('[data-testid="profile"]'), 30000, 500);
        if(!profileLoaded) await new Promise(r=>setTimeout(r, 1000));

        try{
          const picAnchor = document.querySelector('a.js-slideshow-link, a.image--cover, .image--cover, a.js-link-preview');
          if(picAnchor){ try{ picAnchor.click(); }catch(e){} await new Promise(r=>setTimeout(r, previewDelay)); } else { await new Promise(r=>setTimeout(r, 600)); }
        }catch(e){}

        let profileData = null;
        try{
          if(typeof window.__romeo_profile_scraper === 'function'){
            profileData = await window.__romeo_profile_scraper();
          } else {
            const name = (document.querySelector('h1') && document.querySelector('h1').textContent.trim()) || '';
            const image = (document.querySelector('img') && (document.querySelector('img').src || document.querySelector('img').getAttribute('data-src'))) || '';
            profileData = {name, profileUrl: location.href, image, image_base64: ''};
          }
        }catch(e){ profileData = {profileUrl: location.href}; }

        results.push(profileData || {profileUrl: location.href});

        const nextLink = document.querySelector('.js-link--next, a.js-link--next, .preview__link--next');
        if(nextLink){ try{ nextLink.click(); }catch(e){} await waitFor(()=> location.href.includes('/profile/') && !!document.querySelector('.js-image--next, .preview__image') , 30000, 500); await new Promise(r=>setTimeout(r, delay)); const newAnchors = Array.from(container.querySelectorAll('a[aria-label][href*="/profile/"]')); if(newAnchors.length>0) anchors = newAnchors; if(window.__romeo_automation_cancel) break; continue; }

        try{ history.back(); }catch(e){}
        await waitFor(()=> location.href === prevHref || !!document.querySelector('#profiles') || !!document.querySelector('[data-testid="search-results"]'), 30000, 500);
        await new Promise(r=>setTimeout(r, delay));
        const newAnchors = Array.from(container.querySelectorAll('a[aria-label][href*="/profile/"]'));
        if(newAnchors.length>0) anchors = newAnchors;
        if(window.__romeo_automation_cancel) break;
      }catch(e){ }
    }

    return results;
  };
})();
