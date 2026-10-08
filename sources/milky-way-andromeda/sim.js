// Shared physics for The Long Fall. Runs in the page, in a Web Worker (via toString) and in Node for testing.
// Units: kiloparsecs, megayears and 10^10 solar masses. A restricted three-body model in the spirit of Toomre & Toomre (1972):
// two extended galaxies (Hernquist halo + bulge) follow a two-body orbit with a dynamical-friction drag, and tens of
// thousands of massless star, gas and dust particles respond to both potentials.
function LongFallSim(){
 'use strict';
 const G=0.04498, DT=0.5, T_NUM=3500, T_END=7000, CP=100;
 const KPC_LY=3261.56, KMS=977.8; // kpc -> light-years, kpc/Myr -> km/s
 const GAL=[
  {name:'Milky Way',Mh:150,ah:25,Mb:1.6,ab:0.6,Rd:3.3,Rmax:17,h:0.22,ref:8.2,n:[-0.358,-0.934,0],arms:4,pitch:0.22},
  {name:'Andromeda',Mh:190,ah:30,Mb:3.2,ab:0.9,Rd:5.0,Rmax:27,h:0.3,ref:10,n:[0.225,-0.6,0.767],arms:2,pitch:0.13}
 ];
 const ORBIT={r0:780,vr:-0.1125,vt:0.034,c0:0.0013,rf:45};
 const NSTEP=Math.round(T_END/DT), I_NUM=Math.round(T_NUM/DT), CP_STEPS=Math.round(CP/DT);
 const norm=v=>{const l=Math.hypot(v[0],v[1],v[2]);return [v[0]/l,v[1]/l,v[2]/l];};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const g of GAL){g.n=norm(g.n);const t=Math.abs(g.n[1])<0.9?[0,1,0]:[1,0,0];g.e1=norm(cross(t,g.n));g.e2=cross(g.n,g.e1);g.omega=vcirc(g,g.ref)/g.ref;}
 function menc(g,r){return g.Mh*r*r/((r+g.ah)*(r+g.ah))+g.Mb*r*r/((r+g.ab)*(r+g.ab));}
 function vcirc(g,r){return Math.sqrt(G*menc(g,r)/Math.max(r,1e-4));}

 // Two-body orbit of the galaxy centres, tabulated every DT: [x0,y0,z0,x1,y1,z1,vx0,vy0,vz0,vx1,vy1,vz1]
 function centres(){
  const tab=new Float64Array((NSTEP+2)*12), m0=GAL[0].Mh, m1=GAL[1].Mh, M=m0+m1;
  let x=ORBIT.r0,y=0,z=0,vx=ORBIT.vr,vy=0,vz=ORBIT.vt; // relative position of Andromeda from the Milky Way
  for(let i=0;i<=NSTEP+1;i++){
   const o=i*12, f0=m1/M, f1=m0/M;
   tab[o]=-f0*x;tab[o+1]=-f0*y;tab[o+2]=-f0*z;tab[o+3]=f1*x;tab[o+4]=f1*y;tab[o+5]=f1*z;
   tab[o+6]=-f0*vx;tab[o+7]=-f0*vy;tab[o+8]=-f0*vz;tab[o+9]=f1*vx;tab[o+10]=f1*vy;tab[o+11]=f1*vz;
   const r=Math.hypot(x,y,z)+1e-6, acc=-G*(menc(GAL[0],r)+menc(GAL[1],r))/(r*r*r), v=Math.hypot(vx,vy,vz);
   const df=ORBIT.c0/(1+(r/ORBIT.rf)*(r/ORBIT.rf))/Math.max(v,0.08);
   vx+=(acc*x-df*vx)*DT;vy+=(acc*y-df*vy)*DT;vz+=(acc*z-df*vz)*DT;x+=vx*DT;y+=vy*DT;z+=vz*DT;
  }
  return tab;
 }

 function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

 // Particle catalogue. Kinds: 0 star, 1 star-forming gas (HII), 2 dust. Index 0 is always the Sun.
 function particles(scale,sunPhi){
  const R=rng(20261008), gauss=()=>{let u=0,v=0;while(!u)u=R();v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v);};
  const plan=[[0,0,Math.round(15000*scale)],[1,0,Math.round(22000*scale)],[0,1,Math.round(650*scale)],[1,1,Math.round(950*scale)],[0,2,Math.round(2600*scale)],[1,2,Math.round(3800*scale)]];
  const N=plan.reduce((s,p)=>s+p[2],0);
  const gal=new Uint8Array(N), kind=new Uint8Array(N), loc=new Float32Array(N*3), lv=new Float32Array(N*3), col=new Float32Array(N*4), size=new Float32Array(N), seed=new Float32Array(N);
  const ranges={star:[0,0],hii:[0,0],dust:[0,0]};
  let i=0;
  function put(g,k,x,y,z,vx,vy,vz,c,a,s){gal[i]=g;kind[i]=k;loc[i*3]=x;loc[i*3+1]=y;loc[i*3+2]=z;lv[i*3]=vx;lv[i*3+1]=vy;lv[i*3+2]=vz;col[i*4]=c[0];col[i*4+1]=c[1];col[i*4+2]=c[2];col[i*4+3]=a;size[i]=s;seed[i]=R();i++;}
  function circ(g,x,y,z,sig){const r=Math.hypot(x,y)||1e-3,v=vcirc(g,r);return [-y/r*v+gauss()*sig,x/r*v+gauss()*sig,gauss()*sig*0.6];}
  function armPhi(g,r,width,k){const a=k%g.arms;return a*6.2831853/g.arms+(g.arms>2&&a%2?0.35:0)+Math.log(r/2.5)/Math.tan(g.pitch)+gauss()*width/r;}
  function diskR(g){let r;do r=-g.Rd*Math.log(R()*R()+1e-9);while(r>g.Rmax||r<0.4);return r;}
  for(const [g,k,n] of plan){
   const G0=GAL[g], first=i;
   if(k===0&&g===0){ // the Sun: 8.2 kpc from the centre, on a near-circular orbit
    const x=8.2*Math.cos(sunPhi),y=8.2*Math.sin(sunPhi),v=circ(G0,x,y,0,0);put(0,0,x,y,0.02,v[0],v[1],0,[1,0.9,0.7],1.4,0.07);
   }
   while(i<first+n){
    if(k===0){
     const u=R();
     if(u<0.17){ // bulge: Hernquist-like, random orbital planes
      let r;do{const s=Math.sqrt(R());r=G0.ab*1.6*s/(1-s);}while(r>4.5);
      const d=norm([gauss(),gauss(),gauss()*0.65]),x=d[0]*r,y=d[1]*r,z=d[2]*r*0.7;
      const q=norm(cross(d,norm([gauss(),gauss(),gauss()]))),v=vcirc(G0,r)*0.92;
      const w=0.75+R()*0.5;put(g,0,x,y,z,q[0]*v,q[1]*v,q[2]*v,[1,0.66+R()*0.08,0.38+R()*0.1],w*0.9,0.11);
     }else if(u<0.21&&g===0){ // Milky Way bar
      const bx=gauss()*1.9,by=gauss()*0.55,ca=Math.cos(0.47),sa=Math.sin(0.47),x=bx*ca-by*sa,y=bx*sa+by*ca,v=circ(G0,x,y,0,0.01);
      put(g,0,x,y,gauss()*0.18,v[0],v[1],v[2],[1,0.74,0.48],0.9,0.1);
     }else if(u<0.24){ // stellar halo
      const r=3+(-Math.log(R()+1e-9))*9,d=norm([gauss(),gauss(),gauss()]),q=norm(cross(d,norm([gauss(),gauss(),gauss()]))),v=vcirc(G0,r)*0.8;
      put(g,0,d[0]*r,d[1]*r,d[2]*r,q[0]*v,q[1]*v,q[2]*v,[1,0.8,0.6],0.35,0.06);
     }else{ // disk, partly in spiral arms
      const r=diskR(G0), inArm=R()<0.62, ring=g===1&&R()<0.18;
      const rr=ring?10+gauss()*1.2:r, phi=inArm?armPhi(G0,rr,1.35,Math.floor(R()*8)):R()*6.2831853;
      const x=rr*Math.cos(phi),y=rr*Math.sin(phi),z=gauss()*G0.h*(inArm?0.7:1);
      const young=Math.min(1,(inArm?0.55:0.15)+rr/G0.Rmax*0.6)*R();
      const c=[1-0.45*young,0.78-0.08*young+0.0,0.52+0.48*young], b=R()<0.03?2.4+R()*2:0.55+R()*0.7;
      const v=circ(G0,x,y,z,0.007);put(g,0,x,y,z,v[0],v[1],v[2],c,b,0.075);
     }
    }else if(k===1){ // star-forming nebulae trace the arms (and Andromeda's 10 kpc ring)
     const ring=g===1&&R()<0.55, r=ring?10+gauss()*0.9:Math.min(G0.Rmax*0.85,Math.max(2,diskR(G0)*1.1));
     const phi=ring?R()*6.2831853:armPhi(G0,Math.min(r,G0.Rmax),0.35,Math.floor(R()*8)),x=r*Math.cos(phi),y=r*Math.sin(phi),z=gauss()*0.08,v=circ(G0,x,y,z,0.004);
     put(g,1,x,y,z,v[0],v[1],v[2],[1,0.3+R()*0.12,0.5+R()*0.2],0.7+R()*0.9,0.2+R()*0.2);
    }else{ // dust lanes on the inner edge of arms
     const ring=g===1&&R()<0.45, r=ring?10+gauss()*1.4:Math.max(1.2,diskR(G0)*1.05);
     const phi=ring?R()*6.2831853:armPhi(G0,Math.min(r,G0.Rmax),0.6,Math.floor(R()*8))-0.12,x=r*Math.cos(phi),y=r*Math.sin(phi),z=gauss()*0.07,v=circ(G0,x,y,z,0.004);
     put(g,2,x,y,z,v[0],v[1],v[2],[0.5,0.62,0.85],0.5+R()*0.5,0.45+R()*0.35);
    }
   }
  }
  // contiguous draw ranges: stars, HII, dust
  let s=0;for(const [name,k] of [['star',0],['hii',1],['dust',2]]){const a=s;for(let j=0;j<N;j++)if(kind[j]===k)s++;ranges[name]=[a,s-a];}
  return {N,gal,kind,loc,lv,col,size,seed,ranges};
 }

 function centreAt(tab,T,out){ // linear interpolation of the centre table at time T (Myr)
  const f=Math.min(Math.max(T/DT,0),NSTEP),i=Math.min(Math.floor(f),NSTEP-1),u=f-i,o=i*12;
  for(let j=0;j<12;j++)out[j]=tab[o+j]*(1-u)+tab[o+12+j]*u;return out;
 }

 // Rigidly rotating galaxies before the numerical phase (tides are negligible while they are far apart).
 function analytic(P,tab,T,out,vel){
  const c=centreAt(tab,T,new Float64Array(12));
  const rot=[],cs=[];for(const g of GAL){const a=g.omega*T;rot.push(Math.cos(a));cs.push(Math.sin(a));}
  for(let i=0;i<P.N;i++){
   const g=P.gal[i],G0=GAL[g],ca=rot[g],sa=cs[g],lx=P.loc[i*3],ly=P.loc[i*3+1],lz=P.loc[i*3+2];
   const x=lx*ca-ly*sa,y=lx*sa+ly*ca,o=g*3;
   out[i*3]=c[o]+x*G0.e1[0]+y*G0.e2[0]+lz*G0.n[0];
   out[i*3+1]=c[o+1]+x*G0.e1[1]+y*G0.e2[1]+lz*G0.n[1];
   out[i*3+2]=c[o+2]+x*G0.e1[2]+y*G0.e2[2]+lz*G0.n[2];
   if(vel){const vx0=P.lv[i*3],vy0=P.lv[i*3+1],vz=P.lv[i*3+2],vx=vx0*ca-vy0*sa,vy=vx0*sa+vy0*ca,ov=6+g*3;
    vel[i*3]=c[ov]+vx*G0.e1[0]+vy*G0.e2[0]+vz*G0.n[0];
    vel[i*3+1]=c[ov+1]+vx*G0.e1[1]+vy*G0.e2[1]+vz*G0.n[1];
    vel[i*3+2]=c[ov+2]+vx*G0.e1[2]+vy*G0.e2[2]+vz*G0.n[2];}
  }
  return out;
 }

 // Leapfrog (velocities at half steps). i is the step index of the positions (time = i*DT).
 function step(pos,vel,N,tab,i,nsteps){
  const g0=GAL[0],g1=GAL[1],GM0h=G*g0.Mh,GM0b=G*g0.Mb,GM1h=G*g1.Mh,GM1b=G*g1.Mb,a0h=g0.ah,a0b=g0.ab,a1h=g1.ah,a1b=g1.ab;
  for(let s=0;s<nsteps;s++,i++){
   const o=i*12,cx0=tab[o],cy0=tab[o+1],cz0=tab[o+2],cx1=tab[o+3],cy1=tab[o+4],cz1=tab[o+5];
   for(let p=0,q=0;p<N;p++,q+=3){
    const x=pos[q],y=pos[q+1],z=pos[q+2];
    let dx=x-cx0,dy=y-cy0,dz=z-cz0,r=Math.sqrt(dx*dx+dy*dy+dz*dz)+1e-4;
    let f=(GM0h/((r+a0h)*(r+a0h))+GM0b/((r+a0b)*(r+a0b)))/r;
    let ax=-f*dx,ay=-f*dy,az=-f*dz;
    dx=x-cx1;dy=y-cy1;dz=z-cz1;r=Math.sqrt(dx*dx+dy*dy+dz*dz)+1e-4;
    f=(GM1h/((r+a1h)*(r+a1h))+GM1b/((r+a1b)*(r+a1b)))/r;
    ax-=f*dx;ay-=f*dy;az-=f*dz;
    const vx=vel[q]+ax*DT,vy=vel[q+1]+ay*DT,vz=vel[q+2]+az*DT;
    vel[q]=vx;vel[q+1]=vy;vel[q+2]=vz;pos[q]=x+vx*DT;pos[q+1]=y+vy*DT;pos[q+2]=z+vz*DT;
   }
  }
  return i;
 }

 function events(tab){ // pericentres and apocentres of the centres' orbit, plus coalescence
  const out=[];let prev=Infinity,dprev=-1,merged=null;
  for(let i=0;i<=NSTEP;i++){const o=i*12,r=Math.hypot(tab[o+3]-tab[o],tab[o+4]-tab[o+1],tab[o+5]-tab[o+2]),d=r-prev;
   if(i>200&&dprev<0&&d>0)out.push({type:'peri',T:(i-1)*DT,r:prev});if(i>200&&dprev>0&&d<0)out.push({type:'apo',T:(i-1)*DT,r:prev});
   if(merged===null&&r<4)merged=i*DT;dprev=d;prev=r;}
  return {list:out,merged};
 }

 return {G,DT,T_NUM,T_END,CP,CP_STEPS,NSTEP,I_NUM,KPC_LY,KMS,GAL,ORBIT,centres,particles,centreAt,analytic,step,events,vcirc,menc};
}
if(typeof module!=='undefined')module.exports=LongFallSim;
