// profile-scraper.js
// Injected into a profile page. Exposes an async function on window that returns the profile data.
(function(){
  async function imageToBase64(url){
    if(!url) return '';
    try{
      return await new Promise((res)=>{
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = ()=>{
          try{
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img,0,0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            res(dataUrl.split(',')[1]);
          }catch(err){
            res('');
          }
        };
        img.onerror = ()=>res('');
        // Ensure absolute URL
        try{ img.src = new URL(url, location.href).href; }catch(e){ img.src = url; }
      });
    }catch(e){ return ''; }
  }

  async function scrapeProfile(){
    function q(sel){ return document.querySelector(sel); }
    function textOf(sel){ const n = q(sel); return n ? n.textContent.trim() : ''; }

    // small delay to allow dynamic content to render before we read fields
    await new Promise(r=>setTimeout(r, 800));

    function extractLabelValue(label){
      // Find a <p> whose text equals the label, then read the nearby value
      const ps = Array.from(document.querySelectorAll('p'));
      const lab = ps.find(p=>p.textContent && p.textContent.trim() === label);
      if(!lab) return '';
      const parent = lab.parentElement;
      if(!parent) return '';
      // value often sits in a sibling div -> p
      const val = parent.querySelector('div p') || parent.querySelector('p');
      if(val && val !== lab) return val.textContent.trim();
      // try nextSibling
      if(parent.nextElementSibling){
        const v2 = parent.nextElementSibling.querySelector('p');
        if(v2) return v2.textContent.trim();
      }
      return '';
    }

    const data = {};
    // helper to try multiple selectors
    function getTextSelectors(list){
      for(const s of list){
        const el = document.querySelector(s);
        if(el && el.textContent && el.textContent.trim()) return el.textContent.trim();
      }
      return '';
    }

    function getProfileId(){
      const selectors = [
        'header .sc-rcepan-2.jZxKik p',
        '.sc-rcepan-2.jZxKik p',
        'h1 p',
        '.eeZNnP'
      ];
      return getTextSelectors(selectors);
    }

    // id / display name
    data.id = getProfileId() || '';
    // name: prefer H1 or the id if present
    data.name = textOf('h1') || textOf('h2') || textOf('.sc-fewm29-2.loIzXZ') || data.id || '';
    // username from URL (handle profile/<username>/ or profile/<username>)
    data.username = (location.pathname.match(/profile\/(.*?)\//) || location.pathname.match(/profile\/(.*)$/) || [])[1] || '';
    data.profileUrl = location.href;

    // bio / about (various possible selectors)
    data.bio = textOf('.about') || textOf('.user-bio') || textOf('.profile-about') || getTextSelectors(['.profile__info .eeZNnP', '.BodyText-sc-1lb5dia-0.eeZNnP']) || '';

    // attempt to find image: background or img
    let imageUrl = '';
    const styled = Array.from(document.querySelectorAll('[style]'));
    const bgEl = styled.find(el=> (el.getAttribute('style')||'').match(/url\(/i));
    if(bgEl){
      const style = bgEl.getAttribute('style') || '';
      const m = style.match(/url\((?:\"|\')?(.*?)(?:\"|\')?\)/i);
      if(m && m[1]) imageUrl = m[1];
    }
    if(!imageUrl){
      const img = document.querySelector('img');
      if(img) imageUrl = img.src || img.getAttribute('data-src') || '';
    }
    if(imageUrl){
      try{ data.image = new URL(imageUrl, location.href).href; }catch(e){ data.image = imageUrl; }
    } else data.image = '';

    // try to get more metadata from aria-label or meta tags
    const aria = document.querySelector('[aria-label]') ? (document.querySelector('[aria-label]').getAttribute('aria-label')||'') : '';
    if(aria && !data.bio) data.bio = aria;

    // Extract labeled fields (Age, Height, Weight, Body Type, Body Hair, Languages, Relationship)
    // Try specific selectors first (generalized to avoid fixed profile id), then fallback to label search
    function trySelectors(list){
      for(const s of list){
        try{
          const el = document.querySelector(s);
          if(el && el.textContent && el.textContent.trim()) return el.textContent.trim();
        }catch(e){}
      }
      return '';
    }

    data.age = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(1) .dWRtPT']) || extractLabelValue('Age') || '';
    data.height = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(2) .dWRtPT']) || extractLabelValue('Height') || '';
    data.weight = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(3) .dWRtPT']) || extractLabelValue('Weight') || '';
    data.body_type = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(4) .dWRtPT']) || extractLabelValue('Body Type') || '';
    data.body_hair = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(5) .dWRtPT']) || extractLabelValue('Body Hair') || '';
    data.languages = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div .dWRtPT']) || extractLabelValue('Languages') || '';
    data.relationship = trySelectors(['div.below-fold section .reactView > div > details:nth-child(1) > div > div .dWRtPT']) || extractLabelValue('Relationship') || '';
    // convenience flags for some languages
    const langsLower = (data.languages || '').toLowerCase();
    data.english = langsLower.includes('english') ? 'yes' : '';
    data.bengali = langsLower.includes('bengali') ? 'yes' : '';
    data.hindi = langsLower.includes('hindi') ? 'yes' : '';

    // Try to get image base64 in-page (safer for same-origin)
    data.image_base64 = '';
    if(data.image){
      try{
        data.image_base64 = await imageToBase64(data.image);
      }catch(e){ data.image_base64 = ''; }
    }

    // Additional fields from Sexual / Looking For / header
    data.location = trySelectors(['.profile__info .cmLITB', '.BodyText-sc-1lb5dia-0.cmLITB', '.profile__info .BodyText-sc-1lb5dia-0']) || '';

    // Sexual section (details:nth-child(2))
    data.position = trySelectors(['div.below-fold section .reactView > div > details:nth-child(2) > div > div:nth-child(1) .dWRtPT']) || extractLabelValue('Position') || '';
    data.dick = trySelectors(['div.below-fold section .reactView > div > details:nth-child(2) > div > div:nth-child(2) .dWRtPT']) || extractLabelValue('Dick') || '';
    data.safer_sex = trySelectors(['div.below-fold section .reactView > div > details:nth-child(2) > div > div:nth-child(3) .dWRtPT']) || extractLabelValue('Safer sex') || '';

    // Looking For (details:nth-child(3))
    data.open_to = trySelectors(['div.below-fold section .reactView > div > details:nth-child(3) > div > div:nth-child(1) .dWRtPT']) || extractLabelValue('Open to') || '';
    data.age_range = trySelectors(['div.below-fold section .reactView > div > details:nth-child(3) > div > div:nth-child(2) .dWRtPT']) || extractLabelValue('Age range') || '';

    // Member since and Profile ID (single paragraph with <br>)
    try{
      const memEl = document.querySelector('section.sc-mtxjf3-0.eMUZzW') || document.querySelector('.sc-mtxjf3-0.eMUZzW');
      if(memEl){
        const txt = memEl.textContent || '';
        const m1 = txt.match(/Member since:\s*([^\n\r<]+)/i);
        const m2 = txt.match(/Profile ID:\s*(\d+)/i);
        data.member_since = m1 ? m1[1].trim() : '';
        data.profile_id = m2 ? m2[1].trim() : '';
      } else {
        data.member_since = extractLabelValue('Member since') || '';
        data.profile_id = extractLabelValue('Profile ID') || '';
      }
    }catch(e){ data.member_since = ''; data.profile_id = ''; }

    return data;
  }

  // expose the scraper function
  window.__romeo_profile_scraper = scrapeProfile;
  // Visual helper: highlight detected elements for each field so user can verify selectors
  function makeOverlay(idLabel, rect){
    const o = document.createElement('div');
    o.className = 'romeo-highlight-overlay';
    o.style.position = 'absolute';
    o.style.zIndex = 2147483647;
    o.style.pointerEvents = 'none';
    o.style.border = '2px solid rgba(255,80,80,0.95)';
    o.style.background = 'rgba(255,255,255,0.03)';
    o.style.left = (rect.left + window.scrollX) + 'px';
    o.style.top = (rect.top + window.scrollY) + 'px';
    o.style.width = Math.max(6, rect.width) + 'px';
    o.style.height = Math.max(6, rect.height) + 'px';
    const label = document.createElement('div');
    label.textContent = idLabel;
    label.style.position = 'absolute';
    label.style.left = '0';
    label.style.top = '-18px';
    label.style.background = 'rgba(255,80,80,0.95)';
    label.style.color = 'white';
    label.style.fontSize = '12px';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '3px';
    label.style.pointerEvents = 'none';
    o.appendChild(label);
    document.body.appendChild(o);
    return o;
  }

  let __romeo_overlays = [];
  function clearOverlays(){
    try{
      __romeo_overlays.forEach(n=>n.remove());
    }catch(e){}
    __romeo_overlays = [];
  }

  function findLabelElement(label){
    const ps = Array.from(document.querySelectorAll('p'));
    for(const p of ps){
      if(p.textContent && p.textContent.trim() === label){
        // parent contains label and value
        const parent = p.parentElement;
        if(!parent) return null;
        const val = parent.querySelector('.cRfmWg p, .dWRtPT, div p');
        if(val) return val;
        // try sibling
        if(parent.nextElementSibling){
          const v2 = parent.nextElementSibling.querySelector('p');
          if(v2) return v2;
        }
        return p;
      }
    }
    return null;
  }

  window.__romeo_highlight_fields = function(){
    clearOverlays();
    const mapping = {
      'id': ['header .sc-rcepan-2.jZxKik p', '.sc-rcepan-2.jZxKik p', 'h1 p', '.eeZNnP'],
      'name': ['h1','h2','.sc-fewm29-2.loIzXZ'],
      'username': [],
      'bio': ['.profile__info .eeZNnP','.BodyText-sc-1lb5dia-0.eeZNnP','.about','.user-bio','.profile-about'],
      // prefer specific below-fold selectors (generalized without a fixed profile id)
      'age': ['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(1) .dWRtPT', 'Age'],
      'height': ['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(2) .dWRtPT', 'Height'],
      'weight': ['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(3) .dWRtPT', 'Weight'],
      'body_type': ['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(4) .dWRtPT', 'Body Type'],
      'body_hair': ['div.below-fold section .reactView > div > details:nth-child(1) > div > div:nth-child(5) .dWRtPT', 'Body Hair'],
      'languages': ['Languages'],
      'relationship': ['Relationship']
    };

    for(const key of Object.keys(mapping)){
      let el = null;
      const sel = mapping[key];
      if(sel.length > 0){
        // if entries are labels (like 'Age') then use findLabelElement
        if(sel[0].match(/^[A-Za-z ]+$/)){
          el = findLabelElement(sel[0]);
        } else {
          for(const s of sel){
            const e = document.querySelector(s);
            if(e){ el = e; break; }
          }
        }
      }
      // special case username: point to header id if available
      if(key === 'username' && !el){
        el = document.querySelector('header .sc-rcepan-2.jZxKik p') || document.querySelector('.sc-rcepan-2.jZxKik p');
      }
      if(el){
        const rect = el.getBoundingClientRect();
        const ov = makeOverlay(key, rect);
        __romeo_overlays.push(ov);
      }
    }
    return __romeo_overlays.length;
  };

  window.__romeo_clear_highlights = clearOverlays;
})();
