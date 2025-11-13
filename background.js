// background service worker for scraping and exporting CSV

async function blobToBase64(blob){
  return await new Promise((res, rej)=>{
    const reader = new FileReader();
    reader.onloadend = ()=>res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

function csvEscape(val){
  if(val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return '"' + s + '"';
}

async function fetchImageAsBase64(url){
  if(!url) return '';
  try{
    const resp = await fetch(url, {mode:'cors'});
    if(!resp.ok) return '';
    const blob = await resp.blob();
    return await blobToBase64(blob);
  }catch(e){
    try{
      // try without CORS (may fail)
      const resp2 = await fetch(url);
      const blob2 = await resp2.blob();
      return await blobToBase64(blob2);
    }catch(err){
      return '';
    }
  }
}

async function callFacePP(key, secret, base64Image){
  if(!key || !secret || !base64Image) return null;
  try{
    const fd = new URLSearchParams();
    fd.append('api_key', key);
    fd.append('api_secret', secret);
    fd.append('image_base64', base64Image);
    // detect faces and return json
    const resp = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: fd.toString()
    });
    if(!resp.ok) return null;
    return await resp.json();
  }catch(e){
    return null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if(msg && msg.action === 'scrapeNearby'){
    (async ()=>{
      try{
        // find active tab
        const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
        if(!tab) {
          chrome.runtime.sendMessage({type:'error', text:'No active tab found.'});
          return;
        }

        chrome.runtime.sendMessage({type:'progress', text:'Injecting scraper into page...'});

        // execute content script function to return profiles
        const results = await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content-script.js']
        });

        // the executed script returns under results[0].result but our content-script simply evaluates to the array
        let profiles = [];
        if(results && results.length && results[0].result){
          profiles = results[0].result;
        } else {
          // If no result, try running a function directly
          const fnRes = await chrome.scripting.executeScript({
            target:{tabId: tab.id},
            func: () => {
              function findText(el, selectors){
                for(const s of selectors){
                  const node = el.querySelector(s);
                  if(node && node.textContent) return node.textContent.trim();
                }
                return '';
              }
              const profiles = [];
              let nodes = Array.from(document.querySelectorAll('[data-testid="profile-card"], .profile-card, .user-card, article'));
              if(nodes.length === 0){
                nodes = Array.from(document.querySelectorAll('a[href*="/profile/"]')).map(a=>a.closest('article')||a.parentElement||a);
              }
              nodes = nodes.filter((v,i,a)=>a.indexOf(v)===i).slice(0,500);
              nodes.forEach((el, idx)=>{
                try{
                  const linkEl = el.querySelector('a[href*="/profile/"]') || el.querySelector('a');
                  const profileUrl = linkEl ? (linkEl.href || '') : '';
                  const imgEl = el.querySelector('img');
                  const image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
                  const name = findText(el, ['h1','h2','h3','.name','.card-name']) || '';
                  const bio = findText(el, ['.bio','.description','.about']) || '';
                  const extra = findText(el, ['.age','.distance','.meta']) || '';
                  profiles.push({id: idx+1, name, bio, extra, image, profileUrl});
                }catch(e){}
              });
              return profiles;
            }
          });
          if(fnRes && fnRes[0] && fnRes[0].result) profiles = fnRes[0].result;
        }

        if(!profiles || profiles.length === 0){
          chrome.runtime.sendMessage({type:'error', text:'No profiles found on the page. Make sure Nearby tab is open and content is visible.'});
          return;
        }

        chrome.runtime.sendMessage({type:'progress', text:`Found ${profiles.length} profiles. Processing...`});

        const cfg = await new Promise(res=>chrome.storage.local.get(['facepp_key','facepp_secret','use_facepp'], res));
        const useFace = !!cfg.use_facepp && cfg.facepp_key && cfg.facepp_secret;

        // Prefer in-page click-through automation: inject the page scraper and automation
        // controller, then run the automation which clicks each profile, scrapes details
        // in-page, then returns an array of detailed profile objects.
        try{
          await chrome.scripting.executeScript({target:{tabId: tab.id}, files:['profile-scraper.js','inpage-automation.js']});
          chrome.runtime.sendMessage({type:'progress', text:'Running in-page click-through automation...'});
          const autoRes = await chrome.scripting.executeScript({
            target:{tabId: tab.id},
            func: (opts) => {
              if(typeof window.__romeo_run_click_automation === 'function'){
                return window.__romeo_run_click_automation(opts);
              }
              return null;
            },
            args: [{delay: 1000, maxProfiles: 0}]
          });
          if(autoRes && autoRes[0] && Array.isArray(autoRes[0].result) && autoRes[0].result.length > 0){
            profiles = autoRes[0].result.map((p, idx)=>({ id: idx+1, name: p.name||'', bio: p.bio||'', extra: p.extra||'', image: p.image||'', profileUrl: p.profileUrl||'', image_base64: p.image_base64||'', facepp: p.facepp||null }));
          }
        }catch(e){
          // if automation fails, fall back to previous per-profile navigation behavior
          console.error('In-page automation failed:', e);
        }

        // Ensure any profiles without image_base64 are processed via background fetch
        for(let i=0;i<profiles.length;i++){
          const p = profiles[i];
          chrome.runtime.sendMessage({type:'progress', text:`Processing ${i+1}/${profiles.length}: ${p.name || p.profileUrl}`});
          if(!p.image_base64 && p.image){
            p.image_base64 = await fetchImageAsBase64(p.image);
          }
          if(useFace && p.image_base64 && !p.facepp){
            const faceRes = await callFacePP(cfg.facepp_key, cfg.facepp_secret, p.image_base64);
            p.facepp = faceRes;
          }
        }
        // build CSV
        const headers = ['id','name','bio','extra','profileUrl','image_base64','facepp_json'];
        const rows = [headers.map(csvEscape).join(',')];
        profiles.forEach(p => {
          const faceJson = p.facepp ? JSON.stringify(p.facepp).replace(/\n/g,'') : '';
          const row = [p.id, p.name, p.bio, p.extra, p.profileUrl, p.image_base64, faceJson].map(csvEscape).join(',');
          rows.push(row);
        });
        const csv = rows.join('\n');

        // download CSV as file
        // Note: `URL.createObjectURL` is not available in MV3 service workers in some contexts.
        // Convert blob to base64 data URL instead and pass that to chrome.downloads.download.
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const csvBase64 = await blobToBase64(blob); // returns base64 string
        const dataUrl = 'data:text/csv;charset=utf-8;base64,' + csvBase64;
        await chrome.downloads.download({url: dataUrl, filename: 'romeo_nearby_export.csv', saveAs: true});

        chrome.runtime.sendMessage({type:'done', text:`Export finished (${profiles.length} rows).`});
      }catch(e){
        chrome.runtime.sendMessage({type:'error', text: String(e)});
      }
    })();
  }
});
