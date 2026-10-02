import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launchBrowser} from './browser-helper.mjs';
const source=await readFile('tools/package-browser.mjs','utf8');
const css=source.match(/<style>([\s\S]*?)<\/style>/)[1];
const panel=source.match(/const joinPanel = `([\s\S]*?)`;/)[1];
const logo=(await readFile('Assets/Resources/BrandLogo.png')).toString('base64');
const browser=await launchBrowser();
const results=[];
try {
 const page=await browser.page('about:blank');
 await page.call('Page.setDocumentContent',{frameId:(await page.call('Page.getFrameTree')).frameTree.frame.id,html:`<style>${css}</style>${panel.replace('src="brand-logo.png"',`src="data:image/png;base64,${logo}"`)}`});
 await page.evaluate(`document.querySelector('#student-address').textContent='https://worthingtonjg.github.io/HistoryStratego/';document.querySelector('#projector-code').textContent='ABCD';document.querySelector('#join-panel').showModal()`);
 for(const [width,height,label] of [[1722,861,'reported viewport'],[1920,900,'desktop'],[1366,632,'laptop'],[1024,500,'short projector'],[861,430,'200% zoom equivalent'],[390,600,'narrow'],[320,240,'extreme fallback']]){
  await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const r=await page.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>{const d=document.querySelector('#join-panel'),b=document.querySelector('#close-join').getBoundingClientRect();resolve({width:innerWidth,height:innerHeight,scroll:d.scrollHeight-d.clientHeight,closeBottom:b.bottom,dialogBottom:d.getBoundingClientRect().bottom,horizontal:d.scrollWidth-d.clientWidth,steps:document.querySelectorAll('#join-panel li').length})}))`);
  assert.equal(r.steps,3);assert(r.horizontal<=1);assert(r.dialogBottom<=height+1);
  if(height>=430){assert(r.scroll<=1,JSON.stringify(r));assert(r.closeBottom<=height,JSON.stringify(r));}
  results.push({label,...r});
 }
 await writeFile('Logs/projector-responsive-layout.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close();}
