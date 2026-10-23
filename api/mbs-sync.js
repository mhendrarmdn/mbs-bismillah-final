const BASE = 'https://mbs.top-boss.com';

function htmlDecode(s=''){
  return String(s)
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function attr(tag,name){
  const re=new RegExp("\\b"+name+"\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))","i");
  const m=String(tag).match(re);
  return m?htmlDecode(m[1]??m[2]??m[3]??''):null;
}
function getSetCookies(headers){
  if(typeof headers.getSetCookie==='function') return headers.getSetCookie();
  const v=headers.get('set-cookie');
  return v?[v]:[];
}
function mergeCookies(jar,setCookies){
  for(const line of setCookies||[]){
    const pair=String(line).split(';',1)[0];
    const eq=pair.indexOf('=');
    if(eq>0) jar.set(pair.slice(0,eq).trim(),pair.slice(eq+1).trim());
  }
}
function cookieHeader(jar){
  return [...jar.entries()].map(([k,v])=>k+'='+v).join('; ');
}
async function fetchJar(url,opts={},jar=new Map(),redirects=0){
  const headers=new Headers(opts.headers||{});
  const cookies=cookieHeader(jar);
  if(cookies) headers.set('cookie',cookies);
  const res=await fetch(url,{...opts,headers,redirect:'manual'});
  mergeCookies(jar,getSetCookies(res.headers));
  if([301,302,303,307,308].includes(res.status) && res.headers.get('location') && redirects<6){
    const next=new URL(res.headers.get('location'),url).toString();
    const method=(res.status===303 || ((res.status===301||res.status===302) && String(opts.method||'GET').toUpperCase()==='POST'))?'GET':(opts.method||'GET');
    return fetchJar(next,{method,headers:method==='GET'?{}:opts.headers,body:method==='GET'?undefined:opts.body},jar,redirects+1);
  }
  return res;
}
function parseLoginForm(html,loginUrl){
  const forms=[...String(html).matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
  const picked=forms.map(m=>({open:m[1],body:m[2]})).find(f=>/type\s*=\s*["']?password/i.test(f.body));
  if(!picked) return null;
  const action=attr(picked.open,'action')||loginUrl;
  const method=(attr(picked.open,'method')||'POST').toUpperCase();
  const fields={};
  const inputs=[...picked.body.matchAll(/<input\b[^>]*>/gi)].map(m=>m[0]);
  const hidden=[];
  let companyField=null,passwordField=null,submitField=null;
  for(const tag of inputs){
    const name=attr(tag,'name'); if(!name) continue;
    const type=(attr(tag,'type')||'text').toLowerCase();
    const value=attr(tag,'value')||'';
    if(type==='hidden'){ fields[name]=value; hidden.push(name); continue; }
    if(type==='password' && !passwordField) passwordField=name;
    if((type==='text'||type==='number'||type==='email') && !companyField) companyField=name;
    if((type==='submit'||type==='button') && !submitField && value) submitField={name,value};
  }
  const select=[...picked.body.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/gi)][0];
  let roleField=null,roleOptions=[];
  if(select){
    roleField=attr(select[0],'name');
    roleOptions=[...select[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(m=>({
      value:htmlDecode(attr(m[1],'value')||''),
      text:htmlDecode(m[2].replace(/<[^>]+>/g,'').trim())
    }));
  }
  return {action:new URL(action,loginUrl).toString(),method,fields,companyField,passwordField,roleField,roleOptions,submitField,hidden};
}

function parseJsLogin(html,loginUrl){
  const src=String(html||'');
  const leaf=v=>{
    if(!v) return null;
    const clean=String(v).replace(/^this\./,'').replace(/\[[^\]]+\]/g,'');
    const parts=clean.split('.').filter(Boolean);
    return parts[parts.length-1]||null;
  };
  const fieldOf=tag=>leaf(attr(tag,'name')||attr(tag,'v-model')||attr(tag,'model-value'));
  const inputs=[...src.matchAll(/<input\b[^>]*>/gi)].map(m=>m[0]);
  const passwordTag=inputs.find(t=>(attr(t,'type')||'').toLowerCase()==='password');
  const textTags=inputs.filter(t=>['text','number','email'].includes((attr(t,'type')||'text').toLowerCase()));
  const companyTag=textTags.find(t=>/company/i.test(String(attr(t,'placeholder')||'')+' '+String(fieldOf(t)||'')))||textTags[0]||null;
  const select=[...src.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/gi)][0]||null;
  let companyField=companyTag?fieldOf(companyTag):null;
  let passwordField=passwordTag?fieldOf(passwordTag):null;
  let roleField=select?fieldOf(select[0]):null;
  if(!companyField){
    if(/Company ID/i.test(src)) companyField='company_id';
    else if(/Company name/i.test(src)) companyField='company_name';
  }
  if(!passwordField && /Password/i.test(src)) passwordField='password';
  if(!roleField && /Login role/i.test(src)) roleField='role';

  const roleOptions=select?[...select[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(m=>({
    value:htmlDecode(attr(m[1],'value')||''),
    text:htmlDecode(m[2].replace(/<[^>]+>/g,'').trim())
  })):[];
  const patterns=[
    {kind:'axios.post',re:/axios\.post\s*\(\s*["']([^"']+)["']/i},
    {kind:'ajax',re:/\$\.ajax\s*\(\s*\{[\s\S]{0,1200}?url\s*:\s*["']([^"']+)["']/i},
    {kind:'fetch',re:/fetch\s*\(\s*["']([^"']+)["']/i}
  ];
  let action=null,detectedBy=null;
  for(const p of patterns){
    const m=src.match(p.re);
    if(m){
      try{
        const u=new URL(m[1],loginUrl);
        if(u.origin===new URL(BASE).origin){action=u.toString();detectedBy=p.kind;break;}
      }catch(_){}
    }
  }
  if(!action) return null;
  const csrf=src.match(/<meta\b[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ||src.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i)?.[1]
    ||null;
  return {mode:'js',action,method:'POST',fields:{},companyField,passwordField,roleField,roleOptions,submitField:null,csrf,detectedBy};
}
function loginDiagnostics(html,loginUrl){
  const src=String(html||'');
  const slim=tag=>({
    type:attr(tag,'type')||null,
    name:attr(tag,'name')||null,
    model:attr(tag,'v-model')||null,
    placeholder:attr(tag,'placeholder')||null
  });
  const inputs=[...src.matchAll(/<input\b[^>]*>/gi)].map(m=>slim(m[0])).slice(0,10);
  const selects=[...src.matchAll(/<select\b[^>]*>/gi)].map(m=>slim(m[0])).slice(0,6);
  const endpoints=[];
  for(const re of [/axios\.post\s*\(\s*["']([^"']+)["']/gi,/\$\.ajax\s*\(\s*\{[\s\S]{0,1200}?url\s*:\s*["']([^"']+)["']/gi,/fetch\s*\(\s*["']([^"']+)["']/gi]){
    for(const m of src.matchAll(re)){
      try{endpoints.push(new URL(m[1],loginUrl).toString());}catch(_){}
    }
  }
  return {
    htmlLength:src.length,
    title:(src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,'').trim(),
    inputs,selects,endpoints:[...new Set(endpoints)].slice(0,8)
  };
}

function resolveRole(form,wanted){
  const target=String(wanted||'').trim().toLowerCase();
  if(target){
    const hit=(form.roleOptions||[]).find(o=>String(o.value).toLowerCase()===target || String(o.text).toLowerCase()===target);
    return hit?hit.value:wanted;
  }
  const opts=(form.roleOptions||[]).filter(o=>o.value);
  if(opts.length===1) return opts[0].value;
  if(target && /^[a-z][a-z0-9_-]*$/i.test(target)) return target.toLowerCase();
  return null;
}
function rawAfter(text,marker,from=0){
  const pos=String(text||'').indexOf(marker,from); if(pos<0) return null;
  let i=pos+marker.length; while(/\s/.test(text[i]||'')) i++;
  const open=text[i],close=open==='['?']':open==='{'?'}':null; if(!close) return null;
  let depth=0,str=false,esc=false;
  for(let j=i;j<text.length;j++){
    const ch=text[j];
    if(str){
      if(esc) esc=false; else if(ch==='\\') esc=true; else if(ch==='"') str=false;
    }else{
      if(ch==='"') str=true;
      else if(ch===open) depth++;
      else if(ch===close){ depth--; if(depth===0){ try{return JSON.parse(text.slice(i,j+1));}catch(_){return null;} } }
    }
  }
  return null;
}
function findCompanyArray(text){
  let from=0;
  while(true){
    const p=String(text||'').indexOf('data:',from); if(p<0) return null;
    const v=rawAfter(text,'data:',p);
    if(Array.isArray(v)&&v.length&&v[0]&&'company_name' in v[0]&&'npv' in v[0]) return v;
    from=p+5;
  }
}
async function getPage(path,jar){
  const res=await fetchJar(new URL(path,BASE).toString(),{
    headers:{'accept':'text/html,application/xhtml+xml','cache-control':'no-cache','pragma':'no-cache','referer':BASE+'/index'}
  },jar);
  const text=await res.text();
  if(!res.ok) throw new Error('TopBoss page '+path+' returned HTTP '+res.status);
  if(/<input[^>]+type=["']?password/i.test(text) && !/href=["']\/logout/i.test(text)) throw new Error('TopBoss session is not authenticated while reading '+path);
  return text;
}

module.exports = async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  const loginUrl=process.env.MBS_LOGIN_URL || (process.env.MBS_ARENA?BASE+'/login/'+process.env.MBS_ARENA:null);
  const companyLogin=process.env.MBS_COMPANY_LOGIN || process.env.MBS_COMPANY_ID || process.env.MBS_COMPANY_NAME;
  const password=process.env.MBS_PASSWORD;
  const roleWanted=process.env.MBS_ROLE_VALUE || process.env.MBS_ROLE;
  const missing=[];
  if(!loginUrl) missing.push('MBS_LOGIN_URL or MBS_ARENA');
  if(!companyLogin) missing.push('MBS_COMPANY_LOGIN');
  if(!password) missing.push('MBS_PASSWORD');
  if(!roleWanted) missing.push('MBS_ROLE_VALUE');
  if(missing.length) return res.status(503).json({ok:false,error:'MBS_SYNC_NOT_CONFIGURED',missing});

  const jar=new Map();
  try{
    const loginPageRes=await fetchJar(loginUrl,{headers:{'accept':'text/html,application/xhtml+xml','cache-control':'no-cache','pragma':'no-cache'}},jar);
    const loginHtml=await loginPageRes.text();
    if(!loginPageRes.ok) throw new Error('Login page returned HTTP '+loginPageRes.status);
    const effectiveLoginUrl=loginPageRes.url||loginUrl;
    const form=parseLoginForm(loginHtml,effectiveLoginUrl)||parseJsLogin(loginHtml,effectiveLoginUrl);
    if(!form) return res.status(502).json({
      ok:false,
      error:'LOGIN_REQUEST_NOT_DETECTED',
      message:'TopBoss login page loaded, but the JavaScript login request could not be detected safely.',
      loginUrl:effectiveLoginUrl,
      diagnostics:loginDiagnostics(loginHtml,effectiveLoginUrl)
    });

    const companyField=process.env.MBS_COMPANY_FIELD || form.companyField;
    const passwordField=process.env.MBS_PASSWORD_FIELD || form.passwordField;
    const roleField=process.env.MBS_ROLE_FIELD || form.roleField;
    const roleValue=resolveRole(form,roleWanted);
    if(!companyField||!passwordField||!roleField||!roleValue){
      return res.status(502).json({
        ok:false,error:'LOGIN_FIELDS_NOT_DETECTED',
        detected:{companyField,passwordField,roleField,roleOptions:(form.roleOptions||[]).map(o=>({value:o.value,text:o.text}))}
      });
    }

    const params=new URLSearchParams(form.fields);
    params.set(companyField,companyLogin);
    params.set(passwordField,password);
    params.set(roleField,roleValue);
    if(form.submitField?.name) params.set(form.submitField.name,form.submitField.value);

    const loginAction=process.env.MBS_LOGIN_ACTION || form.action;
    const method=(process.env.MBS_LOGIN_METHOD || form.method || 'POST').toUpperCase();
    const loginOpts={
      method,
      headers:{
        'accept':'text/html,application/xhtml+xml',
        'content-type':'application/x-www-form-urlencoded',
        'origin':BASE,
        'referer':loginUrl,
        'cache-control':'no-cache',
        'pragma':'no-cache'
      }
    };
    if(method!=='GET') loginOpts.body=params.toString();
    const actionUrl=method==='GET'?loginAction+(loginAction.includes('?')?'&':'?')+params.toString():loginAction;
    await fetchJar(actionUrl,loginOpts,jar);

    const indexHtml=await getPage('/index',jar);
    if(!/href=["']\/logout/i.test(indexHtml) && !/Sign out/i.test(indexHtml)){
      return res.status(401).json({ok:false,error:'LOGIN_FAILED',message:'TopBoss did not return an authenticated dashboard.'});
    }

    const user=rawAfter(indexHtml,'user: ');
    const corePaths=['/decide/env','/analyse/operation','/report/finance','/bus/boom','/bus/sales'];
    const pages={};
    for(const path of corePaths) pages[path]=await getPage(path,jar);

    const operation=rawAfter(pages['/analyse/operation'],'sales_data: ');
    const finance=rawAfter(pages['/report/finance'],'data_list: ');
    const environment=rawAfter(pages['/decide/env'],'period_data: ');
    const economy=rawAfter(pages['/bus/boom'],'period_data: ');
    const salesPage=pages['/bus/sales'];
    const salesPeriods=rawAfter(salesPage,'period: ');
    const competitors={
      north:rawAfter(salesPage,'north_list: '),
      middle:rawAfter(salesPage,'middle_list: '),
      south:rawAfter(salesPage,'south_list: '),
      foreign:rawAfter(salesPage,'foreign_list: ')
    };

    let rank=null;
    const rounds=finance?Object.keys(finance).map(Number).filter(Number.isFinite):[];
    const latest=rounds.length?Math.max(...rounds):0;
    const totalRounds=Number(environment?.period||0);
    if(totalRounds>0 && latest>=totalRounds){
      try{ rank=findCompanyArray(await getPage('/decide/rank',jar)); }catch(_){}
    }

    return res.status(200).json({
      ok:true,
      data:{environment,economy,operation,finance,rank,competitors,salesPeriods,entryCount:corePaths.length},
      meta:{companyName:user?.company_name||null,role:user?.role||user?.company_role||null,arena:user?.arena||process.env.MBS_ARENA||null,round:user?.round??latest,gameName:user?.game_name||null}
    });
  }catch(err){
    return res.status(502).json({ok:false,error:'MBS_SYNC_FAILED',message:String(err?.message||err)});
  }
};
