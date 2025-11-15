document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const exportBtn = document.getElementById('exportBtn');
  const progress = document.getElementById('progress');
  const keyInput = document.getElementById('facepp_key');
  const secretInput = document.getElementById('facepp_secret');
  const useChk = document.getElementById('use_facepp');

  // load saved credentials
  chrome.storage.local.get(['facepp_key','facepp_secret','use_facepp'], (res)=>{
    if(res.facepp_key) keyInput.value = res.facepp_key;
    if(res.facepp_secret) secretInput.value = res.facepp_secret;
    if(res.use_facepp) useChk.checked = !!res.use_facepp;
  });

  scrapeBtn.addEventListener('click', async () => {
    progress.textContent = 'Saving settings and starting...';
    const cfg = {
      facepp_key: keyInput.value.trim(),
      facepp_secret: secretInput.value.trim(),
      use_facepp: useChk.checked
    };
    chrome.storage.local.set(cfg, ()=>{
      progress.textContent = 'Settings saved. Sending scrape command...';
      chrome.runtime.sendMessage({action:'scrapeTravel'}, (resp)=>{});
    });
  });

  stopBtn.addEventListener('click', ()=>{
    progress.textContent = 'Stop requested...';
    chrome.runtime.sendMessage({action:'cancelScrape'});
  });

  exportBtn.addEventListener('click', ()=>{
    progress.textContent = 'Export requested...';
    chrome.runtime.sendMessage({action:'exportCSV'});
  });

  chrome.runtime.onMessage.addListener((msg,sender,sendResp)=>{
    if(msg.type === 'progress'){
      progress.textContent = msg.text;
    } else if(msg.type === 'done'){
      progress.textContent = 'Completed: ' + msg.text;
    } else if(msg.type === 'error'){
      progress.textContent = 'Error: ' + msg.text;
    }
  });
});
