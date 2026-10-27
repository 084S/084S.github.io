// ---------- 通用数学 ----------
const N=x=>{const t=1/(1+0.2316419*Math.abs(x)),p=t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));const v=1-Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*p;return x>=0?v:1-v};
const npdf=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
function bs(S,K,T,r,q,sig,type){ if(T<=0||sig<=0){const intr=type==='call'?Math.max(S-K,0):Math.max(K-S,0);return{price:intr,delta:type==='call'?(S>K?1:0):(S<K?-1:0),gamma:0,theta:0,vega:0,rho:0}}
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
const fmt=(v,d=2)=>v==null||isNaN(v)?'--':Number(v).toFixed(d);
function drawLine(canvas,series,opts={}){const ctx=canvas.getContext('2d');const W=canvas.width=canvas.clientWidth*2,H=canvas.height*2;ctx.clearRect(0,0,W,H);const all=series.flatMap(s=>s.data.map(p=>p.y));let mn=Math.min(...all),mx=Math.max(...all);if(opts.zero){mn=Math.min(mn,0);mx=Math.max(mx,0)}const pad=(mx-mn)*0.12||1;mn-=pad;mx+=pad;const xs=series[0].data.map(p=>p.x);const xmn=Math.min(...xs),xmx=Math.max(...xs);
 const X=x=>40+(x-xmn)/(xmx-xmn)*(W-60),Y=y=>H-30-(y-mn)/(mx-mn)*(H-50);
 ctx.strokeStyle='#e5e7eb';ctx.lineWidth=1;ctx.beginPath();if(mn<0&&mx>0){ctx.moveTo(0,Y(0));ctx.lineTo(W,Y(0))}ctx.stroke();
 ctx.fillStyle='#64748b';ctx.font='20px sans-serif';ctx.fillText(fmt(mx,1),4,24);ctx.fillText(fmt(mn,1),4,H-8);
 series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.setLineDash(s.dash||[]);ctx.beginPath();s.data.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));ctx.stroke();ctx.setLineDash([])});
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
 drawLine(document.getElementById('vixChart'),[{color:'#f97316',data:DATA.vix.map(p=>({x:new Date(p.d).getTime(),y:p.c}))}]);
 const spy=(DATA.iv30||{}).SPY||[];if(spy.length)drawLine(document.getElementById('ivChart'),[{color:'#0284c7',data:spy.map(p=>({x:new Date(p.d).getTime(),y:p.v}))}]);
 const sel=document.getElementById('reportSelect');sel.innerHTML=DATA.reports.map((r,i)=>`<option value="${i}">${r.date}</option>`).join('');sel.onchange=()=>{curReport=+sel.value;showReport()};showReport();}
function showReport(){if(DATA&&DATA.reports[curReport])document.getElementById('reportContent').innerHTML=DATA.reports[curReport].html}
loadData();

// ---------- Payoff ----------
let legs=[];
const PRESETS={longCall:()=>[{type:'call',dir:1,strike:100,premium:3,qty:1}],longPut:()=>[{type:'put',dir:1,strike:100,premium:3,qty:1}],bullCall:()=>[{type:'call',dir:1,strike:95,premium:4,qty:1},{type:'call',dir:-1,strike:105,premium:1.5,qty:1}],bearPut:()=>[{type:'put',dir:1,strike:105,premium:4,qty:1},{type:'put',dir:-1,strike:95,premium:1.5,qty:1}],straddle:()=>[{type:'call',dir:1,strike:100,premium:3,qty:1},{type:'put',dir:1,strike:100,premium:3,qty:1}],strangle:()=>[{type:'call',dir:1,strike:105,premium:1.8,qty:1},{type:'put',dir:1,strike:95,premium:1.8,qty:1}],ironCondor:()=>[{type:'put',dir:1,strike:85,premium:0.5,qty:1},{type:'put',dir:-1,strike:95,premium:1.8,qty:1},{type:'call',dir:-1,strike:105,premium:1.8,qty:1},{type:'call',dir:1,strike:115,premium:0.5,qty:1}],coveredCall:()=>[{type:'stock',dir:1,strike:100,premium:100,qty:1},{type:'call',dir:-1,strike:105,premium:2,qty:1}]};
function expiryPayoff(leg,S){if(leg.type==='stock')return leg.dir*leg.qty*(S-leg.premium);const intr=leg.type==='call'?Math.max(S-leg.strike,0):Math.max(leg.strike-S,0);return leg.dir*leg.qty*(intr-leg.premium)}
function theoPayoff(leg,S,T,r,iv){if(leg.type==='stock')return leg.dir*leg.qty*(S-leg.premium);const p=bs(S,leg.strike,Math.max(T,0.0001),r,0,iv,leg.type).price;return leg.dir*leg.qty*(p-leg.premium)}
function renderLegs(){const box=document.getElementById('legs');box.innerHTML='';legs.forEach((l,i)=>{const d=document.createElement('div');d.className='leg';d.innerHTML=`<div class="leg-row"><select data-k="dir"><option value="1" ${l.dir>0?'selected':''}>买入 Long</option><option value="-1" ${l.dir<0?'selected':''}>卖出 Short</option></select><select data-k="type"><option value="call" ${l.type==='call'?'selected':''}>Call</option><option value="put" ${l.type==='put'?'selected':''}>Put</option><option value="stock" ${l.type==='stock'?'selected':''}>股票</option></select><button class="del">✕</button></div><div class="leg-row" style="margin-top:8px"><span>${l.type==='stock'?'买入价':'行权价'}</span><input type="range" min="10" max="1000" step="1" value="${l.strike}" data-k="strikeR"><input type="number" value="${l.strike}" data-k="strike"></div><div class="leg-row" style="margin-top:6px"><span>${l.type==='stock'?'—':'权利金'}</span>${l.type!=='stock'?`<input type="range" min="0" max="50" step="0.1" value="${l.premium}" data-k="premR"><input type="number" value="${l.premium}" step="0.1" data-k="premium">`:'<span class="hint">股票腿按买入价计成本</span>'}<span>数量</span><input type="number" value="${l.qty}" min="1" max="100" data-k="qty" style="width:60px"></div>`;
 d.querySelectorAll('select,input').forEach(el=>el.oninput=()=>{const k=el.dataset.k;if(k==='dir')l.dir=+el.value;else if(k==='type'){l.type=el.value;renderLegs()}else if(k==='strike'||k==='strikeR')l.strike=+el.value;else if(k==='premium'||k==='premR')l.premium=+el.value;else if(k==='qty')l.qty=+el.value||1;renderLegsSoft(d,l);drawPayoff()});
 d.querySelector('.del').onclick=()=>{legs.splice(i,1);renderLegs();drawPayoff()};box.appendChild(d)})}
function renderLegsSoft(){/* slider/number sync handled by full light re-render on type change only */}
document.getElementById('addLeg').onclick=()=>{legs.push({type:'call',dir:1,strike:100,premium:3,qty:1});renderLegs();drawPayoff()};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{legs=PRESETS[b.dataset.preset]();renderLegs();drawPayoff()});
const spotR=document.getElementById('spotRange'),spotI=document.getElementById('spotInput');
[spotR,spotI].forEach(el=>el.oninput=()=>{spotR.value=spotI.value=el.value;document.getElementById('spotVal').textContent=' = '+el.value;drawPayoff()});
['payoffDays','payoffIv','payoffRate'].forEach(id=>document.getElementById(id).oninput=drawPayoff);
let payoffGeom=null;
function drawPayoff(){if(!legs.length)return;const S0=+spotI.value,T=+document.getElementById('payoffDays').value/365,iv=+document.getElementById('payoffIv').value/100,r=+document.getElementById('payoffRate').value/100;const lo=Math.max(1,S0*0.4),hi=S0*1.6,pts=[];for(let i=0;i<=120;i++){const S=lo+(hi-lo)*i/120;pts.push({S,exp:legs.reduce((a,l)=>a+expiryPayoff(l,S),0),th:legs.reduce((a,l)=>a+theoPayoff(l,S,T,r,iv),0)})}
 const c=document.getElementById('payoffChart');payoffGeom=drawLine(c,[{color:'#0f172a',data:pts.map(p=>({x:p.S,y:p.exp}))},{color:'#38bdf8',dash:[8,6],data:pts.map(p=>({x:p.S,y:p.th}))}],{zero:true});
 const ctx=c.getContext('2d');ctx.strokeStyle='#94a3b8';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(payoffGeom.X(S0),0);ctx.lineTo(payoffGeom.X(S0),payoffGeom.H);ctx.stroke();ctx.setLineDash([]);
 const exps=pts.map(p=>p.exp),mx=Math.max(...exps),mn=Math.min(...exps);let bes=[];for(let i=1;i<pts.length;i++)if((pts[i-1].exp<0)!==(pts[i].exp<0)||pts[i].exp===0)bes.push(pts[i].S);
 document.getElementById('payoffStats').innerHTML=`<div class="stat">最大盈利<b class="${mx>=0?'pos':''}">${mx>9000?'∞':fmt(mx)}</b></div><div class="stat">最大亏损<b class="${mn<0?'neg':''}">${mn<-9000?'-∞':fmt(mn)}</b></div><div class="stat">盈亏平衡<b>${bes.length?bes.map(b=>fmt(b,1)).join(' / '):'无'}</b></div><div class="stat">现价处到期盈亏<b class="${expiryPayoffAll(S0)>=0?'pos':'neg'}">${fmt(expiryPayoffAll(S0))}</b></div>`}
function expiryPayoffAll(S){return legs.reduce((a,l)=>a+expiryPayoff(l,S),0)}
document.getElementById('payoffChart').addEventListener('mousemove',e=>{if(!payoffGeom)return;const rect=e.target.getBoundingClientRect();const x=(e.clientX-rect.left)*2;const S=payoffGeom.xmn+(x-40)/(payoffGeom.W-60)*(payoffGeom.xmx-payoffGeom.xmn);if(S<payoffGeom.xmn||S>payoffGeom.xmx)return;const T=+document.getElementById('payoffDays').value/365,iv=+document.getElementById('payoffIv').value/100,r=+document.getElementById('payoffRate').value/100;const ex=expiryPayoffAll(S),th=legs.reduce((a,l)=>a+theoPayoff(l,S,T,r,iv),0);document.getElementById('payoffHover').innerHTML=`标的价格 <b>${fmt(S,1)}</b> · 到期 P&amp;L <b style="color:${ex>=0?'#4ade80':'#f87171'}">${fmt(ex)}</b> · 当前理论 P&amp;L <b style="color:${th>=0?'#4ade80':'#f87171'}">${fmt(th)}</b>`});
legs=PRESETS.straddle();renderLegs();

// ---------- BS 计算器 ----------
function syncPair(r,n,label){const R=document.getElementById(r),Nn=document.getElementById(n);const f=()=>{R.value=Nn.value=R.value===document.activeElement?R.value:Nn.value;if(document.activeElement===R)Nn.value=R.value;else R.value=Nn.value;document.getElementById(label).textContent=' = '+Nn.value;calcBS()};R.oninput=f;Nn.oninput=f}
syncPair('bsS','bsSNum','bsSVal');syncPair('bsK','bsKNum','bsKVal');syncPair('bsDays','bsDaysNum','bsTVal');syncPair('bsVol','bsVolNum','bsVVal');
['bsType','bsR','bsQ'].forEach(id=>document.getElementById(id).oninput=calcBS);
function calcBS(){const S=+document.getElementById('bsSNum').value,K=+document.getElementById('bsKNum').value,T=+document.getElementById('bsDaysNum').value/365,r=+document.getElementById('bsR').value/100,q=+document.getElementById('bsQ').value/100,sig=+document.getElementById('bsVolNum').value/100,type=document.getElementById('bsType').value;const o=bs(S,K,T,r,q,sig,type);
 document.getElementById('bsPrice').textContent='$ '+fmt(o.price);
 document.getElementById('bsGreeks').innerHTML=[['Delta',fmt(o.delta,4)],['Gamma',fmt(o.gamma,4)],['Theta（每日）',fmt(o.theta,4)],['Vega（每1%波动）',fmt(o.vega,4)],['Rho（每1%利率）',fmt(o.rho,4)],['内在价值',fmt(type==='call'?Math.max(S-K,0):Math.max(K-S,0))],['时间价值',fmt(o.price-(type==='call'?Math.max(S-K,0):Math.max(K-S,0)))],['d1 / d2',fmt(o.d1,3)+' / '+fmt(o.d2,3)]].map(x=>`<tr><td>${x[0]}</td><td><b>${x[1]}</b></td></tr>`).join('');
 const pts=[];for(let i=0;i<=80;i++){const s=S*0.5+(S)*i/80;pts.push({x:s,y:bs(s,K,T,r,q,sig,type).price})}drawLine(document.getElementById('bsChart'),[{color:'#7c3aed',data:pts}]);}
document.getElementById('bsIvBtn').onclick=()=>{const S=+document.getElementById('bsSNum').value,K=+document.getElementById('bsKNum').value,T=+document.getElementById('bsDaysNum').value/365,r=+document.getElementById('bsR').value/100,q=+document.getElementById('bsQ').value/100,mkt=+document.getElementById('bsMkt').value,type=document.getElementById('bsType').value;const iv=impliedVol(S,K,T,r,q,mkt,type);document.getElementById('bsIvOut').textContent=iv?'反推隐含波动率 IV = '+(iv*100).toFixed(2)+'%（已填入 σ，可点 Greeks 查看）':'无法反推：市价超出理论范围（检查价格/参数）。';if(iv){document.getElementById('bsVolNum').value=document.getElementById('bsVol').value=(iv*100).toFixed(2);calcBS()}};
calcBS();
