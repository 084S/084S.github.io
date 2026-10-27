// ---------- 通用数学 ----------
const N=x=>{const t=1/(1+0.2316419*Math.abs(x)),p=t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));const v=1-Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*p;return x>=0?v:1-v};
const npdf=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
function bs(S,K,T,r,q,sig,type){ if(T<=0||sig<=0){const intr=type==='call'?Math.max(S-K,0):Math.max(K-S,0);return{price:intr,delta:type==='call'?(S>K?1:0):(S<K?-1:0),gamma:0,theta:0,vega:0,rho:0,d1:0,d2:0}}
 const d1=(Math.log(S/K)+(r-q+sig*sig/2)*T)/(sig*Math.sqrt(T)),d2=d1-sig*Math.sqrt(T);
 const price=type==='call'?S*Math.exp(-q*T)*N(d1)-K*Math.exp(-r*T)*N(d2):K*Math.exp(-r*T)*N(-d2)-S*Math.exp(-q*T)*N(-d1);
 const delta=type==='call'?Math.exp(-q*T)*N(d1):Math.exp(-q*T)*(N(d1)-1);
 const gamma=Math.exp(-q*T)*npdf(d1)/(S*sig*Math.sqrt(T));
 const theta1=-(S*Math.exp(-q*T)*npdf(d1)*sig)/(2*Math.sqrt(T));
 const theta=type==='call'?(theta1-r*K*Math.exp(-r*T)*N(d2)+q*S*Math.exp(-q*T)*N(d1))/365:(theta1+r*K*Math.exp(-r*T)*N(-d2)-q*S*Math.exp(-q*T)*N(-d1))/365;
 const vega=S*Math.exp(-q*T)*npdf(d1)*Math.sqrt(T)/100;
 const rho=(type==='call'?K*T*Math.exp(-r*T)*N(d2):-K*T*Math.exp(-r*T)*N(-d2))/100;
 return{price,delta,gamma,theta,vega,rho,d1,d2}}
function impliedVol(S,K,T,r,q,mkt,type){let lo=0.001,hi=3;if(bs(S,K,T,r,q,hi,type).price<mkt||bs(S,K,T,r,q,lo,type).price>mkt)return null;for(let i=0;i<100;i++){const m=(lo+hi)/2;bs(S,K,T,r,q,m,type).price>mkt?hi=m:lo=m}return(lo+hi)/2}
const fmt=(v,d=2)=>v==null||isNaN(v)||!isFinite(v)?'--':Number(v).toFixed(d);
// 画布尺寸：基准高度只记录一次，避免每次重绘翻倍（v1 的显示异常就是这里）
function setupCanvas(canvas){if(!canvas.dataset.h)canvas.dataset.h=canvas.clientHeight||180;const w=canvas.clientWidth||600,h=+canvas.dataset.h;canvas.width=w*2;canvas.height=h*2;canvas.style.width='100%';canvas.style.height=h+'px';const ctx=canvas.getContext('2d');return{ctx,W:canvas.width,H:canvas.height}}
function drawLine(canvas,series,opts={}){const{ctx,W,H}=setupCanvas(canvas);ctx.clearRect(0,0,W,H);const all=series.flatMap(s=>s.data.map(p=>p.y));let mn=Math.min(...all),mx=Math.max(...all);if(opts.zero){mn=Math.min(mn,0);mx=Math.max(mx,0)}const pad=(mx-mn)*0.12||1;mn-=pad;mx+=pad;const xs=series[0].data.map(p=>p.x);const xmn=Math.min(...xs),xmx=Math.max(...xs);
 const L=56,R=16,Tp=16,B=34;const X=x=>L+(x-xmn)/(xmx-xmn)*(W-L-R),Y=y=>Tp+(mx-y)/(mx-mn)*(H-Tp-B);
 ctx.lineWidth=1;ctx.font='19px sans-serif';ctx.fillStyle='#94a3b8';
 for(let i=0;i<=4;i++){const yv=mn+(mx-mn)*i/4,y=Y(yv);ctx.strokeStyle='#eef2f7';ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(W-R,y);ctx.stroke();ctx.fillText(fmt(yv,Math.abs(mx-mn)<10?2:0),6,y+6)}
 for(let i=0;i<=4;i++){const xv=xmn+(xmx-xmn)*i/4,x=X(xv);ctx.fillText(opts.time?new Date(xv).toISOString().slice(5,10):fmt(xv,0),x-18,H-8)}
 if(mn<0&&mx>0){ctx.strokeStyle='#cbd5e1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,Y(0));ctx.lineTo(W-R,Y(0));ctx.stroke()}
 series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=3.5;ctx.setLineDash(s.dash||[]);ctx.beginPath();s.data.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));ctx.stroke();ctx.setLineDash([])});
 return{X,Y,W,H,mn,mx,xmn,xmx}}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.panel').forEach(e=>e.classList.remove('active'));b.classList.add('active');document.getElementById('tab-'+b.dataset.tab).classList.add('active');if(b.dataset.tab==='payoff')drawPayoff();if(b.dataset.tab==='bs')calcBS();});

// ---------- 日报 / VIX ----------
let DATA=null,curReport=0;
async function loadData(){try{DATA=await(await fetch('data.json?t='+Date.now())).json()}catch(e){document.getElementById('reportContent').textContent='日报数据加载失败，请稍后再试。';return}
 document.getElementById('updatedAt').textContent='更新于 '+DATA.updated_at;
 const v=DATA.vix_latest;const badge=document.getElementById('vixBadge');badge.textContent='VIX '+fmt(v);badge.style.color=v>=30?'#f87171':v>=20?'#fbbf24':'#4ade80';
 document.getElementById('vixBig').textContent=fmt(v);
 const lvl=v<15?['🟢 平静','市场情绪平稳，卖方环境相对友好']:v<20?['🟡 正常','波动处于常态区间']:v<30?['🟠 焦虑','避险需求升温，注意仓位与对冲']:v<40?['🔴 恐慌','恐慌模式：减仓、价差结构优先']:['🔴🔴 极端恐慌','极端行情，保本金优先'];
 document.getElementById('vixLevel').textContent=lvl[0]+' — '+lvl[1];
 document.getElementById('gaugeFill').style.left=Math.min(98,Math.max(1,v/50*100))+'%';
 drawLine(document.getElementById('vixChart'),[{color:'#f97316',data:DATA.vix.map(p=>({x:new Date(p.d).getTime(),y:p.c}))}],{time:true});
 const spy=(DATA.iv30||{}).SPY||[];if(spy.length)drawLine(document.getElementById('ivChart'),[{color:'#0284c7',data:spy.map(p=>({x:new Date(p.d).getTime(),y:p.v}))}],{time:true});
 const sel=document.getElementById('reportSelect');sel.innerHTML=DATA.reports.map((r,i)=>`<option value="${i}">${r.date}</option>`).join('');sel.onchange=()=>{curReport=+sel.value;showReport()};showReport();}
function showReport(){if(DATA&&DATA.reports[curReport])document.getElementById('reportContent').innerHTML=DATA.reports[curReport].html}
loadData();

// ---------- Payoff ----------
let legs=[];
const L=(type,dir,strike,premium,qty=1)=>({type,dir,strike,premium,qty});
const PRESETS={
 longCall:()=> [L('call',1,100,3)],
 shortCall:()=>[L('call',-1,100,3)],
 longPut:()=>  [L('put',1,100,3)],
 shortPut:()=> [L('put',-1,100,3)],
 bullCall:()=> [L('call',1,95,4.2),L('call',-1,105,1.6)],
 bearCall:()=> [L('call',-1,95,4.2),L('call',1,105,1.6)],
 bullPut:()=>  [L('put',-1,105,4.2),L('put',1,95,1.6)],
 bearPut:()=>  [L('put',1,105,4.2),L('put',-1,95,1.6)],
 longStraddle:()=> [L('call',1,100,3),L('put',1,100,3)],
 shortStraddle:()=>[L('call',-1,100,3),L('put',-1,100,3)],
 longStrangle:()=> [L('call',1,105,1.8),L('put',1,95,1.8)],
 shortStrangle:()=>[L('call',-1,105,1.8),L('put',-1,95,1.8)],
 callFly:()=> [L('call',1,90,7),L('call',-1,100,3,2),L('call',1,110,1)],
 putFly:()=>  [L('put',1,110,7),L('put',-1,100,3,2),L('put',1,90,1)],
 ironFly:()=> [L('call',-1,100,3),L('put',-1,100,3),L('call',1,110,1),L('put',1,90,1)],
 ironCondor:()=>[L('put',1,85,0.5),L('put',-1,95,1.8),L('call',-1,105,1.8),L('call',1,115,0.5)],
 coveredCall:()=>[L('stock',1,100,0),L('call',-1,105,2)],
 protectivePut:()=>[L('stock',1,100,0),L('put',1,95,1.8)],
 collar:()=> [L('stock',1,100,0),L('put',1,95,1.8),L('call',-1,105,2)],
};
function expiryPayoff(leg,S){if(leg.type==='stock')return leg.dir*leg.qty*(S-leg.strike);const intr=leg.type==='call'?Math.max(S-leg.strike,0):Math.max(leg.strike-S,0);return leg.dir*leg.qty*(intr-leg.premium)}
function theoPayoff(leg,S,T,r,iv){if(leg.type==='stock')return leg.dir*leg.qty*(S-leg.strike);const p=bs(S,leg.strike,Math.max(T,0.0001),r,0,iv,leg.type).price;return leg.dir*leg.qty*(p-leg.premium)}
function expiryPayoffAll(S){return legs.reduce((a,l)=>a+expiryPayoff(l,S),0)}
function renderLegs(){const box=document.getElementById('legs');box.innerHTML='';legs.forEach((l,i)=>{const d=document.createElement('div');d.className='leg';
 const isStock=l.type==='stock';
 d.innerHTML=`<div class="leg-row"><select data-k="dir"><option value="1" ${l.dir>0?'selected':''}>买入 Long</option><option value="-1" ${l.dir<0?'selected':''}>卖出 Short</option></select><select data-k="type"><option value="call" ${l.type==='call'?'selected':''}>Call</option><option value="put" ${l.type==='put'?'selected':''}>Put</option><option value="stock" ${l.type==='stock'?'selected':''}>股票</option></select><span class="muted">腿 ${i+1}</span><button class="del">✕</button></div>
 <div class="leg-row" style="margin-top:8px"><span>${isStock?'买入价':'行权价'}</span><input type="range" min="10" max="1000" step="1" value="${l.strike}" data-k="strikeR"><input type="number" value="${l.strike}" data-k="strikeN"></div>
 ${isStock?'<div class="leg-row" style="margin-top:6px"><span class="hint">股票腿按买入价计成本</span><span>数量</span><input type="number" value="'+l.qty+'" min="1" max="100" data-k="qty" style="width:60px"></div>':`<div class="leg-row" style="margin-top:6px"><span>权利金</span><input type="range" min="0" max="50" step="0.1" value="${l.premium}" data-k="premR"><input type="number" value="${l.premium}" step="0.1" data-k="premN"><span>数量</span><input type="number" value="${l.qty}" min="1" max="100" data-k="qty" style="width:60px"></div>`}`;
 const sync=(a,b)=>{const A=d.querySelector(`[data-k="${a}"]`),B=d.querySelector(`[data-k="${b}"]`);if(A&&B){A.oninput=()=>{B.value=A.value;A.dispatchEvent(new Event('legchange'))};B.oninput=()=>{A.value=B.value;B.dispatchEvent(new Event('legchange'))}}};
 sync('strikeR','strikeN');sync('premR','premN');
 d.querySelectorAll('select,input').forEach(el=>{const upd=()=>{const k=el.dataset.k;if(k==='dir')l.dir=+el.value;else if(k==='type'){l.type=el.value;renderLegs();drawPayoff();return}else if(k==='strikeR'||k==='strikeN')l.strike=+el.value||0;else if(k==='premR'||k==='premN')l.premium=+el.value||0;else if(k==='qty')l.qty=+el.value||1;drawPayoff()};el.addEventListener('input',upd);el.addEventListener('legchange',upd)});
 d.querySelector('.del').onclick=()=>{legs.splice(i,1);renderLegs();drawPayoff()};box.appendChild(d)})}
document.getElementById('addLeg').onclick=()=>{legs.push(L('call',1,100,3));renderLegs();drawPayoff()};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{legs=PRESETS[b.dataset.preset]();renderLegs();drawPayoff()});
const spotR=document.getElementById('spotRange'),spotI=document.getElementById('spotInput');
spotR.oninput=()=>{spotI.value=spotR.value;drawPayoff()};spotI.oninput=()=>{spotR.value=spotI.value;drawPayoff()};
['payoffDays','payoffIv','payoffRate'].forEach(id=>document.getElementById(id).oninput=drawPayoff);
let payoffGeom=null;
function drawPayoff(){if(!legs.length){document.getElementById('payoffStats').innerHTML='';return}const S0=+spotI.value||100,T=+document.getElementById('payoffDays').value/365,iv=+document.getElementById('payoffIv').value/100,r=+document.getElementById('payoffRate').value/100;const lo=Math.max(1,S0*0.35),hi=S0*1.65,pts=[];for(let i=0;i<=160;i++){const S=lo+(hi-lo)*i/160;pts.push({S,exp:expiryPayoffAll(S),th:legs.reduce((a,l)=>a+theoPayoff(l,S,T,r,iv),0)})}
 const c=document.getElementById('payoffChart');payoffGeom=drawLine(c,[{color:'#0f172a',data:pts.map(p=>({x:p.S,y:p.exp}))},{color:'#0284c7',dash:[9,7],data:pts.map(p=>({x:p.S,y:p.th}))}],{zero:true});
 const ctx=c.getContext('2d');ctx.strokeStyle='#94a3b8';ctx.lineWidth=2;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(payoffGeom.X(S0),0);ctx.lineTo(payoffGeom.X(S0),payoffGeom.H);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#475569';ctx.font='19px sans-serif';ctx.fillText('现价 '+fmt(S0,0),Math.min(payoffGeom.X(S0)+8,payoffGeom.W-110),26);
 const exps=pts.map(p=>p.exp);let mx=Math.max(...exps),mn=Math.min(...exps);
 const slopeR=exps[exps.length-1]-exps[exps.length-3],slopeL=exps[2]-exps[0];
 const mxTxt=slopeR>0.001&&exps[exps.length-1]===mx?'无上限 ↑':fmt(mx);const mnTxt=slopeL>0.001&&exps[0]===mn?'无下限 ↓':(slopeR< -0.001&&exps[exps.length-1]===mn?'无下限 ↓':fmt(mn));
 let bes=[];for(let i=1;i<pts.length;i++){if((pts[i-1].exp<0&&pts[i].exp>=0)||(pts[i-1].exp>0&&pts[i].exp<=0)){const a=pts[i-1],b=pts[i];bes.push(a.S+(b.S-a.S)*(0-a.exp)/(b.exp-a.exp))}}
 const at=expiryPayoffAll(S0);
 document.getElementById('payoffStats').innerHTML=`<div class="stat">最大盈利<b class="pos">${mxTxt}</b></div><div class="stat">最大亏损<b class="neg">${mnTxt}</b></div><div class="stat">盈亏平衡点<b>${bes.length?[...new Set(bes.map(b=>fmt(b,1)))].join(' / '):'无'}</b></div><div class="stat">现价处到期盈亏<b class="${at>=0?'pos':'neg'}">${fmt(at)}</b></div>`}
document.getElementById('payoffChart').addEventListener('mousemove',e=>{if(!payoffGeom)return;const rect=e.target.getBoundingClientRect();const px=(e.clientX-rect.left)*(e.target.width/rect.width);const S=payoffGeom.xmn+(px-56)/(payoffGeom.W-56-16)*(payoffGeom.xmx-payoffGeom.xmn);if(S<payoffGeom.xmn||S>payoffGeom.xmx)return;const T=+document.getElementById('payoffDays').value/365,iv=+document.getElementById('payoffIv').value/100,r=+document.getElementById('payoffRate').value/100;const ex=expiryPayoffAll(S),th=legs.reduce((a,l)=>a+theoPayoff(l,S,T,r,iv),0);document.getElementById('payoffHover').innerHTML=`标的价格 <b>${fmt(S,1)}</b> · 到期 P&amp;L <b style="color:${ex>=0?'#4ade80':'#f87171'}">${fmt(ex)}</b> · 当前理论 P&amp;L <b style="color:${th>=0?'#4ade80':'#f87171'}">${fmt(th)}</b>`});
legs=PRESETS.longStraddle();renderLegs();

// ---------- BS 计算器 ----------
function syncPair(r,n,label){const R=document.getElementById(r),Nn=document.getElementById(n);R.oninput=()=>{Nn.value=R.value;document.getElementById(label).textContent=' = '+R.value;calcBS()};Nn.oninput=()=>{R.value=Nn.value;document.getElementById(label).textContent=' = '+Nn.value;calcBS()}}
syncPair('bsS','bsSNum','bsSVal');syncPair('bsK','bsKNum','bsKVal');syncPair('bsDays','bsDaysNum','bsTVal');syncPair('bsVol','bsVolNum','bsVVal');
['bsType','bsR','bsQ'].forEach(id=>document.getElementById(id).oninput=calcBS);
function calcBS(){const S=+document.getElementById('bsSNum').value,K=+document.getElementById('bsKNum').value,T=+document.getElementById('bsDaysNum').value/365,r=+document.getElementById('bsR').value/100,q=+document.getElementById('bsQ').value/100,sig=+document.getElementById('bsVolNum').value/100,type=document.getElementById('bsType').value;const o=bs(S,K,T,r,q,sig,type);
 document.getElementById('bsPrice').textContent='$ '+fmt(o.price);
 document.getElementById('bsGreeks').innerHTML=[['Delta',fmt(o.delta,4)],['Gamma',fmt(o.gamma,4)],['Theta（每日）',fmt(o.theta,4)],['Vega（每1%波动）',fmt(o.vega,4)],['Rho（每1%利率）',fmt(o.rho,4)],['内在价值',fmt(type==='call'?Math.max(S-K,0):Math.max(K-S,0))],['时间价值',fmt(o.price-(type==='call'?Math.max(S-K,0):Math.max(K-S,0)))],['d1 / d2',fmt(o.d1,3)+' / '+fmt(o.d2,3)]].map(x=>`<tr><td>${x[0]}</td><td><b>${x[1]}</b></td></tr>`).join('');
 const pts=[];for(let i=0;i<=80;i++){const s=S*0.5+S*i/80;pts.push({x:s,y:bs(s,K,T,r,q,sig,type).price})}drawLine(document.getElementById('bsChart'),[{color:'#7c3aed',data:pts}]);}
document.getElementById('bsIvBtn').onclick=()=>{const S=+document.getElementById('bsSNum').value,K=+document.getElementById('bsKNum').value,T=+document.getElementById('bsDaysNum').value/365,r=+document.getElementById('bsR').value/100,q=+document.getElementById('bsQ').value/100,mkt=+document.getElementById('bsMkt').value,type=document.getElementById('bsType').value;const iv=impliedVol(S,K,T,r,q,mkt,type);document.getElementById('bsIvOut').textContent=iv?'反推隐含波动率 IV = '+(iv*100).toFixed(2)+'%（已填入 σ）':'无法反推：市价超出理论范围（检查价格/参数）。';if(iv){document.getElementById('bsVolNum').value=document.getElementById('bsVol').value=(iv*100).toFixed(2);calcBS()}};
calcBS();
