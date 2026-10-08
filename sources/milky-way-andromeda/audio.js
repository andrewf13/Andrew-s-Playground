// Generative orchestral score for The Long Fall, synthesised live with the Web Audio API and locked to film time.
// Strings-like pads, sub drone, formant choir, bells, heartbeat timpani and a riser that peaks on the collision.
function LongFallScore(cue){
 'use strict';
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)return null;
 const ctx=new AC();
 const mtof=m=>440*Math.pow(2,(m-69)/12);
 const lerpKeys=(keys,f)=>{if(f<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(f<=keys[i][0]){const a=keys[i-1],b=keys[i],u=(f-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*u;}return keys[keys.length-1][1];};

 // --- buses
 const master=ctx.createGain();master.gain.value=0;
 const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;comp.attack.value=0.02;comp.release.value=0.4;
 master.connect(comp);comp.connect(ctx.destination);
 const rev=ctx.createConvolver();{const len=ctx.sampleRate*5.5,b=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++){const t=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-t,3.2)*(t<0.01?t*100:1);}}rev.buffer=b;}
 const wet=ctx.createGain();wet.gain.value=0.55;rev.connect(wet);wet.connect(master);
 const dry=ctx.createGain();dry.gain.value=0.75;dry.connect(master);
 const noiseBuf=(()=>{const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;})();

 // --- string pad: 6 voices x 2 detuned saws through a shared low-pass
 const padF=ctx.createBiquadFilter();padF.type='lowpass';padF.frequency.value=400;padF.Q.value=0.7;
 const padG=ctx.createGain();padG.gain.value=0;padF.connect(padG);padG.connect(dry);padG.connect(rev);
 const voices=[];
 for(let v=0;v<6;v++){const g=ctx.createGain();g.gain.value=v===0?0.22:0.15;g.connect(padF);const os=[];
  for(const det of [-7,6]){const o=ctx.createOscillator();o.type='sawtooth';o.detune.value=det+(v*3%5);o.frequency.value=110;o.connect(g);o.start();os.push(o);}
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=0.07+v*0.031;lg.gain.value=0.05;lfo.connect(lg);lg.connect(g.gain);lfo.start();voices.push(os);}

 // --- sub drone
 const droneG=ctx.createGain();droneG.gain.value=0;droneG.connect(dry);
 const drones=[];for(const [m,t,a] of [[26,'sine',0.5],[38,'sine',0.3],[38,'triangle',0.12]]){const o=ctx.createOscillator(),g=ctx.createGain();o.type=t;o.frequency.value=mtof(m);g.gain.value=a;o.connect(g);g.connect(droneG);o.start();drones.push(o);}

 // --- choir: saws through 'ah' formants
 const choirG=ctx.createGain();choirG.gain.value=0;
 const fBus=ctx.createGain();fBus.gain.value=1;
 for(const [fr,q,a] of [[730,9,1],[1090,10,0.55],[2440,12,0.25]]){const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=fr;bp.Q.value=q;const g=ctx.createGain();g.gain.value=a*2.4;fBus.connect(bp);bp.connect(g);g.connect(choirG);}
 choirG.connect(rev);choirG.connect(dry);
 const choir=[];const vib=ctx.createOscillator(),vibG=ctx.createGain();vib.frequency.value=5.1;vibG.gain.value=6;vib.connect(vibG);vib.start();
 for(let v=0;v<4;v++){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=220;o.detune.value=(v-1.5)*5;vibG.connect(o.detune);const g=ctx.createGain();g.gain.value=0.18;o.connect(g);g.connect(fBus);o.start();choir.push(o);}

 // --- riser
 const riserSrc=ctx.createBufferSource();riserSrc.buffer=noiseBuf;riserSrc.loop=true;
 const riserF=ctx.createBiquadFilter();riserF.type='bandpass';riserF.Q.value=1.4;riserF.frequency.value=300;
 const riserG=ctx.createGain();riserG.gain.value=0;riserSrc.connect(riserF);riserF.connect(riserG);riserG.connect(rev);riserG.connect(dry);riserSrc.start();

 // --- score data (film seconds)
 const CHORDS=[[0,[38,50,57,62,65,76]],[24,[34,46,57,62,65,74]],[40,[31,50,58,62,67,74]],[48,[38,50,57,62,65,69]],[59,[34,50,58,62,65,70]],[67,[33,48,57,60,65,72]],[75,[31,50,55,62,67,70]],[83,[33,52,57,62,64,69]],[88,[33,49,57,61,64,69]],
  [92,[38,50,57,62,65,74]],[103,[34,50,58,65,70,74]],[110,[26,50,57,64,65,77]],[120,[36,48,55,64,67,72]],[128,[34,46,53,62,65,70]],[139,[31,50,55,62,67,74]],[148,[39,51,58,63,67,75]],
  [158,[33,49,55,61,64,73]],[165,[34,50,58,65,70,77]],[170,[26,38,57,62,69,74]],[178,[34,46,62,65,70,77]],[184,[33,45,61,64,69,76]],
  [192,[38,50,57,62,66,69]],[203,[38,50,55,62,67,71]],[210,[38,50,57,62,66,73]],[218,[38,50,57,62,66,71]],[226,[38,57,62,66,69,76]],[244,[38,55,62,66,71,74]],[252,[38,50,57,64,66,74]],[262,[38,50,57,64,69,76]]];
 const INT=[[0,0.16],[20,0.2],[40,0.28],[48,0.22],[70,0.32],[88,0.46],[92,0.38],[108,0.62],[110,0.78],[118,0.55],[128,0.5],[150,0.68],[158,0.7],[166,0.93],[170,1],[178,0.86],[190,0.6],[194,0.46],[215,0.42],[226,0.38],[255,0.3],[262,0.2],[284,0.06],[292,0]];
 const CHOIR=[[0,0],[126,0],[146,0.5],[170,1],[186,0.7],[200,0.15],[236,0.15],[252,0.45],[262,0.2],[284,0]];
 const HITS=[[48,0.35],[92,0.55],[110,1],[128,0.5],[158,0.6],[170,1.5],[192,0.7],[226,0.4]];
 const BEATS=(()=>{const out=[],bpm=[[92,0],[94,52],[128,64],[158,76],[169.4,112],[170,0],[171,68],[190,60],[192,0]];let f=92;
  while(f<192){const b=lerpKeys(bpm,f);if(b<1){f+=0.25;continue;}out.push([f,0.25+0.3*(b-50)/62]);f+=60/b;}return out;})();
 const chordAt=f=>{let c=CHORDS[0][1];for(const k of CHORDS)if(f>=k[0])c=k[1];return c;};
 let lastChord=null,last=null,vol=1,on=false;
 const hash=x=>{const s=Math.sin(x*127.1+311.7)*43758.5453;return s-Math.floor(s);};

 function hit(strength,t){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(42,t+0.5);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.9*strength,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+2.4+strength);
  o.connect(g);g.connect(dry);g.connect(rev);o.start(t);o.stop(t+4+strength);
  const n=ctx.createBufferSource(),nf=ctx.createBiquadFilter(),ng=ctx.createGain();n.buffer=noiseBuf;nf.type='lowpass';nf.frequency.value=strength>1?1600:700;
  ng.gain.setValueAtTime(0.5*strength,t);ng.gain.exponentialRampToValueAtTime(0.0001,t+(strength>1?3.5:0.8));n.connect(nf);nf.connect(ng);ng.connect(rev);ng.connect(dry);n.start(t);n.stop(t+4);
  if(strength>1.2){const s=ctx.createOscillator(),sg=ctx.createGain();s.type='sine';s.frequency.setValueAtTime(60,t);s.frequency.exponentialRampToValueAtTime(24,t+4);sg.gain.setValueAtTime(0.8,t);sg.gain.exponentialRampToValueAtTime(0.0001,t+6);s.connect(sg);sg.connect(dry);s.start(t);s.stop(t+6.5);}
 }
 function beat(a,t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(70,t);o.frequency.exponentialRampToValueAtTime(38,t+0.25);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(a,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);o.connect(g);g.connect(dry);o.start(t);o.stop(t+0.8);}
 function bell(m,a,t){for(const [r,k,d] of [[1,1,3.2],[2.76,0.35,1.4],[5.4,0.12,0.6]]){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=mtof(m)*r;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(a*k,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);g.connect(rev);g.connect(dry);o.start(t);o.stop(t+d+0.1);}}

 function update(f,playing){
  const now=ctx.currentTime, I=lerpKeys(INT,f);
  master.gain.setTargetAtTime(on&&playing?vol*0.62:0,now,playing?0.35:0.15);
  if(!on)return;
  const ch=chordAt(f);
  if(ch!==lastChord){const glide=lastChord&&Math.abs(f-(last??f))<1?0.6:0.02;ch.forEach((m,v)=>voices[v].forEach(o=>o.frequency.setTargetAtTime(mtof(m),now,glide)));
   const top=ch.slice(2).map(m=>m<55?m+12:m);choir.forEach((o,v)=>o.frequency.setTargetAtTime(mtof(top[v%top.length]),now,glide*1.5));
   drones[0].frequency.setTargetAtTime(mtof(ch[0]%12+24),now,1.2);drones[1].frequency.setTargetAtTime(mtof(ch[0]%12+36),now,1.2);drones[2].frequency.setTargetAtTime(mtof(ch[0]%12+36),now,1.2);lastChord=ch;}
  const fade=f>284?Math.max(0,1-(f-284)/6):1;
  padG.gain.setTargetAtTime((0.12+0.24*I)*fade,now,0.6);
  padF.frequency.setTargetAtTime(260+I*I*4200,now,0.5);
  droneG.gain.setTargetAtTime((0.18+0.45*I)*fade*(f<2?f/2:1),now,0.8);
  choirG.gain.setTargetAtTime(lerpKeys(CHOIR,f)*0.32*fade,now,0.8);
  const rz=f>162&&f<170?Math.pow((f-162)/8,2.5):0;riserG.gain.setTargetAtTime(rz*0.5,now,0.05);riserF.frequency.setTargetAtTime(300+rz*6500,now,0.08);
  if(playing&&last!==null&&f>last&&f-last<0.5){
   for(const [t,s] of HITS)if(t>last&&t<=f)hit(s,now+0.02);
   for(const [t,a] of BEATS)if(t>last&&t<=f)beat(a*(0.5+I*0.6),now+0.02);
   for(let g=Math.floor(last*4)+1;g<=f*4;g++){const p=0.05+I*0.28;if(hash(g)<p&&g/4<286){const top=ch.slice(3);bell(top[Math.floor(hash(g+0.5)*top.length)]+12*(hash(g+0.7)<0.4?1:0),0.05+0.06*hash(g+0.3),now+0.02);}}
  }
  last=f;
 }
 return {ctx,update,
  set enabled(v){on=v;if(v&&ctx.state!=='running')ctx.resume();},get enabled(){return on;},
  set volume(v){vol=v;},resume(){return ctx.resume();}};
}
