/* ===== Agendamento (horários compartilhados via planilha; veja servidor/PASSO-A-PASSO.txt) ===== */
const WA="5511978698668";
const API=""; // cole aqui a URL do Apps Script (termina em /exec)
const SV=[["Corte",50,40],["Barba",40,30],["Corte + barba",80,70],["Acabamento",20,15]]; // nome, preço, minutos
const $=id=>document.getElementById(id);
const svc=$("svc"),sl=$("sl"),d=$("d"),pad=n=>String(n).padStart(2,"0");
SV.forEach(([n,p])=>svc.insertAdjacentHTML("beforeend",`<label class="opt"><input type="radio" name="s" value="${n}"><span>${n}<b>R$ ${p}</b></span></label>`));
const t0=new Date();d.min=`${t0.getFullYear()}-${pad(t0.getMonth()+1)}-${pad(t0.getDate())}`;
const dur=n=>SV.find(x=>x[0]===n)[2],hm=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`,LS="om_agenda";
const hit=(a,b,c,e)=>a<c+e&&c<a+b;
const store={
 async busy(date){
  if(API){const r=await fetch(`${API}?date=${date}`);return(await r.json()).busy||[]}
  return(JSON.parse(localStorage.getItem(LS)||"{}"))[date]||[];
 },
 async book(b){
  if(API){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(b)});return r.json()}
  const a=JSON.parse(localStorage.getItem(LS)||"{}"),l=a[b.date]||[];
  if(l.some(([s,u])=>hit(b.start,b.dur,s,u)))return{ok:false,error:"taken"};
  l.push([b.start,b.dur]);a[b.date]=l;localStorage.setItem(LS,JSON.stringify(a));return{ok:true};
 }
};
let seq=0;
async function slots(){
 const v=d.value,s=document.querySelector("input[name=s]:checked"),sm=$("sm"),me=++seq;
 sl.innerHTML="";$("dm").textContent="";
 if(!v){sm.textContent="Escolha um dia para ver os horários.";return}
 if(!s){sm.textContent="Escolha primeiro o serviço.";return}
 const [y,m,dd]=v.split("-").map(Number),dt=new Date(y,m-1,dd),w=dt.getDay();
 if(w===0||w===1){sm.textContent="Fechado neste dia. Escolha de terça a sábado.";return}
 sm.textContent="Verificando horários…";
 let busy;try{busy=await store.busy(v)}catch(e){if(me===seq)sm.textContent="Não consegui verificar os horários. Confira a internet e tente de novo.";return}
 if(me!==seq)return;
 const L=dur(s.value),end=(w===6?17:20)*60,now=new Date(),nm=now.getHours()*60+now.getMinutes(),same=dt.toDateString()===now.toDateString();
 let free=0,html="";
 for(let t=540;t+L<=end;t+=30){
  if(same&&t<=nm)continue;
  const off=busy.some(([bs,bu])=>hit(t,L,bs,bu));if(!off)free++;
  html+=`<label class="opt"><input type="radio" name="h" value="${hm(t)}"${off?" disabled":""}><span>${hm(t)}</span></label>`;
 }
 sl.innerHTML=html;
 sm.textContent=free?"Horários riscados já estão reservados.":"Sem horários livres neste dia. Escolha outro dia.";
}
d.addEventListener("change",slots);svc.addEventListener("change",slots);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&d.value)slots()});
document.querySelectorAll(".mini").forEach(b=>b.addEventListener("click",()=>{
 document.querySelector(`input[name=s][value="${b.dataset.s}"]`).checked=true;
 $("agendar").scrollIntoView();slots();
}));
$("f").addEventListener("submit",async e=>{
 e.preventDefault();
 const s=document.querySelector("input[name=s]:checked"),h=document.querySelector("input[name=h]:checked"),n=$("n").value.trim(),t=$("t").value.trim(),err=$("e"),ok=$("ok"),btn=e.submitter||document.querySelector("#f .btn");
 err.textContent="";ok.hidden=true;
 if(!s)return err.textContent="Escolha um serviço.";
 if(!d.value)return err.textContent="Escolha o dia do atendimento.";
 if(!h)return err.textContent="Escolha um horário.";
 if(n.length<2)return err.textContent="Informe seu nome.";
 if(t.replace(/\D/g,"").length<10)return err.textContent="Informe um telefone com DDD.";
 const [hh,mm]=h.value.split(":").map(Number);
 btn.disabled=true;btn.textContent="Reservando…";
 let r;try{r=await store.book({date:d.value,start:hh*60+mm,dur:dur(s.value),time:h.value,service:s.value,name:n,phone:t})}catch(x){r={ok:false,error:"net"}}
 btn.disabled=false;btn.textContent="Enviar pedido de agendamento";
 if(!r.ok){err.textContent=r.error==="taken"?"Esse horário acabou de ser reservado por outra pessoa. Escolha outro.":"Não foi possível reservar agora. Tente de novo em instantes.";return slots()}
 const [y,m,dd]=d.value.split("-"),data=`${dd}/${m}/${y}`;
 const txt=`Olá, Os Malas Studio! Quero agendar: ${s.value}, dia ${data} às ${h.value}. Nome: ${n}. Telefone: ${t}.`;
 const url=`https://wa.me/${WA}?text=${encodeURIComponent(txt)}`;
 ok.hidden=false;
 ok.innerHTML=`<strong>Horário reservado: ${s.value}, ${data} às ${h.value}.</strong><p class="msg">Confirme no WhatsApp para a barbearia receber seu pedido.</p><a class="btn" href="${url}" target="_blank" rel="noopener">Confirmar no WhatsApp</a>${API?"":'<p class="msg">Modo teste: a reserva só fica salva neste aparelho.</p>'}`;
 slots();window.open(url,"_blank","noopener");
});

/* ===== Vídeo de abertura: trava a rolagem, congela no último frame e desce sozinho ===== */
(()=>{
const root=document.documentElement,hero=document.querySelector(".hero"),v=document.getElementById("v"),prog=document.getElementById("prog"),skip=document.getElementById("skip"),start=document.getElementById("start");
let finished=false;
if("scrollRestoration" in history)history.scrollRestoration="manual";
scrollTo(0,0);
root.classList.add("locked");
const locked=()=>root.classList.contains("locked");
["wheel","touchmove"].forEach(n=>addEventListener(n,e=>{if(locked())e.preventDefault()},{passive:false}));
addEventListener("keydown",e=>{if(locked()&&[" ","ArrowDown","ArrowUp","PageDown","PageUp","End","Home"].includes(e.key))e.preventDefault()});
function finish(){
 if(finished)return;finished=true;
 hero.classList.add("done");prog.style.transform="scaleX(1)";
 try{v.pause()}catch(e){}
 setTimeout(()=>{
  root.classList.remove("locked");
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("cortes").scrollIntoView({behavior:reduce?"auto":"smooth"});
 },1400);
}
v.addEventListener("timeupdate",()=>{if(v.duration&&!finished)prog.style.transform="scaleX("+(v.currentTime/v.duration)+")"});
v.addEventListener("ended",finish);
v.addEventListener("playing",()=>{start.hidden=true});
v.addEventListener("error",()=>{finished=true;root.classList.remove("locked");hero.classList.add("done")});
skip.addEventListener("click",()=>{if(v.duration)v.currentTime=Math.max(0,v.duration-.05);finish()});
start.addEventListener("click",()=>{v.play()});
v.play().catch(()=>{start.hidden=false});
})();

/* ===== Cortes: arrastar para os lados controla o tempo do vídeo ===== */
(()=>{
const CUTS=["Afro com fade","Degradê preciso","Crop com fade","Tranças com desenho","Cornrows com fade","Platinado","Grisalho ondulado","Topete com risca"];
const $=id=>document.getElementById(id),st=$("scrub"),v=$("cv"),bar=$("bar"),hint=$("hint"),cn=$("cn"),th=$("th");
let cur=0,target=0,pos=0,vel=0,drag=false,lastX=0,lastT=0,touched=false;
const clamp=x=>Math.min(1,Math.max(0,x));
CUTS.forEach((n,i)=>th.insertAdjacentHTML("beforeend",`<button type="button" aria-label="${n}"><img src="img/cortes/corte-${i+1}.jpg" alt="" loading="lazy"></button>`));
function load(i){
 cur=(i+CUTS.length)%CUTS.length;target=pos=vel=0;
 v.poster=`img/cortes/corte-${cur+1}-poster.jpg`;v.src=`video/cortes/corte-${cur+1}.mp4`;
 cn.textContent=CUTS[cur];
 [...th.children].forEach((b,k)=>b.setAttribute("aria-current",k===cur));
 const b=th.children[cur];th.scrollTo({left:b.offsetLeft-(th.clientWidth-b.offsetWidth)/2,behavior:"smooth"});
}
function tick(){
 if(!drag&&Math.abs(vel)>.0002){target=clamp(target+vel);vel*=.93;if(target<=0||target>=1)vel=0}
 pos+=(target-pos)*.35;if(Math.abs(target-pos)<.0004)pos=target;
 const t=pos*(v.duration||0);
 if(v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-t)>.01)v.currentTime=t;
 bar.style.transform=`scaleX(${pos})`;st.setAttribute("aria-valuenow",Math.round(pos*100));
 requestAnimationFrame(tick);
}
st.addEventListener("pointerdown",e=>{
 if(e.pointerType==="mouse"&&e.button)return;
 drag=true;vel=0;lastX=e.clientX;lastT=performance.now();st.setPointerCapture(e.pointerId);st.classList.add("on");
 if(!touched){touched=true;hint.classList.add("off");v.play().then(()=>v.pause()).catch(()=>{})}
});
st.addEventListener("pointermove",e=>{
 if(!drag)return;
 const f=(e.clientX-lastX)/(st.clientWidth*.85),n=performance.now();lastX=e.clientX;
 target=clamp(target+f);vel=.7*vel+.3*(f/Math.max(1,n-lastT)*16);lastT=n;
});
const end=()=>{if(!drag)return;drag=false;st.classList.remove("on");if(performance.now()-lastT>80)vel=0};
["pointerup","pointercancel","lostpointercapture"].forEach(n=>st.addEventListener(n,end));
st.addEventListener("wheel",e=>{
 if(Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;
 e.preventDefault();touched=true;hint.classList.add("off");target=clamp(target-e.deltaX/(st.clientWidth*1.2));
},{passive:false});
st.addEventListener("keydown",e=>{
 const k={ArrowRight:.05,ArrowLeft:-.05}[e.key];
 if(k!==undefined){e.preventDefault();touched=true;hint.classList.add("off");target=clamp(target+k)}
});
$("prev").addEventListener("click",()=>load(cur-1));
$("next").addEventListener("click",()=>load(cur+1));
[...th.children].forEach((b,i)=>b.addEventListener("click",()=>load(i)));
function nudge(){
 if(touched||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const s=performance.now();
 (function f(n){const k=(n-s)/1600;if(touched||drag)return;if(k>=1){target=0;return}target=.22*Math.sin(Math.PI*k);requestAnimationFrame(f)})(s);
}
load(0);tick();
if("IntersectionObserver"in window){
 new IntersectionObserver((en,o)=>{if(en[0].isIntersecting){v.preload="auto";v.load();o.disconnect()}},{rootMargin:"700px"}).observe(st);
 new IntersectionObserver((en,o)=>{if(en[0].isIntersecting){o.disconnect();v.readyState>=2?nudge():v.addEventListener("loadeddata",nudge,{once:true})}},{threshold:.6}).observe(st);
}else{v.preload="auto";v.load()}
})();

/* ===== Menu fixo: fundo ao rolar e link da seção atual ===== */
(()=>{
const hd=document.querySelector("header");
const solid=()=>hd.classList.toggle("solid",scrollY>60);addEventListener("scroll",solid,{passive:true});solid();
const links=[...document.querySelectorAll(".links a")];
if("IntersectionObserver"in window){
 const so=new IntersectionObserver(en=>en.forEach(x=>{if(x.isIntersecting)links.forEach(a=>a.setAttribute("aria-current",a.getAttribute("href")==="#"+x.target.id))}),{rootMargin:"-45% 0px -50% 0px"});
 links.forEach(a=>{const s=document.querySelector(a.getAttribute("href"));if(s)so.observe(s)});
}
})();

/* ===== Jacaré entra andando na seção Serviços =====
   Chrome, Edge e Firefox: video/croc.webm (WebM com transparência de verdade, sem nenhum truque de script).
   Safari e iPhone não leem transparência em WebM; lá usamos video/croc.mp4, que guarda a cor (metade de cima)
   e a transparência (metade de baixo), e juntamos as duas num canvas. */
(()=>{
const stage=document.getElementById("croc"),cv=document.getElementById("crocc"),mp4=document.getElementById("crocv"),wm=document.getElementById("crocw");
if(!stage||!cv||!mp4)return;
const M={w:782,h:600,fx0:245,fx1:713};            // tamanho do recorte e onde o jacaré para (em px do vídeo)
const ua=navigator.userAgent;
const noAlpha=/iP(hone|ad|od)/.test(ua)||(/^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua));
const useWebm=!!wm&&!noAlpha&&!!wm.canPlayType&&wm.canPlayType('video/webm; codecs="vp9"')!=="";
const vid=useWebm?wm:mp4;
if(!useWebm&&wm)wm.remove();
cv.width=M.w;cv.height=M.h;
const ctx=cv.getContext("2d");
const off=document.createElement("canvas");off.width=M.w;off.height=M.h*2;
const octx=off.getContext("2d",{willReadFrequently:true});
const out=ctx.createImageData(M.w,M.h);
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
let started=false;
if(useWebm)cv.style.display="none";

/* posiciona o jacaré: começa colado na borda esquerda da tela (ele "entra" por ali) e para na coluna do título */
function layout(){
 const sh=stage.clientHeight,s=sh/M.h,r=stage.getBoundingClientRect();
 const crocW=(M.fx1-M.fx0)*s,fx0=M.fx0*s;
 const want=r.left+(stage.clientWidth-crocW)/2;     // onde queremos o jacaré parado (x na tela)
 const left=Math.min(0,want-fx0);                   // o vídeo nunca começa depois da borda da tela
 for(const el of [cv,useWebm?wm:null]){if(!el)continue;el.style.width=M.w*s+"px";el.style.height=sh+"px";el.style.left=(left-r.left)+"px"}
 stage.style.setProperty("--gx",(left-r.left+fx0+crocW/2)+"px");
 stage.style.setProperty("--gw",crocW*1.05+"px");
}
layout();addEventListener("resize",layout);addEventListener("load",layout);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(layout);

function arrive(){stage.classList.add("arrived")}
function still(){                                    // sem animação: mostra só o jacaré já parado
 const im=new Image();
 im.onload=()=>{if(wm)wm.style.display="none";cv.style.display="";ctx.clearRect(0,0,M.w,M.h);ctx.drawImage(im,0,0,M.w,M.h);arrive()};
 im.src="img/croc-final.webp";
}
function draw(){
 octx.drawImage(vid,0,0,M.w,M.h*2);
 const d=octx.getImageData(0,0,M.w,M.h*2).data,o=out.data,n=M.w*M.h*4;
 for(let i=0;i<n;i+=4){o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=d[n+i]}
 ctx.putImageData(out,0,0);
}
const next=cb=>"requestVideoFrameCallback"in vid?vid.requestVideoFrameCallback(cb):requestAnimationFrame(cb);
function tick(){
 try{
  if(vid.readyState>=2)draw();
  if(vid.ended){draw();arrive();return}
 }catch(e){still();return}                           // navegador bloqueou a leitura dos pixels: mostra a pose final
 next(tick);
}
function go(){
 if(started)return;started=true;
 if(reduce){still();return}
 vid.preload="auto";
 vid.addEventListener("ended",()=>{if(!useWebm){try{draw()}catch(e){still();return}}arrive()},{once:true});
 vid.addEventListener("error",still,{once:true});
 const p=vid.play();
 if(useWebm){if(p&&p.catch)p.catch(still);return}   // se o navegador bloquear o autoplay, mostra a pose final
 if(p&&p.then)p.then(()=>next(tick),still);else next(tick);
}
if("IntersectionObserver"in window){
 new IntersectionObserver((en,o)=>{if(en[0].isIntersecting){vid.preload="auto";vid.load();o.disconnect()}},{rootMargin:"800px"}).observe(stage);
 new IntersectionObserver((en,o)=>{if(en[0].isIntersecting){o.disconnect();go()}},{threshold:.6}).observe(stage);
}else go();
})();
