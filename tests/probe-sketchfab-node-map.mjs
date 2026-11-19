import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('console',msg=>{if(msg.type()==='error')console.error('PAGE_CONSOLE',msg.text().slice(0,600));});
page.on('pageerror',e=>console.error('PAGE_ERROR',e.message.slice(0,600)));
page.on('requestfailed',req=>console.error('REQUEST_FAILED',req.url().slice(0,230),req.failure()?.errorText));
page.on('response',resp=>{if(resp.status()>=400)console.error('HTTP_ERROR',resp.status(),resp.url().slice(0,250));});
page.on('framenavigated',frame=>console.log('FRAME',frame.url().slice(0,260)));
try{
  await page.goto('https://edm28.fr/transparence',{waitUntil:'domcontentloaded',timeout:30000});
  await page.addScriptTag({url:'https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js'});
  const result=await page.evaluate(async()=>{
    const frame=document.getElementById('edm3dReferenceFrame');
    if(!frame || !window.Sketchfab)throw new Error('Viewer API missing');
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('viewerready timeout')),120000);
      const client=new window.Sketchfab('1.12.1',frame);
      client.init('5fd62615f72a4012a5ebc15cd4c64461',{
        autostart:1,preload:1,
        success(api){
          api.addEventListener('viewerready',()=>{
            api.getNodeMap((error,raw)=>{
              clearTimeout(timer);
              if(error){reject(new Error(String(error)));return;}
              const entries=(Array.isArray(raw)?raw:Object.values(raw||{})).filter(x=>x&&typeof x.name==='string');
              resolve({count:entries.length,names:entries.map(x=>({name:x.name,instanceID:x.instanceID,type:x.type})).slice(0,1000)});
            });
          });
        },
        error:(...details)=>{clearTimeout(timer);reject(new Error('Sketchfab initialization failure: '+JSON.stringify(details).slice(0,600)))}
      });
    });
  });
  console.log('GT3_NODE_MAP',JSON.stringify(result));
}catch(error){console.error('PROBE_FAILED',error.message);process.exitCode=1;}finally{await browser.close()}
