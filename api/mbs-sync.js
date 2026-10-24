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
function splitSetCookieHeader(value=''){
  const raw=String(value||'');
  if(!raw) return [];
  return raw.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map(v=>v.trim()).filter(Boolean);
}
function getSetCookies(headers){
  if(typeof headers.getSetCookie==='function') return headers.getSetCookie();
  return splitSetCookieHeader(headers.get('set-cookie'));
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

  let rolePayloadField=null;
  const actionNeedle=new URL(action).pathname;
  const actionPos=src.indexOf(actionNeedle);
  const actionWindow=actionPos>=0?src.slice(Math.max(0,actionPos-3500),actionPos+5000):src;
  const rolePayloadPatterns=[
    /([A-Za-z_$][\w$]*)\s*:\s*(?:this|that|vm|app|login|form)\.area\b/i,
    /([A-Za-z_$][\w$]*)\s*:\s*(?:this|that|vm|app|login|form)\.role\b/i,
    /["']([^"']+)["']\s*:\s*(?:this|that|vm|app|login|form)\.area\b/i,
    /["']([^"']+)["']\s*:\s*(?:this|that|vm|app|login|form)\.role\b/i
  ];
  for(const re of rolePayloadPatterns){
    const m=actionWindow.match(re);
    if(m?.[1]){ rolePayloadField=m[1]; break; }
  }

  const csrf=src.match(/<meta\b[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ||src.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i)?.[1]
    ||null;
  return {mode:'js',action,method:'POST',fields:{},companyField,passwordField,roleField,rolePayloadField,roleOptions,submitField:null,csrf,detectedBy};
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

function resolveRoleCandidates(form,wanted,source=''){
  const raw=String(wanted||'').trim();
  const target=raw.toLowerCase();
  const opts=(form.roleOptions||[]).filter(o=>o.value||o.text);
  const out=[];
  const add=v=>{
    const s=String(v??'').trim();
    if(s && !out.includes(s)) out.push(s);
  };

  if(target){
    const hit=opts.find(o=>String(o.value).toLowerCase()===target || String(o.text).toLowerCase()===target);
    if(hit && !/\{\{.*\}\}/.test(String(hit.text||'')) && String(hit.value||'')!=='index') add(hit.value);
  }

  const escaped=raw.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
  if(escaped){
    const keyBefore=new RegExp('(?:^|[,{\\s])(?:["\\\']?)([A-Za-z0-9_-]+)(?:["\\\']?)\\s*:\\s*["\\\']'+escaped+'["\\\']','i');
    const keyAfter=new RegExp('["\\\']'+escaped+'["\\\']\\s*:\\s*["\\\']?([A-Za-z0-9_-]+)["\\\']?','i');
    const km=String(source||'').match(keyBefore)||String(source||'').match(keyAfter);
    if(km?.[1]) add(km[1]);
  }

  const roleOrder=['ceo','sales manager','planning manager','purchasing manager','production manager','financial manager','consultant'];
  const ordinal=roleOrder.indexOf(target);
  const dynamicIndex=opts.some(o=>String(o.value)==='index' || /\{\{\s*item\s*\}\}/i.test(String(o.text||'')));
  if(dynamicIndex && ordinal>=0){
    add(String(ordinal+1));
    add(String(ordinal));
  }

  if(raw) add(raw);
  const staticValues=opts.map(o=>String(o.value||'').trim()).filter(v=>v && v!=='index' && !/^\{\{.*\}\}$/.test(v));
  if(staticValues.length===1) add(staticValues[0]);
  return out;
}
function safeLoginResponse(text,headers,secrets=[]){
  const redact=value=>{
    let out=String(value??'');
    for(const secret of secrets){
      const s=String(secret??'');
      if(s) out=out.split(s).join('[redacted]');
    }
    return out.replace(/\s+/g,' ').trim().slice(0,240);
  };
  const out={contentType:headers?.get?.('content-type')||null};
  try{
    const json=JSON.parse(String(text||''));
    const summary={};
    for(const key of ['code','status','success','message','msg','error','redirect','redirect_url','url','location']){
      const value=json?.[key] ?? json?.data?.[key];
      if(['string','number','boolean'].includes(typeof value)) summary[key]=redact(value);
    }
    if(Object.keys(summary).length) out.json=summary;
    else out.jsonKeys=json&&typeof json==='object'?Object.keys(json).slice(0,12):[];
  }catch(_){
    const plain=redact(String(text||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));
    if(plain) out.preview=plain;
  }
  return out;
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
    const roleFieldCandidates=[];
    const addRoleField=v=>{
      const s=String(v||'').trim();
      if(s && !roleFieldCandidates.includes(s)) roleFieldCandidates.push(s);
    };
    addRoleField(process.env.MBS_ROLE_FIELD);
    addRoleField(form.rolePayloadField);
    addRoleField('role');
    addRoleField(form.roleField);
    addRoleField('area');
    const roleCandidates=resolveRoleCandidates(form,roleWanted,loginHtml);
    if(!companyField||!passwordField||!roleFieldCandidates.length||!roleCandidates.length){
      return res.status(502).json({
        ok:false,error:'LOGIN_FIELDS_NOT_DETECTED',
        detected:{companyField,passwordField,roleFieldCandidates,roleCandidates,roleOptions:(form.roleOptions||[]).map(o=>({value:o.value,text:o.text}))}
      });
    }

    const basePayload={...(form.fields||{})};
    basePayload[companyField]=companyLogin;
    basePayload[passwordField]=password;
    if(form.submitField?.name) basePayload[form.submitField.name]=form.submitField.value;
    if(form.csrf && !basePayload._token) basePayload._token=form.csrf;

    const loginAction=process.env.MBS_LOGIN_ACTION || form.action;
    const method=(process.env.MBS_LOGIN_METHOD || form.method || 'POST').toUpperCase();
    let indexHtml=null,lastLoginStatus=null,lastFormat=null,lastLoginResponse=null,lastCookieNames=[],lastRoleValue=null,lastRoleField=null,loginAttempts=[];

    async function tryLogin(format,roleField,roleValue){
      const payload={...basePayload,[roleField]:roleValue};
      lastRoleField=roleField;
      lastRoleValue=roleValue;
      const headers={
        'accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'origin':BASE,
        'referer':effectiveLoginUrl,
        'cache-control':'no-cache',
        'pragma':'no-cache',
        'x-requested-with':'XMLHttpRequest',
        'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36',
        'accept-language':'en-US,en;q=0.9'
      };
      if(form.csrf) headers['x-csrf-token']=form.csrf;
      const xsrf=jar.get('XSRF-TOKEN')||jar.get('XSRF_TOKEN');
      if(xsrf && !headers['x-xsrf-token']){
        try{ headers['x-xsrf-token']=decodeURIComponent(xsrf); }catch(_){ headers['x-xsrf-token']=xsrf; }
      }
      let actionUrl=loginAction,body;
      if(format==='json'){
        headers['content-type']='application/json';
        body=JSON.stringify(payload);
      }else{
        headers['content-type']='application/x-www-form-urlencoded';
        const params=new URLSearchParams(payload);
        body=params.toString();
        if(method==='GET'){
          actionUrl=loginAction+(loginAction.includes('?')?'&':'?')+body;
          body=undefined;
        }
      }

      const lr=await fetchJar(actionUrl,{method,headers,body:method==='GET'?undefined:body},jar);
      lastLoginStatus=lr.status; lastFormat=format;
      let loginText='';
      try{loginText=await lr.text();}catch(_){}
      lastLoginResponse=safeLoginResponse(loginText,lr.headers,[companyLogin,password]);
      lastCookieNames=[...jar.keys()].slice(0,12);

      const loginUser=rawAfter(loginText,'user: ');
      if(lr.ok && loginUser?.company_name){
        indexHtml=loginText;
        return true;
      }

      const probes=[];
      const addProbe=value=>{
        if(!value) return;
        try{
          const u=new URL(value,effectiveLoginUrl);
          if(u.origin===new URL(BASE).origin && !probes.includes(u.toString())) probes.push(u.toString());
        }catch(_){}
      };

      if(lr.url){
        try{
          const p=new URL(lr.url).pathname;
          if(/^\/(?:home|index)(?:\/|$)/i.test(p)) addProbe(lr.url);
        }catch(_){}
      }

      try{
        const json=JSON.parse(loginText);
        for(const key of ['redirect','redirect_url','url','location','next','home']){
          if(typeof json?.[key]==='string') addProbe(json[key]);
          if(typeof json?.data?.[key]==='string') addProbe(json.data[key]);
        }
      }catch(_){}

      if(process.env.MBS_HOME_URL) addProbe(process.env.MBS_HOME_URL);
      const arena=process.env.MBS_ARENA
        || String(new URL(effectiveLoginUrl).pathname.match(/^\/login\/([^/?#]+)/i)?.[1]||'').trim();
      if(arena) addProbe('/home/'+encodeURIComponent(arena));
      addProbe('/index');

      for(const probeUrl of probes){
        const probe=await fetchJar(probeUrl,{
          headers:{
            'accept':'text/html,application/xhtml+xml',
            'cache-control':'no-cache',
            'pragma':'no-cache',
            'referer':effectiveLoginUrl,
            'user-agent':headers['user-agent'],
            'accept-language':headers['accept-language']
          }
        },jar);
        const text=await probe.text();
        const user=rawAfter(text,'user: ');
        const loginLike=/<input[^>]+type=["']?password/i.test(text) && !/href=["']\/logout/i.test(text);
        const signedInMarker=/href=["']\/logout/i.test(text)||/Sign out/i.test(text);
        if(probe.ok && (user?.company_name || (!loginLike && signedInMarker))){
          indexHtml=text;
          return true;
        }
      }
      return false;
    }
    const formats=form.mode==='js'?['json','form']:['form','json'];
    let authenticated=false;
    for(const roleField of roleFieldCandidates){
      for(const roleValue of roleCandidates){
        for(const format of formats){
          try{
            const ok=await tryLogin(format,roleField,roleValue);
            loginAttempts.push({roleField,roleValue,format,status:lastLoginStatus,response:lastLoginResponse});
            if(ok){authenticated=true;break;}
          }catch(err){
            loginAttempts.push({roleField,roleValue,format,status:lastLoginStatus,error:String(err?.message||err)});
          }
        }
        if(authenticated) break;
      }
      if(authenticated) break;
    }
    if(!authenticated){
      return res.status(401).json({
        ok:false,
        error:'LOGIN_FAILED',
        message:'TopBoss login request was detected, but no authenticated session was created.',
        detected:{
          mode:form.mode||'form',
          detectedBy:form.detectedBy||null,
          action:loginAction,
          companyField,passwordField,roleField:lastRoleField,roleFieldCandidates,
          roleValue:lastRoleValue,roleCandidates,
          detectedRolePayloadField:form.rolePayloadField||null,
          lastLoginStatus,lastFormat,lastLoginResponse,lastCookieNames,
          loginAttempts:loginAttempts.slice(-12)
        },
        diagnostics:loginDiagnostics(loginHtml,effectiveLoginUrl)
      });
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
