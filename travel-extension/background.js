// background.js (adapted for Travel scraper)
chrome.runtime.onMessage.addListener(async (msg, sender, sendResp) => {
  if(!msg || !msg.action) return;

  if(msg.action === 'scrapeTravel'){
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    if(!tab){ chrome.runtime.sendMessage({type:'error', text:'No active tab.'}); return; }
    chrome.runtime.sendMessage({type:'progress', text:'Injecting travel scraper...'});

    await chrome.scripting.executeScript({target:{tabId: tab.id}, files: ['content-script.js']});

    const cfg = await new Promise(res=>chrome.storage.local.get(['facepp_key','facepp_secret','use_facepp'], res));
    const useFace = !!cfg.use_facepp && cfg.facepp_key && cfg.facepp_secret;

    try{
      await chrome.scripting.executeScript({target:{tabId: tab.id}, files:['profile-scraper.js','inpage-automation.js']});
      chrome.runtime.sendMessage({type:'progress', text:'Running in-page travel automation...'});
      const autoRes = await chrome.scripting.executeScript({target:{tabId: tab.id}, func: (opts) => {
        if(typeof window.__romeo_run_click_automation === 'function') return window.__romeo_run_click_automation(opts);
        return null;
      }, args: [{delay: 3000, previewDelay: 2500, maxProfiles: 0}]});

      let profiles = [];
      if(autoRes && autoRes[0] && Array.isArray(autoRes[0].result) && autoRes[0].result.length>0){
        profiles = autoRes[0].result.map((p, idx) => ({ id: idx+1, ...p }));
      }

      if(!profiles || profiles.length === 0){
        chrome.runtime.sendMessage({type:'error', text:'No profiles returned by automation.'});
        return;
      }

      chrome.runtime.sendMessage({type:'progress', text:`Got ${profiles.length} profiles. Fetching images and preparing CSV...`});

      async function fetchAsBase64(url){
        if(!url) return '';
        try{
          const res = await fetch(url);
          const blob = await res.blob();
          return await new Promise(r=>{
            const fr = new FileReader();
            fr.onload = ()=> r(fr.result.split(',')[1] || '');
            fr.onerror = ()=> r('');
            fr.readAsDataURL(blob);
          });
        }catch(e){ return ''; }
      }

      for(let i=0;i<profiles.length;i++){
        const p = profiles[i];
        if(!p.image_base64 && p.image){
          p.image_base64 = await fetchAsBase64(p.image).catch(()=>'');
        }
      }

      await new Promise(r=>chrome.storage.local.set({last_profiles: profiles}, r));

      function csvEscape(v){ if(v===null||v===undefined) return ''; return '"'+String(v).replace(/"/g,'""')+'"'; }
      const headers = ['id','profile_id','name','username','bio','location','age','age_range','height','weight','body_type','body_hair','languages','english','bengali','hindi','relationship','position','dick','safer_sex','open_to','member_since','profileUrl','image_base64','facepp_json'];
      const rows = [headers.map(csvEscape).join(',')];
      profiles.forEach(p=>{
        const faceJson = p.facepp ? JSON.stringify(p.facepp).replace(/\n/g,'') : '';
        const row = [
          p.id,
          p.profile_id||'',
          p.name||'',
          p.username||'',
          p.bio||'',
          p.location||'',
          p.age||'',
          p.age_range||'',
          p.height||'',
          p.weight||'',
          p.body_type||'',
          p.body_hair||'',
          p.languages||'',
          p.english||'',
          p.bengali||'',
          p.hindi||'',
          p.relationship||'',
          p.position||'',
          p.dick||'',
          p.safer_sex||'',
          p.open_to||'',
          p.member_since||'',
          p.profileUrl||'',
          p.image_base64||'',
          faceJson
        ].map(csvEscape).join(',');
        rows.push(row);
      });

      const csvContent = rows.join('\n');
      const dataUrl = 'data:text/csv;base64,' + btoa(unescape(encodeURIComponent(csvContent)));
      const filename = 'romeo_travel_export_' + (new Date()).toISOString().replace(/[:.]/g,'-') + '.csv';
      chrome.downloads.download({url: dataUrl, filename});

      chrome.runtime.sendMessage({type:'done', text: `${profiles.length} profiles scraped and CSV downloaded.`});

    }catch(e){
      console.error('Travel scrape failed', e);
      chrome.runtime.sendMessage({type:'error', text: 'Travel scrape failed: '+(e && e.message?e.message:'unknown')});
    }
  }

  if(msg.action === 'cancelScrape'){
    try{ await chrome.scripting.executeScript({target:{tabId: (await chrome.tabs.query({active:true,currentWindow:true}))[0].id}, func: ()=>{ if(window.__romeo_cancel_automation) window.__romeo_cancel_automation(); }}); }catch(e){}
    chrome.runtime.sendMessage({type:'progress', text:'Cancel request sent.'});
  }

  if(msg.action === 'exportCSV'){
    chrome.storage.local.get(['last_profiles'], (res)=>{
      const profiles = res.last_profiles || [];
      if(!profiles || profiles.length === 0){ chrome.runtime.sendMessage({type:'error', text:'No saved profiles to export.'}); return; }
      function csvEscape(v){ if(v===null||v===undefined) return ''; return '"'+String(v).replace(/"/g,'""')+'"'; }
      const headers = ['id','profile_id','name','username','bio','location','age','age_range','height','weight','body_type','body_hair','languages','english','bengali','hindi','relationship','position','dick','safer_sex','open_to','member_since','profileUrl','image_base64','facepp_json'];
      const rows = [headers.map(csvEscape).join(',')];
      profiles.forEach(p=>{
        const faceJson = p.facepp ? JSON.stringify(p.facepp).replace(/\n/g,'') : '';
        const row = [
          p.id,
          p.profile_id||'',
          p.name||'',
          p.username||'',
          p.bio||'',
          p.location||'',
          p.age||'',
          p.age_range||'',
          p.height||'',
          p.weight||'',
          p.body_type||'',
          p.body_hair||'',
          p.languages||'',
          p.english||'',
          p.bengali||'',
          p.hindi||'',
          p.relationship||'',
          p.position||'',
          p.dick||'',
          p.safer_sex||'',
          p.open_to||'',
          p.member_since||'',
          p.profileUrl||'',
          p.image_base64||'',
          faceJson
        ].map(csvEscape).join(',');
        rows.push(row);
      });
      const csvContent = rows.join('\n');
      const dataUrl = 'data:text/csv;base64,' + btoa(unescape(encodeURIComponent(csvContent)));
      const filename = 'romeo_travel_export_' + (new Date()).toISOString().replace(/[:.]/g,'-') + '.csv';
      chrome.downloads.download({url: dataUrl, filename});
      chrome.runtime.sendMessage({type:'done', text: `Exported ${profiles.length} profiles.`});
    });
  }
});
