(() => {
  function findText(el, selectors){
    for(const s of selectors){
      const node = el.querySelector(s);
      if(node && node.textContent) return node.textContent.trim();
    }
    return '';
  }

  const profiles = [];

  // Romeo Travel (Explore) grid parser using provided selector '#explore-grid'
  const travelContainer = document.querySelector('#explore-grid');
  if(travelContainer){
    const anchors = Array.from(travelContainer.querySelectorAll('a[aria-label][href*="/profile/"]'))
                      .concat(Array.from(travelContainer.querySelectorAll('a[href*="/profile/"]')));
    anchors.slice(0, 2000).forEach((a, idx) => {
      try{
        const aria = (a.getAttribute('aria-label') || '').trim();
        const parts = aria.split(',').map(p => p.trim()).filter(Boolean);
        const username = parts.length > 0 ? parts[0] : '';
        const distance = parts.length > 1 ? parts[1] : '';
        const profileUrl = a.href || a.getAttribute('href') || '';

        let image = '';
        const bgEl = a.querySelector('[style*="background-image"]');
        if(bgEl){
          const style = bgEl.getAttribute('style') || '';
          const m = style.match(/background-image:\s*url\((?:\"|\')?(.*?)(?:\"|\')?\)/i);
          if(m && m[1]) image = m[1];
        }

        if(!image){
          const img = a.querySelector('img');
          if(img) image = img.src || img.getAttribute('data-src') || '';
        }

        const bio = parts.length > 2 ? parts.slice(2).join(', ') : '';

        profiles.push({
          id: idx+1,
          username: username,
          distance: distance,
          bio: bio,
          image: image,
          profileUrl: profileUrl
        });
      }catch(e){ }
    });

    profiles;
    return;
  }

  let nodes = Array.from(document.querySelectorAll('[data-testid="profile-card"], .profile-card, .user-card, article'));
  if(nodes.length === 0){
    nodes = Array.from(document.querySelectorAll('a[href*="/profile/"]')).map(a=>a.closest('article')||a.parentElement||a);
  }
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
    }catch(e){ }
  });

  profiles;
})();
