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
    data.age = extractLabelValue('Age') || '';
    data.height = extractLabelValue('Height') || '';
    data.weight = extractLabelValue('Weight') || '';
    data.body_type = extractLabelValue('Body Type') || '';
    data.body_hair = extractLabelValue('Body Hair') || '';
    data.languages = extractLabelValue('Languages') || '';
    data.relationship = extractLabelValue('Relationship') || '';
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

    return data;
  }

  // expose the scraper function
  window.__romeo_profile_scraper = scrapeProfile;
})();
