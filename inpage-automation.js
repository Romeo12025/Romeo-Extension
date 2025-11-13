// inpage-automation.js
// Exposes window.__romeo_run_click_automation(options) which will click each profile
// tile in the Nearby list, wait for the profile view to render, run the page scraper,
// then go back and continue. Returns an array of profile data.
(function(){
  function waitFor(fn, timeout=30000, interval=500){
    return new Promise((resolve, reject)=>{
      const start = Date.now();
      (function poll(){
        try{
          if(fn()) return resolve(true);
        }catch(e){}
        if(Date.now() - start > timeout) return resolve(false);
        setTimeout(poll, interval);
      })();
    });
  }

  // cancellation flag set on window to stop the automation
  window.__romeo_automation_cancel = false;
  window.__romeo_cancel_automation = function(){ window.__romeo_automation_cancel = true; };

  window.__romeo_run_click_automation = async function(opts){
    opts = opts || {};
    // default delay between profile navigations (ms). Increased to reduce race conditions.
    const delay = typeof opts.delay === 'number' ? opts.delay : 3000;
    const maxProfiles = typeof opts.maxProfiles === 'number' && opts.maxProfiles>0 ? opts.maxProfiles : Infinity;

    const container = document.querySelector('#profiles.search-results.js-refreshable, #profiles') || document;
    let anchors = Array.from(container.querySelectorAll('a[aria-label][href*="/profile/"]'));
    anchors = anchors.filter(a => a.href && a.getAttribute('aria-label'));
    if(anchors.length === 0){
      // fallback anchors
      anchors = Array.from(document.querySelectorAll('a[href*="/profile/"]'));
    }
    if(maxProfiles !== Infinity) anchors = anchors.slice(0, maxProfiles);

    const results = [];
    for(let i=0;i<anchors.length;i++){
      if(window.__romeo_automation_cancel) break;
      const a = anchors[i];
      try{
        const prevHref = location.href;
        // scroll into view and click
        try{ a.scrollIntoView({block:'center'}); }catch(e){}
        a.click();

        // Wait for profile view: either URL contains /profile/ or a DOM element that looks like a profile
        const profileLoaded = await waitFor(()=> location.href.includes('/profile/') || !!document.querySelector('h1') || !!document.querySelector('[data-testid="profile"]'), 30000, 500);
        if(!profileLoaded){
          // try small delay and continue
          await new Promise(r=>setTimeout(r, 1000));
        }

        // give site time to render
        await new Promise(r=>setTimeout(r, 500));

        // run the page scraper if available
        let profileData = null;
        try{
          if(typeof window.__romeo_profile_scraper === 'function'){
            profileData = await window.__romeo_profile_scraper();
          } else {
            // minimal extraction if scraper not present
            const name = (document.querySelector('h1') && document.querySelector('h1').textContent.trim()) || '';
            const image = (document.querySelector('img') && (document.querySelector('img').src || document.querySelector('img').getAttribute('data-src'))) || '';
            profileData = {name, profileUrl: location.href, image, image_base64: ''};
          }
        }catch(e){ profileData = {profileUrl: location.href}; }

        results.push(profileData || {profileUrl: location.href});

        // go back to the list
        try{ history.back(); }catch(e){ }
        // wait until URL returns to previous or list container is visible
        await waitFor(()=> location.href === prevHref || !!document.querySelector('#profiles') || !!document.querySelector('[data-testid="search-results"]'), 30000, 500);

        // short delay between items
        await new Promise(r=>setTimeout(r, delay));

        // re-collect anchors in case DOM changed (infinite scroll etc.)
        const newAnchors = Array.from(container.querySelectorAll('a[aria-label][href*="/profile/"]'));
        if(newAnchors.length > 0) anchors = newAnchors;

        if(window.__romeo_automation_cancel) break;

      }catch(e){
        // ignore and continue
      }
    }

    return results;
  };
})();
