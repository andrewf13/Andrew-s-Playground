// The Long Fall — film timeline, camera direction, renderer and controls.
(()=>{
'use strict';
const S=LongFallSim();
const $=id=>document.getElementById(id);
const small=Math.min(innerWidth,innerHeight)<700||(navigator.deviceMemory&&navigator.deviceMemory<4);
const SUN_PHI=2.09, DUR=290;
const TAB=S.centres();
const EV=S.events(TAB), PERI=EV.list.filter(e=>e.type==='peri');
const P1=PERI[0].T, P2=PERI[1].T;
const P=S.particles(small?0.5:1,SUN_PHI), N=P.N;
const pos=new Float32Array(N*3);
const C=new Float64Array(12);

// ---------------------------------------------------------------- film data
const CHAPTERS=[[0,'I','You are here'],[48,'II','The night sky'],[92,'III','First contact'],[128,'IV','Tidal tails'],[158,'V','Collision'],[192,'VI','Milkomeda'],[226,'VII','Perspective'],[262,'VIII','Postscript']];
const CAPTIONS=[
 [5,6.5,'','Everything you have ever known — every person, every ocean, every sunrise — circles one ordinary star.'],
 [12,5.5,'THE MILKY WAY','It is one of 100 to 400 billion stars in our galaxy, a disk of light 100,000 light-years across.'],
 [18,5.8,'','Once every 230 million years the Sun carries us around the centre. Last time we were here, the first dinosaurs were appearing.'],
 [24.5,6,'ANDROMEDA · M31','2.5 million light-years away lies our nearest large neighbour, Andromeda. Around a trillion stars.'],
 [31,6.2,'','The light from it you can see tonight set out around the time the first humans appeared.'],
 [38,7.5,'COLLISION COURSE','And it is falling toward us at about 110 kilometres a second — 400,000 km/h.'],
 [52.5,6,'TODAY','From a dark site, Andromeda is a faint smudge six full Moons wide.'],
 [59,6.5,'+1 BILLION YEARS','The Sun has grown about 10% brighter. Earth’s oceans are beginning to boil away.'],
 [67,6.5,'+2 BILLION YEARS','Andromeda looms larger in the sky with every passing age.'],
 [75,6.5,'','Gravity — and the invisible dark matter that cocoons both galaxies — draws them ever faster together.'],
 [83,7,'+3.8 BILLION YEARS','Andromeda dominates the sky. Its pull is already warping our galaxy.'],
 [96.5,6.5,'FIRST PASS','Four billion years from now, the galaxies swing past each other at more than 500 kilometres a second.'],
 [104,7.2,'WHY STARS SURVIVE','Stars almost never collide. If the Sun were a grain of sand, the nearest star would be another grain 14 kilometres away.'],
 [112,7,'','But gravity tears at both disks, pulling out long streams of stars.'],
 [120,7,'','The galaxies slow, turn, and begin to fall back together.'],
 [132.5,7,'','Tidal tails hundreds of thousands of light-years long arc out into intergalactic space.'],
 [140,7.2,'STARBURST','Clouds of gas do collide. Squeezed and shocked, they ignite a firestorm of newborn stars.'],
 [148,8,'','Our Sun — the marked star — is caught in the turmoil and carried onto a new orbit.'],
 [162.5,6.5,'4.5 BILLION YEARS FROM NOW','The two hearts fall into each other.'],
 [175,7,'','Deep in the core, the two supermassive black holes begin to spiral together, destined to merge.'],
 [183,7.5,'','Any world left to watch would see a night sky ablaze with young stars.'],
 [196.5,7,'','The spirals are gone. Over the next two billion years the debris settles into one giant elliptical galaxy.'],
 [204,6,'MILKOMEDA','Astronomers already have a name for it.'],
 [211,7,'THE SUN','In this simulation our Sun survives — flung out toward the far edge of the new galaxy.'],
 [218.5,7,'','By then the Sun itself is ageing, beginning to swell toward a red giant.'],
 [230.5,6,'','Step back, and Milkomeda becomes a single point of light…'],
 [237,7,'','…one of hundreds of billions of galaxies in the observable universe.'],
 [244.5,7,'','Each with its own collisions. Its own stars. Perhaps its own watchers.'],
 [252,8.5,'','We are a very small part of something unimaginably vast — and the part that gets to wonder about it.']
];
const TKEYS=[[0,0],[48,0],[53,40],[59,950],[67,2000],[75,2900],[83,3480],[89,3760],[92,3850],[110,P1],[128,4160],[146,4330],[158,4410],[170,P2],[180,4590],[192,4740],[205,5250],[226,6400],[262,6990],[290,6995]];
const FADE=[[0,1],[3.5,0],[46.4,0],[47.7,1],[48.5,1],[50.5,0],[90.4,0],[91.6,1],[92.3,1],[94.2,0],[258,0],[263,0.74],[285.5,0.74],[290,1]];
const EXPO=[[0,1.05],[46,1.1],[48,1.5],[90,1.35],[92,1],[166,1.1],[170,2.4],[172.5,1.25],[190,1.05],[290,1]];

// ---------------------------------------------------------------- maths
const clamp=(x,a,b)=>x<a?a:x>b?b:x, mix=(a,b,u)=>a+(b-a)*u;
const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const ease=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const keys=(k,f)=>{if(f<=k[0][0])return k[0][1];for(let i=1;i<k.length;i++)if(f<=k[i][0]){const a=k[i-1],b=k[i];return mix(a[1],b[1],(f-a[0])/(b[0]-a[0]));}return k[k.length-1][1];};
const V={add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 lerp:(a,b,u)=>[mix(a[0],b[0],u),mix(a[1],b[1],u),mix(a[2],b[2],u)],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(a[0],a[1],a[2]),
 norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},
 rot:(v,k,t)=>{const c=Math.cos(t),s=Math.sin(t),d=V.dot(k,v)*(1-c),x=V.cross(k,v);return [v[0]*c+x[0]*s+k[0]*d,v[1]*c+x[1]*s+k[1]*d,v[2]*c+x[2]*s+k[2]*d];}};
// Monotone cubic (Fritsch–Carlson) for film time -> story time
const timeOf=(()=>{const x=TKEYS.map(k=>k[0]),y=TKEYS.map(k=>k[1]),n=x.length,d=[],m=new Array(n);
 for(let i=0;i<n-1;i++)d.push((y[i+1]-y[i])/(x[i+1]-x[i]));
 m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
 for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],h=a*a+b*b;if(h>9){const t=3/Math.sqrt(h);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}
 return f=>{if(f<=x[0])return y[0];if(f>=x[n-1])return y[n-1];let i=0;while(f>x[i+1])i++;const h=x[i+1]-x[i],t=(f-x[i])/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*y[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*y[i+1]+(t3-t2)*h*m[i+1];};})();

// ---------------------------------------------------------------- simulation manager
const SIM={cps:[],cur:null,done:false,bg:null};
{const p0=new Float64Array(N*3),v0=new Float64Array(N*3);S.analytic(P,TAB,S.T_NUM,p0,v0);
 SIM.cps[0]={pos:new Float32Array(p0),vel:new Float32Array(v0)};
 const TOTAL=Math.floor((S.NSTEP-1-S.I_NUM)/S.CP_STEPS);SIM.total=TOTAL;
 let worker=null;
 try{
  const src=LongFallSim.toString()+';('+function(){const S=LongFallSim(),tab=S.centres();onmessage=e=>{const pos=e.data.pos,vel=e.data.vel,n=e.data.n;let i=S.I_NUM,k=0;
   while(k<e.data.total){i=S.step(pos,vel,n,tab,i,S.CP_STEPS);k++;const a=new Float32Array(pos),b=new Float32Array(vel);postMessage({k,pos:a,vel:b},[a.buffer,b.buffer]);}};}.toString()+')();';
  worker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
  worker.onmessage=e=>{SIM.cps[e.data.k]={pos:e.data.pos,vel:e.data.vel};if(e.data.k>=TOTAL)SIM.done=true;};
  worker.onerror=()=>{worker=null;startBackground();};
  worker.postMessage({pos:p0,vel:v0,n:N,total:TOTAL});
 }catch(err){startBackground();}
 function startBackground(){if(SIM.bg)return;const k=SIM.cps.length-1;SIM.bg={k,i:S.I_NUM+k*S.CP_STEPS,pos:Float64Array.from(SIM.cps[k].pos),vel:Float64Array.from(SIM.cps[k].vel)};}
}
function backgroundWork(budget){ // used only if workers are unavailable
 const b=SIM.bg;if(!b||SIM.done)return;const t0=performance.now();
 while(performance.now()-t0<budget){const target=S.I_NUM+(b.k+1)*S.CP_STEPS;b.i=S.step(b.pos,b.vel,N,TAB,b.i,Math.min(4,target-b.i));
  if(b.i===target){b.k++;SIM.cps[b.k]={pos:new Float32Array(b.pos),vel:new Float32Array(b.vel)};if(b.k>=SIM.total){SIM.done=true;break;}}}
}
function latestCp(){let k=SIM.cps.length-1;while(k>0&&!SIM.cps[k])k--;return k;}
// Fill `pos` for story time T. Returns false while the simulation is still catching up.
function stateAt(T){
 if(T<S.T_NUM){S.analytic(P,TAB,T,pos);return true;}
 const it=Math.min(Math.floor(T/S.DT),S.NSTEP-1);
 let k=Math.min(Math.floor((it-S.I_NUM)/S.CP_STEPS),SIM.total);while(k>0&&!SIM.cps[k])k--;
 const cpI=S.I_NUM+k*S.CP_STEPS;let cur=SIM.cur;
 if(!cur||cur.i>it||cur.i<cpI){cur=SIM.cur={i:cpI,pos:Float64Array.from(SIM.cps[k].pos),vel:Float64Array.from(SIM.cps[k].vel)};}
 const t0=performance.now();
 while(cur.i<it&&performance.now()-t0<14)cur.i=S.step(cur.pos,cur.vel,N,TAB,cur.i,Math.min(3,it-cur.i));
 const dt=cur.i===it?T-cur.i*S.DT:0,p=cur.pos,v=cur.vel;
 for(let j=0;j<N*3;j++)pos[j]=p[j]+v[j]*dt;
 return cur.i===it;
}

// ---------------------------------------------------------------- camera direction
const W={e1:[1,0,0],e2:[0,0,1],n:[0,1,0]}, MW=S.GAL[0];
function orbit(t,yaw,pitch,dist,b=W){const cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 const dir=V.add(V.add(V.mul(b.e1,cp*cy),V.mul(b.e2,cp*sy)),V.mul(b.n,sp)),up=V.add(V.add(V.mul(b.e1,-sp*cy),V.mul(b.e2,-sp*sy)),V.mul(b.n,cp));
 return {pos:V.add(t,V.mul(dir,dist)),target:t,up};}
const lg=(a,b,u)=>Math.exp(mix(Math.log(a),Math.log(b),u));
const SHOTS=[
 {a:0,b:22,fn:(f,x)=>{const p=ss(0,22,f);const c=orbit(V.lerp(x.sun,x.c0,ss(3,19,f)),SUN_PHI+0.15+0.55*p,mix(1.2,0.92,p),lg(16,62,ease(ss(1,21,f))),MW);return {...c,fov:50,near:mix(2.2,2.5,p)};}},
 {a:22,b:48,blend:3,fn:(f,x)=>{const p=ease(ss(22,46,f));const mid=V.lerp(x.c0,x.c1,0.5);
  const d0=orbit([0,0,0],SUN_PHI+0.7,0.92,1,MW),d1=V.norm([-0.66,0.24,-0.71]);
  const dir=V.norm(V.lerp(d0.pos,d1,p)),up=V.norm(V.lerp(d0.up,[0,1,0],p)),t=V.lerp(x.c0,V.lerp(x.c0,x.c1,0.55),ss(0.25,1,p));
  return {pos:V.add(x.c0,V.mul(dir,lg(62,250,p))),target:t,up,fov:50,near:3};}},
 {a:48,b:92,look:true,fn:(f,x)=>{const fwd0=V.norm(V.sub(x.c1,x.sun));let up=MW.n;up=V.norm(V.sub(up,V.mul(fwd0,V.dot(up,fwd0))));up=V.rot(up,fwd0,0.55);
  const right=V.norm(V.cross(fwd0,up)),fwd=V.rot(fwd0,right,-0.16-0.06*ss(70,92,f)),up2=V.rot(up,right,-0.16-0.06*ss(70,92,f));
  return {pos:x.sun,target:V.add(x.sun,fwd),up:up2,fov:mix(62,50,ss(70,92,f)),near:1.6,sky:1};}},
 {a:92,b:128,fn:f=>{const p=ss(92,128,f);return {...orbit([0,0,0],mix(-1.72,-1.15,p),mix(0.2,0.34,p),mix(185,118,ease(p))),fov:50,near:3};}},
 {a:128,b:158,blend:5,fn:f=>{const p=ss(128,158,f);return {...orbit([0,0,0],mix(-1.15,-0.55,p),mix(0.34,0.95,ease(p)),mix(118,235,ease(p))),fov:50,near:3};}},
 {a:158,b:192,blend:4,fn:f=>{const d=keys([[158,235],[167,95],[170,62],[176,70],[192,112]],f),y=keys([[158,-0.55],[166,-0.25],[172,0.35],[192,0.75]],f);
  const c=orbit([0,0,0],y,keys([[158,0.95],[170,0.32],[192,0.5]],f),d);const k=Math.max(0,1-Math.abs(f-170.4)/2.2)*1.6;
  if(k>0)c.pos=V.add(c.pos,[Math.sin(f*61)*k,Math.sin(f*47+1)*k,Math.sin(f*53+2)*k]);return {...c,fov:mix(50,56,ss(166,171,f)-ss(172,180,f)),near:2};}},
 {a:192,b:226,blend:5,fn:f=>{const p=ss(192,226,f);return {...orbit([0,0,0],mix(0.75,1.5,p),mix(0.5,0.38,p),mix(112,150,p)),fov:50,near:2};}},
 {a:226,b:DUR+1,blend:3,fn:f=>{const p=ss(226,290,f),z=ss(229,259,f);return {...orbit([0,0,0],mix(1.5,2.05,p),mix(0.38,0.7,p),lg(150,7e5,z*z*(3-2*z)*0.5+z*z*0.5)),fov:50,near:2};}}
];
const user={yaw:0,pitch:0,zoom:0,last:-1e9,free:false};
function camera(f){
 const sun=[pos[0],pos[1],pos[2]],c0=[C[0],C[1],C[2]],c1=[C[3],C[4],C[5]],x={sun,c0,c1};
 let i=SHOTS.findIndex(s=>f>=s.a&&f<s.b);if(i<0)i=f<0?0:SHOTS.length-1;
 const s=SHOTS[i];let c=s.fn(f,x);
 if(s.blend&&i>0&&f<s.a+s.blend){const prev=SHOTS[i-1].fn(Math.min(f,SHOTS[i-1].b),x),u=ss(0,1,(f-s.a)/s.blend);
  c={pos:V.lerp(prev.pos,c.pos,u),target:V.lerp(prev.target,c.target,u),up:V.norm(V.lerp(prev.up,c.up,u)),fov:mix(prev.fov,c.fov,u),near:mix(prev.near,c.near,u),sky:c.sky};}
 // viewer's own orbit / look offsets
 if(user.yaw||user.pitch||user.zoom){
  let fwd=V.sub(c.target,c.pos);const up=V.norm(c.up);
  if(s.look){fwd=V.rot(fwd,up,user.yaw);const r=V.norm(V.cross(fwd,up));fwd=V.rot(fwd,r,user.pitch);c.target=V.add(c.pos,fwd);c.fov=clamp(c.fov*Math.exp(user.zoom*0.5),20,100);}
  else{let off=V.mul(fwd,-1);off=V.rot(off,up,user.yaw);const r=V.norm(V.cross(off,up));off=V.rot(off,r,user.pitch);c.up=V.rot(up,r,user.pitch);c.pos=V.add(c.target,V.mul(off,Math.exp(user.zoom)));}
 }
 return c;
}

// ---------------------------------------------------------------- matrices
function perspective(fov,asp,n,f){const t=1/Math.tan(fov*Math.PI/360),nf=1/(n-f);return [t/asp,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0];}
function lookAt(e,c,u){const z=V.norm(V.sub(e,c)),x=V.norm(V.cross(u,z)),y=V.cross(z,x);return {m:[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,e),-V.dot(y,e),-V.dot(z,e),1],x,y,z};}
function mul4(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}

// ---------------------------------------------------------------- decor: background stars and the distant galaxy field
const R=(()=>{let s=9031;return ()=>{s=(s*16807)%2147483647;return s/2147483647;};})();
const gauss=()=>Math.sqrt(-2*Math.log(R()+1e-9))*Math.cos(6.2831853*R());
const BG=(()=>{const n=small?2600:5200,a=new Float32Array(n*8);for(let i=0;i<n;i++){const d=V.norm([gauss(),gauss(),gauss()]),m=Math.pow(R(),5),t=R();
 a.set([d[0],d[1],d[2],mix(1,0.7,t),mix(0.85,0.85,t),mix(0.72,1,t),0.12+m*1.6,1+m*1.8],i*8);}return {n,a};})();
const FIELD=(()=>{const nodes=[];for(let i=0;i<70;i++){const r=lg(2e4,9e5,R()),d=V.norm([gauss(),gauss(),gauss()]);nodes.push(V.mul(d,r));}
 const n=small?3500:7000,a=new Float32Array(n*10);
 for(let i=0;i<n;i++){let p;const A=nodes[Math.floor(R()*nodes.length)];
  if(R()<0.3)p=V.add(A,[gauss()*6e3,gauss()*6e3,gauss()*6e3]);else{let B=nodes[0],bd=1e30;for(const q of nodes){const d=V.len(V.sub(q,A));if(q!==A&&d<bd*(0.6+R()*0.8)){bd=d;B=q;}}p=V.add(V.lerp(A,B,R()),[gauss()*1.4e4,gauss()*1.4e4,gauss()*1.4e4]);}
  if(V.len(p)<4000){i--;continue;}
  const ell=R()<0.35,sz=8+Math.pow(R(),3)*40,c=ell?[1,0.78,0.55]:[0.72,0.82,1];
  a.set([p[0],p[1],p[2],c[0],c[1],c[2],0.6+R()*0.8,sz,R()*3.1416,ell?0.55+R()*0.4:0.15+R()*0.6],i*10);}
 return {n,a};})();

// ---------------------------------------------------------------- renderers
const canvas=$('view');
let GLR=null;try{GLR=makeGL(canvas);}catch(e){console.warn('WebGL unavailable, using canvas renderer',e);GLR=null;}
const R2=GLR?null:makeCanvas2D(canvas);
function makeGL(cv){
 let gl=cv.getContext('webgl2',{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'}),gl2=!!gl;
 if(!gl)gl=cv.getContext('webgl',{antialias:false,alpha:false,premultipliedAlpha:false})||cv.getContext('experimental-webgl');
 if(!gl)throw new Error('no webgl');
 let fType=gl.UNSIGNED_BYTE,fInt=gl.RGBA,linear=true;
 if(gl2&&gl.getExtension('EXT_color_buffer_float')){fType=gl.HALF_FLOAT;fInt=gl.RGBA16F;}
 else if(!gl2){const h=gl.getExtension('OES_texture_half_float');gl.getExtension('EXT_color_buffer_half_float');if(h){fType=h.HALF_FLOAT_OES;linear=!!gl.getExtension('OES_texture_half_float_linear');}}
 const maxPt=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
 function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
 function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,'precision mediump float;\n'+fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={},a={};
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);}
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i++){const n=gl.getActiveAttrib(p,i).name;a[n]=gl.getAttribLocation(p,n);}return {p,u,a};}
 const PT=prog(`precision highp float;
attribute vec3 aPos;attribute vec4 aCol;attribute float aSize;attribute float aSeed;
uniform mat4 uVP;uniform vec3 uCam;uniform float uScale,uSizeMul,uAlpha,uMinPx,uMaxPx,uNear,uBurst,uTime,uAge;
varying vec3 vCol;
void main(){vec4 p=uVP*vec4(aPos,1.0);gl_Position=p;float d=max(distance(aPos,uCam),1e-3);
 float px=aSize*uSizeMul*uScale/d;float a=aCol.a*uAlpha*smoothstep(uNear*0.3,uNear,d);
 if(px<uMinPx){a*=px*px/(uMinPx*uMinPx);px=uMinPx;}if(px>uMaxPx){a*=uMaxPx/px;px=uMaxPx;}
 a*=1.0+uBurst*(0.55+0.45*sin(uTime*1.9+aSeed*60.0));
 vec3 c=mix(aCol.rgb,vec3(1.0,0.8,0.6)*dot(aCol.rgb,vec3(0.33)),uAge);
 gl_PointSize=p.w>0.0?px:0.0;vCol=c*a;}`,
 `varying vec3 vCol;uniform float uSoft;
void main(){vec2 c=gl_PointCoord*2.0-1.0;float r=dot(c,c);if(r>1.0)discard;float f=mix(exp(-r*10.0)+0.12*exp(-r*2.5),exp(-r*3.2)*(1.0-r),uSoft);gl_FragColor=vec4(vCol*f,1.0);}`);
 const BGP=prog(`precision highp float;attribute vec3 aDir;attribute vec4 aCol;attribute float aSize;uniform mat4 uVP;uniform vec3 uCam;uniform float uAlpha,uPx;varying vec3 vCol;
void main(){vec4 p=uVP*vec4(uCam+aDir*1.0e6,1.0);gl_Position=p;gl_PointSize=aSize*uPx;vCol=aCol.rgb*aCol.a*uAlpha;}`,
 `varying vec3 vCol;void main(){vec2 c=gl_PointCoord*2.0-1.0;float r=dot(c,c);if(r>1.0)discard;gl_FragColor=vec4(vCol*exp(-r*5.0),1.0);}`);
 const FG=prog(`precision highp float;attribute vec3 aPos;attribute vec4 aCol;attribute vec3 aShape;uniform mat4 uVP;uniform vec3 uCam;uniform float uScale,uAlpha,uMaxPx;
varying vec3 vCol;varying vec2 vShape;
void main(){vec4 p=uVP*vec4(aPos,1.0);gl_Position=p;float d=distance(aPos,uCam);float px=aShape.x*uScale/d;float a=aCol.a*uAlpha*2.2*clamp(px/2.0,0.55,1.0);
 px=clamp(px*2.5,2.2,uMaxPx);gl_PointSize=p.w>0.0?px:0.0;vCol=aCol.rgb*a;vShape=aShape.yz;}`,
 `varying vec3 vCol;varying vec2 vShape;void main(){vec2 c=gl_PointCoord*2.0-1.0;float s=sin(vShape.x),k=cos(vShape.x);vec2 q=vec2(k*c.x-s*c.y,(s*c.x+k*c.y)/vShape.y);float r=dot(q,q);if(r>1.0)discard;
 gl_FragColor=vec4(vCol*(exp(-r*6.0)+0.6*exp(-r*40.0)),1.0);}`);
 const QD=prog(`precision highp float;attribute vec2 aC;uniform vec3 uCtr,uRight,uUp;uniform float uRad;uniform mat4 uVP;varying vec2 vC;
void main(){vC=aC;gl_Position=uVP*vec4(uCtr+(uRight*aC.x+uUp*aC.y)*uRad,1.0);}`,
 `varying vec2 vC;uniform vec3 uCol;uniform float uSharp;void main(){float r=length(vC);if(r>1.0)discard;float f=exp(-r*uSharp)*(1.0-r)*(1.0-r);gl_FragColor=vec4(uCol*f,1.0);}`);
 const FS=`precision highp float;attribute vec2 aP;varying vec2 vUv;void main(){vUv=aP*0.5+0.5;gl_Position=vec4(aP,0.0,1.0);}`;
 const DOWN=prog(FS,`uniform sampler2D uTex;uniform vec2 uTexel;varying vec2 vUv;void main(){vec3 c=texture2D(uTex,vUv+uTexel*vec2(-1.0,-1.0)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.0,-1.0)).rgb+texture2D(uTex,vUv+uTexel*vec2(-1.0,1.0)).rgb+texture2D(uTex,vUv+uTexel*vec2(1.0,1.0)).rgb;gl_FragColor=vec4(c*0.25,1.0);}`);
 const BLUR=prog(FS,`uniform sampler2D uTex;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 c=texture2D(uTex,vUv).rgb*0.2270;
 c+=(texture2D(uTex,vUv+uDir*1.3846).rgb+texture2D(uTex,vUv-uDir*1.3846).rgb)*0.3162;c+=(texture2D(uTex,vUv+uDir*3.2308).rgb+texture2D(uTex,vUv-uDir*3.2308).rgb)*0.0703;gl_FragColor=vec4(c,1.0);}`);
 const COMP=prog(FS,`uniform sampler2D uScene,uB1,uB2;uniform float uExp,uTime,uBloom;uniform vec2 uRes;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec3 c=texture2D(uScene,vUv).rgb;vec3 b=texture2D(uB1,vUv).rgb*0.55+texture2D(uB2,vUv).rgb*0.85;c=(c+b*uBloom)*uExp;
 c=aces(c);vec2 q=vUv-0.5;c*=1.0-dot(q,q)*0.9;c=pow(c,vec3(1.0/2.2));c+=vec3(0.002,0.003,0.008);
 c+=(h(vUv*uRes+uTime)-0.5)*0.014;gl_FragColor=vec4(c,1.0);}`);
 const buf=d=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
 const stat=new Float32Array(N*6);for(let i=0;i<N;i++){stat.set([P.col[i*4],P.col[i*4+1],P.col[i*4+2],P.col[i*4+3],P.size[i],P.seed[i]],i*6);}
 const sBuf=buf(stat),pBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pBuf);gl.bufferData(gl.ARRAY_BUFFER,pos.byteLength,gl.DYNAMIC_DRAW);
 const bgBuf=buf(BG.a),fBuf=buf(FIELD.a),qBuf=buf(new Float32Array([-1,-1,1,-1,-1,1,1,1])),tri=buf(new Float32Array([-1,-1,3,-1,-1,3]));
 const attr=(pr,name,b,size,stride,off)=>{const l=pr.a[name];if(l===undefined||l<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,stride*4,off*4);};
 const off=pr=>{for(const k in pr.a)gl.disableVertexAttribArray(pr.a[k]);};
 function target(w,h,flt){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);const f=flt&&linear||!flt?gl.LINEAR:gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,flt?fInt:gl.RGBA,w,h,0,gl.RGBA,flt?fType:gl.UNSIGNED_BYTE,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  if(flt&&gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){fType=gl.UNSIGNED_BYTE;fInt=gl.RGBA;gl.deleteFramebuffer(fb);gl.deleteTexture(t);return target(w,h,false);}
  return {t,fb,w,h};}
 let T={},W0=0,H0=0;
 function resize(w,h){if(w===W0&&h===H0)return;W0=w;H0=h;for(const k in T){gl.deleteTexture(T[k].t);gl.deleteFramebuffer(T[k].fb);}
  T={scene:target(w,h,true),a:target(w>>1,h>>1,true),b:target(w>>2,h>>2,true),c:target(w>>2,h>>2,true),d:target(w>>3,h>>3,true),e:target(w>>3,h>>3,true)};}
 function pass(pr,dst,src,setup){gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.fb:null);gl.viewport(0,0,dst?dst.w:W0,dst?dst.h:H0);gl.useProgram(pr.p);attr(pr,'aP',tri,2,2,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.t);gl.uniform1i(pr.u.uTex,0);setup&&setup();gl.drawArrays(gl.TRIANGLES,0,3);off(pr);}
 return {kind:gl2?'webgl2':'webgl',hdr:fType!==gl.UNSIGNED_BYTE,
  draw(F){const w=F.w,h=F.h;resize(w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,T.scene.fb);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);const vp=F.vp,cam=F.cam,dpr=F.dpr,scale=h/(2*Math.tan(F.fov*Math.PI/360)),hdr=this.hdr?1:0.55;
   if(F.bg>0){gl.useProgram(BGP.p);gl.uniformMatrix4fv(BGP.u.uVP,false,vp);gl.uniform3fv(BGP.u.uCam,cam);gl.uniform1f(BGP.u.uAlpha,F.bg*hdr);gl.uniform1f(BGP.u.uPx,dpr);
    attr(BGP,'aDir',bgBuf,3,8,0);attr(BGP,'aCol',bgBuf,4,8,3);attr(BGP,'aSize',bgBuf,1,8,7);gl.drawArrays(gl.POINTS,0,BG.n);off(BGP);}
   if(F.field>0){gl.useProgram(FG.p);gl.uniformMatrix4fv(FG.u.uVP,false,vp);gl.uniform3fv(FG.u.uCam,cam);gl.uniform1f(FG.u.uScale,scale);gl.uniform1f(FG.u.uAlpha,F.field*hdr);gl.uniform1f(FG.u.uMaxPx,Math.min(maxPt,96));
    attr(FG,'aPos',fBuf,3,10,0);attr(FG,'aCol',fBuf,4,10,3);attr(FG,'aShape',fBuf,3,10,7);gl.drawArrays(gl.POINTS,0,FIELD.n);off(FG);}
   gl.useProgram(QD.p);gl.uniformMatrix4fv(QD.u.uVP,false,vp);gl.uniform3fv(QD.u.uRight,F.right);gl.uniform3fv(QD.u.uUp,F.up);attr(QD,'aC',qBuf,2,2,0);
   for(const g of F.glows){gl.uniform3fv(QD.u.uCtr,g.p);gl.uniform1f(QD.u.uRad,g.r);gl.uniform3fv(QD.u.uCol,g.c.map(v=>v*hdr));gl.uniform1f(QD.u.uSharp,g.s);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}off(QD);
   gl.useProgram(PT.p);gl.bindBuffer(gl.ARRAY_BUFFER,pBuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,pos);
   attr(PT,'aPos',pBuf,3,3,0);attr(PT,'aCol',sBuf,4,6,0);attr(PT,'aSize',sBuf,1,6,4);attr(PT,'aSeed',sBuf,1,6,5);
   const U=PT.u;gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform3fv(U.uCam,cam);gl.uniform1f(U.uScale,scale);gl.uniform1f(U.uMinPx,1.25*dpr);gl.uniform1f(U.uMaxPx,Math.min(maxPt,220*dpr));
   gl.uniform1f(U.uNear,F.near);gl.uniform1f(U.uTime,F.time);gl.uniform1f(U.uAge,F.age);
   const run=(r,sizeMul,alpha,soft,burst)=>{gl.uniform1f(U.uSizeMul,sizeMul);gl.uniform1f(U.uAlpha,alpha*hdr);gl.uniform1f(U.uSoft,soft);gl.uniform1f(U.uBurst,burst);gl.drawArrays(gl.POINTS,r[0],r[1]);};
   const st=P.ranges.star,hi=P.ranges.hii,du=P.ranges.dust;
   gl.uniform1f(U.uNear,F.near*3);gl.uniform1f(U.uMaxPx,Math.min(maxPt,F.glowMax*dpr));run(st,7,0.07*F.glowK,1,0);
   gl.uniform1f(U.uNear,F.near);gl.uniform1f(U.uMaxPx,Math.min(maxPt,F.starMax*dpr));run(st,1,0.55,0,0);gl.uniform1f(U.uMaxPx,Math.min(maxPt,220*dpr));
   if(F.hii>0){gl.uniform1f(U.uMaxPx,Math.min(maxPt,F.starMax*2*dpr));run(hi,1,0.32*F.hii,1,F.burst);gl.uniform1f(U.uMaxPx,Math.min(maxPt,220*dpr));}
   if(F.dust>0){gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_COLOR);gl.uniform1f(U.uAge,0);gl.uniform1f(U.uNear,F.near*1.6);run(du,1,0.22*F.dust/hdr,1,0);gl.blendFunc(gl.ONE,gl.ONE);}
   off(PT);
   if(F.beacon>0){gl.useProgram(QD.p);attr(QD,'aC',qBuf,2,2,0);gl.uniform3fv(QD.u.uCtr,[0,0,0]);gl.uniform1f(QD.u.uRad,F.beaconR);gl.uniform3fv(QD.u.uCol,[2.2*F.beacon*hdr,1.7*F.beacon*hdr,1.15*F.beacon*hdr]);gl.uniform1f(QD.u.uSharp,9);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);off(QD);}
   gl.disable(gl.BLEND);
   pass(DOWN,T.a,T.scene,()=>gl.uniform2f(DOWN.u.uTexel,1/w,1/h));
   pass(DOWN,T.b,T.a,()=>gl.uniform2f(DOWN.u.uTexel,1/T.a.w,1/T.a.h));
   pass(BLUR,T.c,T.b,()=>gl.uniform2f(BLUR.u.uDir,1/T.b.w,0));pass(BLUR,T.b,T.c,()=>gl.uniform2f(BLUR.u.uDir,0,1/T.b.h));
   pass(DOWN,T.d,T.b,()=>gl.uniform2f(DOWN.u.uTexel,1/T.b.w,1/T.b.h));
   for(let k=0;k<2;k++){pass(BLUR,T.e,T.d,()=>gl.uniform2f(BLUR.u.uDir,(1+k)/T.d.w,0));pass(BLUR,T.d,T.e,()=>gl.uniform2f(BLUR.u.uDir,0,(1+k)/T.d.h));}
   pass(COMP,null,T.scene,()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,T.b.t);gl.uniform1i(COMP.u.uB1,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,T.d.t);gl.uniform1i(COMP.u.uB2,2);
    gl.uniform1i(COMP.u.uScene,0);gl.uniform1f(COMP.u.uExp,F.exposure*(this.hdr?1:1.6));gl.uniform1f(COMP.u.uTime,F.time%100);gl.uniform1f(COMP.u.uBloom,F.bloom);gl.uniform2f(COMP.u.uRes,w,h);});
  }};
}
function makeCanvas2D(cv){
 const g=cv.getContext('2d');const pal=[[255,214,170],[200,215,255],[255,120,170]];
 return {kind:'canvas',draw(F){const w=F.w,h=F.h,vp=F.vp;g.globalCompositeOperation='source-over';g.fillStyle='#000';g.fillRect(0,0,w,h);g.globalCompositeOperation='lighter';
  const proj=(x,y,z)=>{const X=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],Y=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],Wc=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(Wc<=0.01)return null;return [(X/Wc*0.5+0.5)*w,(0.5-Y/Wc*0.5)*h,Wc];};
  if(F.bg>0){g.fillStyle=`rgba(220,225,255,${0.5*F.bg})`;for(let i=0;i<BG.n;i+=2){const d=BG.a.subarray(i*8,i*8+3),p=proj(F.cam[0]+d[0]*1e6,F.cam[1]+d[1]*1e6,F.cam[2]+d[2]*1e6);if(p&&p[0]>=0&&p[0]<w&&p[1]>=0&&p[1]<h)g.fillRect(p[0],p[1],1,1);}}
  for(const q of F.glows){const p=proj(q.p[0],q.p[1],q.p[2]);if(!p)continue;const r=q.r*h/(2*Math.tan(F.fov*Math.PI/360))/p[2];if(r<1)continue;const gr=g.createRadialGradient(p[0],p[1],0,p[0],p[1],r);
   gr.addColorStop(0,`rgba(255,220,180,${Math.min(1,q.c[0]*0.25)})`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(p[0]-r,p[1]-r,2*r,2*r);}
  const step=small?2:1,st=P.ranges.star[1],hi=P.ranges.hii;
  for(let i=0;i<st;i+=step){const p=proj(pos[i*3],pos[i*3+1],pos[i*3+2]);if(!p||p[0]<0||p[0]>=w||p[1]<0||p[1]>=h)continue;const k=P.col[i*4+2]>0.8?1:0,c=pal[k],a=Math.min(1,0.1*P.col[i*4+3]*F.exposure);
   g.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${a})`;g.fillRect(p[0],p[1],1.6,1.6);}
  if(F.hii>0)for(let i=hi[0];i<hi[0]+hi[1];i++){const p=proj(pos[i*3],pos[i*3+1],pos[i*3+2]);if(!p)continue;g.fillStyle=`rgba(255,110,170,${Math.min(1,0.15*F.hii*(1+F.burst))})`;g.fillRect(p[0]-1,p[1]-1,2.5,2.5);}
  if(F.beacon>0){const p=proj(0,0,0);if(p){g.fillStyle=`rgba(255,220,170,${F.beacon})`;g.beginPath();g.arc(p[0],p[1],3,0,7);g.fill();}}
 }};
}

// ---------------------------------------------------------------- UI
const ui={card:$('card'),cap:$('caption'),post:$('post'),hud:$('hud'),fade:$('fade'),sky:$('sky'),play:$('play'),scrub:$('scrub'),clock:$('clock'),chapters:$('chapters'),sound:$('sound'),buffer:$('buffer'),end:$('end')};
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
for(const [f,n,t] of CHAPTERS){const o=document.createElement('option');o.value=f;o.textContent=n+' · '+t;ui.chapters.appendChild(o);const i=document.createElement('i');i.style.left=(f/DUR*100)+'%';$('ticks').appendChild(i);}
let film=0,playing=false,started=false,lastCap=-1,lastCard=-1,score=null,bufferSince=0;
function setPlaying(v){playing=v;ui.play.textContent=v?'❚❚':'▶';ui.play.setAttribute('aria-label',v?'Pause':'Play');if(v)ui.end.hidden=true;}
function seek(f){film=clamp(f,0,DUR);ui.end.hidden=film<DUR-4;}
function begin(withSound){
 if(started)return;started=true;$('start').classList.add('leaving');setTimeout(()=>$('start').hidden=true,1400);$('controls').hidden=false;
 if(withSound)enableSound(true);seek(0);setPlaying(true);document.body.classList.add('film');poke();
}
function enableSound(v){if(v&&!score){try{score=LongFallScore();}catch(e){score=null;}}if(score){score.enabled=v;score.volume=+$('vol').value;}ui.sound.setAttribute('aria-pressed',String(!!(score&&v)));ui.sound.textContent=score&&v?'Sound on':'Sound';}
$('go-sound').onclick=()=>begin(true);$('go-quiet').onclick=()=>begin(false);
ui.play.onclick=()=>{if(film>=DUR)seek(0);setPlaying(!playing);};
ui.scrub.oninput=()=>seek(+ui.scrub.value);
ui.chapters.onchange=()=>{seek(+ui.chapters.value);setPlaying(true);};
ui.sound.onclick=()=>enableSound(!(score&&score.enabled));
$('vol').oninput=e=>{if(score)score.volume=+e.target.value;};
$('cc').onclick=e=>{const on=document.body.classList.toggle('no-cc');e.currentTarget.setAttribute('aria-pressed',String(!on));};
$('free').onclick=e=>{user.free=!user.free;e.currentTarget.setAttribute('aria-pressed',String(user.free));};
const notes=$('notes');$('notes-btn').onclick=()=>{setPlaying(false);notes.showModal();};$('start-notes').onclick=e=>{e.preventDefault();notes.showModal();};$('notes-close').onclick=()=>notes.close();
$('fs').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){}};
if(!document.documentElement.requestFullscreen)$('fs').hidden=true;
$('again').onclick=()=>{seek(0);setPlaying(true);};
$('explore').onclick=()=>{user.free=true;$('free').setAttribute('aria-pressed','true');seek(150);setPlaying(false);ui.end.hidden=true;};
addEventListener('keydown',e=>{if(!started||notes.open||e.target.tagName==='SELECT'||e.target.tagName==='INPUT'&&e.target.type!=='range')return;
 if(e.code==='Space'){e.preventDefault();ui.play.click();}else if(e.key==='ArrowRight'&&e.target!==ui.scrub){seek(film+5);}else if(e.key==='ArrowLeft'&&e.target!==ui.scrub){seek(film-5);}
 else if(e.key==='m'||e.key==='M')ui.sound.click();else if(e.key==='c'||e.key==='C')$('cc').click();else if(e.key==='f'||e.key==='F')$('fs').click();poke();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)setPlaying(false);});
let idleTimer=0;function poke(){document.body.classList.remove('idle');clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(playing&&started&&!notes.open)document.body.classList.add('idle');},2800);}
addEventListener('pointermove',poke);
// drag / zoom
const ptrs=new Map();let pinch=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const p=ptrs.get(e.pointerId),dx=e.clientX-p[0],dy=e.clientY-p[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);
 if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)user.zoom=clamp(user.zoom-Math.log(d/pinch),-2.5,2.5);pinch=d;}
 else{user.yaw-=dx*0.005;user.pitch=clamp(user.pitch+dy*0.004,-1.3,1.3);}user.last=performance.now();});
const up=e=>{ptrs.delete(e.pointerId);pinch=0;if(!ptrs.size)canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
canvas.addEventListener('wheel',e=>{e.preventDefault();user.zoom=clamp(user.zoom+e.deltaY*0.0012,-2.5,2.5);user.last=performance.now();},{passive:false});

function readout(T){
 S.centreAt(TAB,T,C);const sep=Math.hypot(C[3]-C[0],C[4]-C[1],C[5]-C[2]),vr=Math.hypot(C[9]-C[6],C[10]-C[7],C[11]-C[8])*S.KMS;
 const ly=x=>x>=1e6?(x/1e6).toFixed(2)+' million ly':Math.round(x/1000).toLocaleString('en')+',000 ly';
 $('r-time').textContent=T<0.5?'Today':T<1000?'+'+Math.round(T)+' million years':'+'+(T/1000).toFixed(2)+' billion years';
 const merged=T>EV.merged+40;
 $('r-dist').textContent=merged?'Merged':ly(sep*S.KPC_LY);
 $('r-speed').textContent=merged?'—':Math.round(vr)+' km/s';
 const ref=T<4600?[C[0],C[1],C[2]]:[0,0,0],sd=Math.hypot(pos[0]-ref[0],pos[1]-ref[1],pos[2]-ref[2])*S.KPC_LY;$('r-sun').textContent=Math.round(sd/100)*100>=1000?Math.round(sd/1000).toLocaleString('en')+',000 ly':'—';
}
function showCaption(f){
 let idx=-1;for(let i=0;i<CAPTIONS.length;i++){const c=CAPTIONS[i];if(f>=c[0]&&f<c[0]+c[1]){idx=i;break;}}
 if(idx!==lastCap){lastCap=idx;if(idx<0)ui.cap.classList.remove('show');else{const c=CAPTIONS[idx];ui.cap.classList.remove('show');void ui.cap.offsetWidth;ui.cap.querySelector('.eyebrow').textContent=c[2];ui.cap.querySelector('.text').textContent=c[3];ui.cap.classList.add('show');}}
 let ci=-1;for(let i=0;i<CHAPTERS.length-1;i++){const a=CHAPTERS[i][0];if(f>=a+0.6&&f<a+4.4)ci=i;}
 if(ci!==lastCard){lastCard=ci;ui.card.classList.toggle('show',ci>=0);if(ci>=0){ui.card.querySelector('.num').textContent=CHAPTERS[ci][1];ui.card.querySelector('h2').textContent=CHAPTERS[ci][2];}}
 const post=f>=263;ui.post.classList.toggle('show',post);ui.post.querySelectorAll('li').forEach((li,i)=>li.classList.toggle('on',f>=264.5+i*4.5));ui.post.querySelector('p').classList.toggle('on',f>=279);
}
function markers(f,vp,w,h){
 const put=(id,p,o)=>{const el=$(id);if(o<=0.01){el.style.opacity=0;return;}const X=vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12],Y=vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13],Wc=vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];
  if(Wc<=0){el.style.opacity=0;return;}el.style.opacity=o;el.style.transform=`translate(${(X/Wc*0.5+0.5)*w}px,${(0.5-Y/Wc*0.5)*h}px) translate(-50%,-50%)`;};
 const sunO=ss(2.5,4,f)*(1-ss(19,21,f))+ss(144,146,f)*(1-ss(157,158.5,f))+ss(206,208,f)*(1-ss(225,227,f));
 $('m-sun-sub').textContent=f<30?'YOU ARE HERE':'IN THIS SIMULATION';
 put('m-sun',[pos[0],pos[1],pos[2]],sunO);
 const gO=ss(24,26,f)*(1-ss(45,47,f));put('m-mw',[C[0],C[1],C[2]],gO);put('m-m31',[C[3],C[4],C[5]],gO);
}

// ---------------------------------------------------------------- frame loop
let prevNow=performance.now(),dprCap=small?1.25:1.5,slow=0;
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(0.1,(now-prevNow)/1000);prevNow=now;
 if(!SIM.done&&SIM.bg)backgroundWork(playing?4:10);
 // story time
 let f=film;const T=started?timeOf(f):Math.min(1,now/1e5);
 const ok=stateAt(T);
 if(started&&playing){if(ok){film=Math.min(DUR,film+dt);bufferSince=0;if(film>=DUR){setPlaying(false);ui.end.hidden=false;document.body.classList.remove('idle');}}else{bufferSince=bufferSince||now;}}
 ui.buffer.hidden=!(bufferSince&&now-bufferSince>400&&playing);
 if(!ok&&!playing)ui.buffer.hidden=false;else if(ok&&!playing)ui.buffer.hidden=true;
 S.centreAt(TAB,T,C);
 // camera
 if(!user.free&&performance.now()-user.last>2600){const k=Math.exp(-dt*0.9);user.yaw*=k;user.pitch*=k;user.zoom*=k;}
 let cam;
 if(!started){const a=now/1000*0.035;cam={...orbit([C[0],C[1],C[2]],SUN_PHI+a,0.78,58,MW),fov:50,near:3};}
 else cam=camera(f);
 const dpr=Math.min(devicePixelRatio||1,dprCap),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const L=lookAt(cam.pos,cam.target,cam.up),dist=V.len(V.sub(cam.pos,cam.target));
 const proj=perspective(cam.fov,w/h,Math.max(0.01,dist*0.002),Math.max(4e6,dist*20)),vp=mul4(proj,L.m);
 const sky=cam.sky?ss(48,50,f)*(1-ss(90.5,91.8,f)):0;
 const glows=[];for(let g=0;g<2;g++){const p=[C[g*3],C[g*3+1],C[g*3+2]],m=g===0?1:1.25,sk=cam.sky&&g===0?0.25:1;
  glows.push({p,r:9*m,c:[0.55*sk,0.42*sk,0.3*sk],s:5.5},{p,r:2.4*m,c:[1.2*sk,0.95*sk,0.7*sk],s:7});}
 const bz=V.len(cam.pos);
 const F={w,h,dpr,vp,cam:cam.pos,fov:cam.fov,near:cam.near,right:L.x,up:L.y,time:now/1000,glows,
  exposure:started?keys(EXPO,f):1.05,bloom:0.9,
  starMax:sky>0?4:220,glowMax:sky>0?70:220,
  bg:started?(0.35+0.65*sky)*(1-ss(236,252,f)):0.4,field:started?ss(231,246,f):0,glowK:sky?0.35:1,
  hii:(T>4900?Math.exp(-(T-4900)/450):1)*(sky>0?0.35:1),dust:1-0.75*ss(4600,5700,T),age:0.55*ss(4800,6900,T),
  burst:1.4*Math.exp(-Math.pow((T-4040)/80,2))+2.2*Math.exp(-Math.pow((T-4540)/100,2))+0.8*Math.exp(-Math.pow((T-4720)/160,2)),
  beacon:started?ss(229,236,f)*(1-0.6*ss(246,256,f)):0,beaconR:bz*0.006};
 (GLR||R2).draw(F);
 // overlays
 ui.fade.style.opacity=started?keys(FADE,f):0;
 ui.sky.style.opacity=sky;
 const bar=started&&innerWidth/innerHeight>1.25?Math.max(0,(innerHeight-innerWidth/2.39)/2)*(1-ss(262,264,f))*0.85:0;document.documentElement.style.setProperty('--bar',bar+'px');
 ui.hud.style.opacity=started?ss(50,52,f)*(1-ss(259,261,f)):0;
 if(started){const ch=CHAPTERS.filter(c=>f>=c[0]).pop();$('chapter').innerHTML=`<span>${ch[1]}</span>${ch[2]}`;readout(T);showCaption(f);markers(f,vp,innerWidth,innerHeight);
  ui.scrub.value=film;ui.scrub.style.setProperty('--p',(film/DUR*100)+'%');ui.clock.textContent=fmt(film)+' / '+fmt(DUR);
  const chi=CHAPTERS.filter(c=>f>=c[0]).length-1;if(document.activeElement!==ui.chapters&&ui.chapters.selectedIndex!==chi)ui.chapters.selectedIndex=chi;}
 if(score)score.update(film,playing&&ok);
 // adaptive resolution
 if(dt>0.045){slow++;if(slow>40&&dprCap>0.75){dprCap-=0.25;slow=0;}}else slow=Math.max(0,slow-1);
}
requestAnimationFrame(frame);
window.__longfall={seek:f=>{if(!started){started=true;$('start').hidden=true;$('controls').hidden=false;}seek(f);},play:v=>setPlaying(v),get film(){return film;},get ready(){return SIM.done;},renderer:()=>(GLR||R2).kind,sim:SIM,T:f=>timeOf(f),EV};
})();
