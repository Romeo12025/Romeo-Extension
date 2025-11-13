(() => {
  function findText(el, selectors){
    for(const s of selectors){
      const node = el.querySelector(s);
      if(node && node.textContent) return node.textContent.trim();
    }
    return '';
  }

  const profiles = [];

  // Romeo.com Nearby tab parser (matches the HTML you provided)
  const romeoContainer = document.querySelector('#profiles.search-results.js-refreshable, #profiles');
  if(romeoContainer){
    // Select anchors that represent profile tiles
    const anchors = Array.from(romeoContainer.querySelectorAll('a[aria-label][href*="/profile/"]'));
    anchors.slice(0, 1000).forEach((a, idx) => {
      try{
        const aria = (a.getAttribute('aria-label') || '').trim();
        // aria-label format: "username, 50m, Manual location, ..."
        const parts = aria.split(',').map(p => p.trim()).filter(Boolean);
        const username = parts.length > 0 ? parts[0] : '';
        const distance = parts.length > 1 ? parts[1] : '';

        // profile url
        const profileUrl = a.href || a.getAttribute('href') || '';

        // image: look for element with inline background-image style
        let image = '';
        const bgEl = a.querySelector('[style*="background-image"]');
        if(bgEl){
          const style = bgEl.getAttribute('style') || '';
          const m = style.match(/background-image:\s*url\((?:\"|\')?(.*?)(?:\"|\')?\)/i);
          if(m && m[1]) image = m[1];
        }

        // fallback image from <img>
        if(!image){
          const img = a.querySelector('img');
          if(img) image = img.src || img.getAttribute('data-src') || '';
        }

        // bio / snippet maybe stored in aria-label beyond distance
        const bio = parts.length > 2 ? parts.slice(2).join(', ') : '';

        profiles.push({
          id: idx+1,
          username: username,
          distance: distance,
          bio: bio,
          image: image,
          profileUrl: profileUrl
        });
      }catch(e){ /* ignore single tile errors */ }
    });
    // return early
    profiles;
    return;
  }

  // Fallback: Try a set of selectors commonly used for profile cards on other sites
  let nodes = Array.from(document.querySelectorAll('[data-testid="profile-card"], .profile-card, .user-card, article'));
  if(nodes.length === 0){
    nodes = Array.from(document.querySelectorAll('a[href*="/profile/"]'))
               .map(a => a.closest('article') || a.parentElement || a);
  }

  // Deduplicate nodes
  nodes = nodes.filter((v,i,a)=>a.indexOf(v)===i).slice(0,500);

  nodes.forEach((el, idx) => {
    try{
      const linkEl = el.querySelector('a[href*="/profile/"]') || el.querySelector('a');
      const profileUrl = linkEl ? (linkEl.href || '') : '';

      const imgEl = el.querySelector('img');
      const image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

      const name = findText(el, ['h1','h2','h3','.name','.card-name']) || '';
      const bio = findText(el, ['.bio','.description','.about']) || '';
      const extra = findText(el, ['.age','.distance','.meta']) || '';

      profiles.push({
        id: idx+1,
        name: name,
        bio: bio,
        extra: extra,
        image: image,
        profileUrl: profileUrl
      });
    }catch(e){ /* ignore */ }
  });

  // Return the profiles array for the caller (chrome.scripting.executeScript will receive this)
  profiles;
})();
