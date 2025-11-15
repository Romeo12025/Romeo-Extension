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

  // Visual pointer helpers: create/move/pulse a visible pointer so the user
  // can see which tile is being clicked during automation.
  function __romeo_create_pointer(){
    if(window.__romeo_pointer) return;
    const el = document.createElement('div');
    el.id = '__romeo_pointer';
    el.style.position = 'absolute';
    el.style.zIndex = 2147483647;
    el.style.pointerEvents = 'none';
    el.style.width = '44px';
    el.style.height = '44px';
    el.style.borderRadius = '50%';
    el.style.border = '3px solid rgba(0,150,255,0.95)';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
    el.style.background = 'rgba(0,150,255,0.06)';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    el.style.transition = 'left 0.18s ease, top 0.18s ease, transform 0.12s ease, opacity 0.18s ease';
    el.style.opacity = '0';

    const label = document.createElement('div');
    label.id = '__romeo_pointer_label';
    label.style.position = 'absolute';
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.top = '48px';
    label.style.padding = '2px 6px';
    label.style.fontSize = '12px';
    label.style.background = 'rgba(0,0,0,0.7)';
    label.style.color = 'white';
    label.style.borderRadius = '4px';
    label.style.pointerEvents = 'none';
    label.style.whiteSpace = 'nowrap';
    label.style.opacity = '0';

    el.appendChild(label);
    document.body.appendChild(el);
    window.__romeo_pointer = el;
    window.__romeo_pointer_label = label;
  }

  function __romeo_move_pointer_to(target, text){
    try{
      __romeo_create_pointer();
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width/2 + window.scrollX;
      const cy = rect.top + rect.height/2 + window.scrollY;
      window.__romeo_pointer.style.left = cx + 'px';
      window.__romeo_pointer.style.top = cy + 'px';
      window.__romeo_pointer.style.opacity = '1';
      if(window.__romeo_pointer_label){
        window.__romeo_pointer_label.textContent = text || '';
        window.__romeo_pointer_label.style.opacity = text ? '1' : '0';
      }
    }catch(e){}
  }

  function __romeo_pulse_pointer(){
    try{
      if(!window.__romeo_pointer) return;
      window.__romeo_pointer.style.transform = 'translate(-50%,-50%) scale(0.88)';
      setTimeout(()=>{ if(window.__romeo_pointer) window.__romeo_pointer.style.transform = 'translate(-50%,-50%) scale(1)'; }, 160);
    }catch(e){}
  }

  function __romeo_remove_pointer(){
    try{ if(window.__romeo_pointer) window.__romeo_pointer.remove(); if(window.__romeo_pointer_label) window.__romeo_pointer_label.remove(); delete window.__romeo_pointer; delete window.__romeo_pointer_label; }catch(e){}
  }

  window.__romeo_run_click_automation = async function(opts){
    opts = opts || {};
    // default delay between profile navigations (ms). Increased to reduce race conditions.
    const delay = typeof opts.delay === 'number' ? opts.delay : 3000;
    // delay after clicking the profile picture to allow details to render (ms)
    const previewDelay = typeof opts.previewDelay === 'number' ? opts.previewDelay : 2500;
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
        // scroll into view and click (with visible pointer)
        try{ a.scrollIntoView({block:'center'}); }catch(e){}
        try{
          __romeo_move_pointer_to(a, (i+1) + '/' + anchors.length);
          await new Promise(r=>setTimeout(r, 180));
          __romeo_pulse_pointer();
          await new Promise(r=>setTimeout(r, 120));
        }catch(e){}
        try{ a.click(); }catch(e){}

        // Wait for profile view: either URL contains /profile/ or a DOM element that looks like a profile
        const profileLoaded = await waitFor(()=> location.href.includes('/profile/') || !!document.querySelector('h1') || !!document.querySelector('[data-testid="profile"]'), 30000, 500);
        if(!profileLoaded){
          // try small delay and continue
          await new Promise(r=>setTimeout(r, 1000));
        }

        // attempt to click the profile picture to reveal full details, then wait
        try{
          const picAnchor = document.querySelector('a.js-slideshow-link, a.image--cover, .image--cover, a.js-link-preview');
          if(picAnchor){
            try{ __romeo_move_pointer_to(picAnchor, 'preview'); __romeo_pulse_pointer(); }catch(e){}
            await new Promise(r=>setTimeout(r, 160));
            try{ picAnchor.click(); }catch(e){}
            await new Promise(r=>setTimeout(r, previewDelay));
          }else{
            // small pause if no picture anchor
            await new Promise(r=>setTimeout(r, 600));
          }
        }catch(e){}

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

        // try to click the 'next' control to move to the next profile in preview if present
        const nextLink = document.querySelector('.js-link--next, a.js-link--next, .preview__link--next');
        if(nextLink){
          try{ __romeo_move_pointer_to(nextLink, 'next'); __romeo_pulse_pointer(); }catch(e){}
          await new Promise(r=>setTimeout(r, 160));
          try{ nextLink.click(); }catch(e){}
          // wait for preview to update: either URL or main preview image changes
          await waitFor(()=> location.href.includes('/profile/') && !!document.querySelector('.js-image--next, .preview__image') , 30000, 500);
          // short delay before next iteration
          await new Promise(r=>setTimeout(r, delay));
          // re-collect anchors in case DOM changed (infinite scroll etc.)
          const newAnchors = Array.from(container.querySelectorAll('a[aria-label][href*="/profile/"]'));
          if(newAnchors.length > 0) anchors = newAnchors;
          if(window.__romeo_automation_cancel) break;
          continue; // move to next loop iteration without history.back()
        }

        // if no next link, go back to the list view and continue
        try{ history.back(); }catch(e){}
        await waitFor(()=> location.href === prevHref || !!document.querySelector('#profiles') || !!document.querySelector('[data-testid="search-results"]'), 30000, 500);
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
