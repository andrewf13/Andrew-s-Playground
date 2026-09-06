'use strict';
(()=>{
const T=THREE,D=SG_DATA,$=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let zone='island',selected=null,selectedLandmark=null,night=false,moving=!reduced,tourIndex=-1,renderer,scene,camera,active,frameId,last=0,time=0,ready=false,width=1,height=1;
const canvas=$('canvas'),cache=new Map(),ray=new T.Raycaster(),mouse=new T.Vector2(),projection=new T.Vector3();
const cam={yaw:.35,pitch:1.05,distance:185,toYaw:.35,toPitch:1.05,toDistance:185,target:new T.Vector3(),toTarget:new T.Vector3()};
const PAL={ground:0xe6d8a9,side:0xb18c5c,grass:0x79c951,water:0x32bace,road:0x59768a,walk:0xffedc8,roof:0xe5854e,white:0xf0e6cd,glass:0x709e9e,dark:0x244b4e,tree:0x409e50,leaf:0x81d352};
const boxGeo=new T.BoxGeometry(1,1,1),cylGeo=new T.CylinderGeometry(1,1,1,10),sphereGeo=new T.IcosahedronGeometry(1,1);
const roofShape=new T.Shape();roofShape.moveTo(-.5,0);roofShape.lineTo(0,.65);roofShape.lineTo(.5,0);roofShape.closePath();const roofGeo=new T.ExtrudeGeometry(roofShape,{depth:1,bevelEnabled:false});roofGeo.translate(0,0,-.5);
const instancedMaterial=new T.MeshLambertMaterial({color:0xffffff});
function batch(){const root=new T.Group(),groups={box:[],cyl:[],ball:[],roof:[]},labels=[],lights=[],pickers=[],actors=[];return {root,groups,labels,lights,pickers,actors,add(kind,x,y,z,sx,sy,sz,c,rot=0){groups[kind].push({x,y,z,sx,sy,sz,c,rot})},finish(){const o=new T.Object3D(),colour=new T.Color();for(const [kind,items]of Object.entries(groups)){if(!items.length)continue;const geo={box:boxGeo,cyl:cylGeo,ball:sphereGeo,roof:roofGeo}[kind];const mesh=new T.InstancedMesh(geo,instancedMaterial,items.length);items.forEach((a,i)=>{o.position.set(a.x,a.y,a.z);o.rotation.set(0,a.rot,0);o.scale.set(a.sx,a.sy,a.sz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,colour.setHex(a.c))});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;root.add(mesh)}return this}}}
function cube(b,x,y,z,w,h,d,c,rot=0){b.add('box',x,y,z,w,h,d,c,rot)}
function cyl(b,x,y,z,r,h,c){b.add('cyl',x,y,z,r,h,r,c)}
function tree(b,x,z,size=1){cube(b,x,2.1*size,z,.65*size,4.2*size,.65*size,0x92653c);cube(b,x,4.8*size,z,4.4*size,2.5*size,3.9*size,PAL.tree);cube(b,x+.5*size,6.3*size,z,3.1*size,1.7*size,2.9*size,PAL.leaf);cube(b,x-1.6*size,4.1*size,z+.4*size,1.7*size,1.7*size,2.4*size,0x58b848)}
function palm(b,x,z,s=1){cyl(b,x,3.2*s,z,.3*s,6.4*s,0x9d8562);for(let i=0;i<6;i++){let a=i*Math.PI/3;b.add('ball',x+Math.cos(a)*1.8*s,6.2*s,z+Math.sin(a)*1.8*s,2.1*s,.35*s,.75*s,0x618e6b,-a)}}
function ground(b,w=116,d=88){cube(b,0,-2.4,0,w,4.6,d,PAL.side);cube(b,0,.05,0,w,.3,d,PAL.ground);cube(b,0,-4.9,0,w-3,.5,d-3,0x6f8376)}
function road(b,x,z,w,d){cube(b,x,.31,z,w,.2,d,PAL.road);if(w>d){cube(b,x,z===0?.48:.45,z-d/2-.8,w,.3,1.5,PAL.walk);cube(b,x,.45,z+d/2+.8,w,.3,1.5,PAL.walk);for(let k=-w/2+3;k<w/2;k+=7)cube(b,x+k,.44,z,3,.03,.15,0xe8d9a2)}else{cube(b,x-w/2-.8,.45,z,1.5,.3,d,PAL.walk);cube(b,x+w/2+.8,.45,z,1.5,.3,d,PAL.walk);for(let k=-d/2+3;k<d/2;k+=7)cube(b,x,.44,z+k,.15,.03,3,0xe8d9a2)}}
function textMesh(b,label,x,y,z,w=18,colour='#244d49',bg=null,grounded=false){const c=document.createElement('canvas');c.width=1024;c.height=128;const ct=c.getContext('2d');if(bg){ct.fillStyle=bg;ct.fillRect(0,0,c.width,c.height)}ct.font='600 50px Arial';ct.fillStyle=colour;ct.textAlign='center';ct.textBaseline='middle';ct.fillText(label,512,64,970);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:tex,transparent:!bg,depthWrite:false,side:T.DoubleSide});const m=new T.Mesh(new T.PlaneGeometry(w,w/8),mat);m.position.set(x,y,z);if(grounded)m.rotation.x=-Math.PI/2;b.root.add(m);return m}
function shophouse(b,x,z,w=8,h=10,d=12,c=0xe5d4b4,front=1,sign=null){
 cube(b,x,h/2+.5,z,w-.2,h,d,c);cube(b,x,.9,z+front*(d/2+.8),w,.5,2.2,PAL.walk);cube(b,x,h*.55,z+front*(d/2+.05),w,.32,.3,PAL.white);cube(b,x,h+.5,z+front*d/2,w,.7,.5,PAL.white);b.add('roof',x,h+.8,z,w,.95,d+1,PAL.roof);
 for(let k of[-.27,.27]){cube(b,x+k*w,h*.77,z+front*(d/2+.15),w*.24,2.4,.23,0x416f69);cube(b,x+k*w,h*.77,z+front*(d/2+.28),.12,2.5,.1,PAL.white);for(let yy of[-.7,0,.7])cube(b,x+k*w,h*.77+yy,z+front*(d/2+.32),w*.24,.10,.1,0x92b5a0)}
 for(let k of[-.4,.4])cube(b,x+k*w,2.15,z+front*(d/2+.4),.35,3.5,.4,PAL.white);
 cube(b,x,2.3,z+front*(d/2+.12),w*.65,3.2,.25,PAL.dark);cube(b,x,4.35,z+front*(d/2+1.1),w-.3,.3,2.3,c===0xf4e8cb?0xa5c9a8:0xadc1a1);
 if(sign){const m=textMesh(b,sign,x,3.9,z+front*(d/2+2.28),w-.6,'#254841','#f2e8cd');if(front<0)m.rotation.y=Math.PI}
}
function tower(b,x,z,w,d,h,c=0xc3d1c3){cube(b,x,h/2+.4,z,w,h,d,c);cube(b,x,h+.8,z,w+.4,.6,d+.4,PAL.white);for(let y=3;y<h-1;y+=3){cube(b,x,y,z+d/2+.03,w*.88,1.9,.1,PAL.glass);cube(b,x+w/2+.03,y,z,.1,1.9,d*.85,0x8cb0ac)}for(let k=-w/2+1;k<w/2;k+=2.5)cube(b,x+k,h/2,z+d/2+.12,.25,h,.15,c);cube(b,x,h+1.5,z,w*.4,1.6,d*.4,0xa2b4a7)}
function cafeTables(b,x,z,n=3){for(let i=0;i<n;i++){const xx=x+i*3.4;cyl(b,xx,1.25,z,1.05,.16,0xe2d6b2);cyl(b,xx,.65,z,.13,1.2,0x4c675a);for(let a of[-1,1])cube(b,xx,.7,z+a*1.5,.8,1.25,.8,0x536e5e)}}
function light(b,x,z){cyl(b,x,3,z,.12,6,0x5e7465);cube(b,x,6.1,z,1,.35,.7,0xffedb0);const m=new T.Mesh(new T.SphereGeometry(.25,8,6),new T.MeshBasicMaterial({color:0xffdc91}));m.position.set(x,6.2,z);b.root.add(m);b.lights.push(m)}
function personMesh(colour){const g=new T.Group();const body=new T.Mesh(new T.BoxGeometry(.5,.95,.4),new T.MeshLambertMaterial({color:colour}));body.position.y=1.12;g.add(body);const head=new T.Mesh(new T.BoxGeometry(.5,.5,.5),new T.MeshLambertMaterial({color:0xccaa87}));head.position.y=1.88;g.add(head);for(let s of[-1,1]){const leg=new T.Mesh(new T.BoxGeometry(.17,.7,.23),new T.MeshLambertMaterial({color:0x385256}));leg.position.set(s*.16,.37,0);g.add(leg)}return g}
function population(b,horizontal=true,offset=0,length=95){for(let i=0;i<10;i++){const g=personMesh([0xd48c69,0x729eb0,0xe8d9b6,0xa1ba8e][i%4]);b.root.add(g);b.actors.push({mesh:g,kind:'walk',offset:offset+(i%2?1:-1)*6.3,length,t:i/10,horizontal,speed:(i%2?1:-1)*.009})}for(let i=0;i<4;i++){const g=new T.Group(),body=new T.Mesh(new T.BoxGeometry(2.1,1.2,4.1),new T.MeshLambertMaterial({color:[0xcbdad0,0xc5a56c,0x376a6d,0xe2beae][i]}));body.position.y=1;g.add(body);const top=new T.Mesh(new T.BoxGeometry(1.8,.75,2.2),new T.MeshLambertMaterial({color:0x72969c}));top.position.y=1.8;g.add(top);if(horizontal)g.rotation.y=Math.PI/2;b.root.add(g);b.actors.push({mesh:g,kind:'car',offset:offset+(i%2?1.7:-1.7),length,t:i/4,horizontal,speed:(i%2?1:-1)*.045})}}
function target(b,p,pinY){const x=p.position[0],z=p.position[2];b.labels.push({id:p.id,pos:new T.Vector3(x,pinY,z),text:p.short,number:p.number});const mesh=new T.Mesh(new T.BoxGeometry(12,pinY,14),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));mesh.position.set(x,pinY/2,z);mesh.userData.place=p.id;b.root.add(mesh);b.pickers.push(mesh);const ring=new T.Mesh(new T.RingGeometry(6.8,7.2,40),new T.MeshBasicMaterial({color:p.colour,transparent:true,opacity:.85,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.64,z);b.root.add(ring);ring.userData.place=p.id;b.actors.push({mesh:ring,kind:'ring',id:p.id})}
// A schematic voxel island: geographic shape is approximate; district spacing is expanded.
function islandPatch(b,x,z,cells,size=2,green=0x70bd50){for(const [dx,dz] of cells){cube(b,x+dx*size,-3,z+dz*size,size,5.7,size,0xc9a369);cube(b,x+dx*size,-.075,z+dz*size,size,.15,size,green)}}
function offshoreIslands(b){
 const cells=(w,d,test=()=>true)=>{const a=[];for(let x=-w;x<=w;x++)for(let z=-d;z<=d;z++)if(test(x,z))a.push([x,z]);return a};
 // Sentosa is elongated; Brani is separately visible in the harbour channel.
 islandPatch(b,-30,48,cells(8,3,(x,z)=>Math.abs(z+x*.2)<2.8&&!(x<-6&&z>0)),2,0x83ca61);
 for(let i=0;i<18;i++)tree(b,-43+i*1.45,47+Math.sin(i*.8)*2,.36);for(let x=-42;x<-15;x+=3){cube(b,x,-.15,53+(x+30)*-.15,3,.3,1.8,0xffe3a2);palm(b,x,51+(x+30)*-.15,.35)}
 for(let i=0;i<4;i++){cube(b,-37+i*5,1,46,3.7,2,3.2,[0xf5cf8b,0xf8dfb0,0xe3c9a1,0xd4b991][i]);cube(b,-37+i*5,2.2,46,4,.35,3.5,0xec8b58)}
 islandPatch(b,-24,39,cells(2,1),2,0xb4bda1);cube(b,-24,.3,39,8,.4,3,0xa6acaa);
 cube(b,-37,-.25,38.5,1.3,1,14,0xdedfc4);for(let z=33;z<45;z+=3)cube(b,-37,1,z,.4,1.7,.4,0x719b9d);
 // Smaller southern islands retain their ordering, with spacing enlarged for clarity.
 islandPatch(b,-5,65,cells(2,2,(x,z)=>Math.abs(x)+Math.abs(z)<4),1.6);
 islandPatch(b,3,62,cells(2,3,(x,z)=>!(x<0&&z<0)),1.6,0x8bcc6a);
 cube(b,-.8,-.15,64,4,.3,.7,0xeedab0);
 islandPatch(b,13,59,cells(1,2,(x,z)=>!(x<0&&z===2)),1.4,0x84c663);
 islandPatch(b,-5,55,cells(1,2),1.2);islandPatch(b,-15,60,[[0,0],[1,0],[0,1]],1.1);islandPatch(b,-12,62,[[0,0],[1,0],[1,1]],1.1);
 for(const [x,z] of[[-6,65],[3,61],[13,58],[-5,54]])tree(b,x,z,.28);
 textMesh(b,'SENTOSA',-30,3.8,51,23,'#355d4c',null,true);textMesh(b,'BRANI',-24,.2,40,8,'#426955',null,true);textMesh(b,'ST JOHN’S + LAZARUS',0,-5.25,70,25,'#dbffff',null,true);textMesh(b,'KUSU',13,.3,58,7,'#3b6550',null,true);
 // Pulau Serangoon is Coney Island, northeast off Punggol; Ubin lies farther east.
 islandPatch(b,32,-39,cells(4,0),1.8);for(let i=0;i<7;i++)tree(b,27+i*1.7,-39,.3);
 islandPatch(b,60,-39,cells(8,3,(x,z)=>!(Math.abs(x)<3&&z>1)&&Math.abs(z-x*.14)<3.7),2,0x5ba94d);
 for(let i=0;i<45;i++){const x=45+hash(i,44)*30,z=-43+hash(i,77)*6;tree(b,x,z,.3+hash(i,3)*.15)}
 cube(b,59,-.15,-36,3.5,.4,2.5,0x699fa0);cube(b,58,-.5,-30,1.2,.4,6,0xb9a67b);
 textMesh(b,'PULAU UBIN',60,3,-40,23,'#edffd9',null,true);
 // Tekong provides context beyond Changi; it is not a visitor recommendation.
 islandPatch(b,100,-40,cells(7,5,(x,z)=>!(x<-4&&z>2)&&!(x>4&&z<-2)),2,0x61a85c);
 for(let i=0;i<28;i++)tree(b,91+hash(i,24)*19,-47+hash(i,18)*13,.4);textMesh(b,'P. TEKONG',100,3,-40,24,'#deefd7',null,true);
}
function airliner(){const b=batch();
 cube(b,0,.55,0,1.1,1.15,7.5,0xf9f5e7);cube(b,0,.5,-4,.8,.8,1.3,0xf9f5e7);cube(b,0,.5,-4.65,.45,.5,.4,0xf9f5e7);cube(b,0,.85,-3.8,.8,.35,.6,0x254766);
 for(const side of[-1,1]){cube(b,side*.56,.55,.3,.04,.25,6.9,0x173b6c);cube(b,side*.59,.74,.3,.035,.08,6.9,0xe7b948);for(let i=0;i<11;i++)cube(b,side*.59,.92,-2.8+i*.5,.04,.12,.18,0x2e536d);
 for(let k=0;k<4;k++)cube(b,side*(.9+k),.1,.1+k*.45,1.3,.2,2.3-k*.4,0xdfe6e6);cube(b,side*1.5,.55,3.05,2.5,.16,1.1,0xebf1ec);
 const engine=new T.Mesh(new T.CylinderGeometry(.38,.38,1.5,8),new T.MeshLambertMaterial({color:0xe9ede8}));engine.rotation.x=Math.PI/2;engine.position.set(side*2.1,-.2,.6);b.root.add(engine);
 }
 cube(b,0,1.65,2.9,.22,2.4,1.8,0x142f64);cube(b,.14,2,2.8,.05,.22,1.2,0xf4bf44);cube(b,.14,2.25,3,.05,.35,.6,0xf4bf44);cube(b,-.14,2,2.8,.05,.22,1.2,0xf4bf44);cube(b,-.14,2.25,3,.05,.35,.6,0xf4bf44);
 for(const z of[-2.4,1.2])cube(b,0,-.55,z,.6,.4,.4,0x344152);
 for(const side of[-1,1]){const label=textMesh(b,'SINGAPORE AIRLINES',side*.61,.72,0,5.8,'#e1b449');label.rotation.y=side*Math.PI/2;}
 return b.finish().root;
}
const FLIGHT_KEYS=[[0,-1,.85,8],[.07,-1,.85,15],[.13,-6,.85,16],[.19,-6,.85,11],[.34,-6,.85,-7],[.41,-6,5,-24],[.52,5,23,-48],[.64,34,26,-31],[.75,29,20,32],[.83,-6,11,49],[.91,-6,.85,14],[.96,-6,.85,-10],[.98,-1,.85,-10],[1,-1,.85,8]];
function flightPose(t,lane=0){let i=0;while(i<FLIGHT_KEYS.length-2&&t>FLIGHT_KEYS[i+1][0])i++;const a=FLIGHT_KEYS[i],b=FLIGHT_KEYS[i+1],u=clamp((t-a[0])/(b[0]-a[0]),0,1);return {x:a[1]+(b[1]-a[1])*u+lane,y:a[2]+(b[2]-a[2])*u,z:a[3]+(b[3]-a[3])*u,yaw:Math.atan2(-(b[1]-a[1]),-(b[3]-a[3])),pitch:Math.atan2(b[2]-a[2],Math.hypot(b[1]-a[1],b[3]-a[3]))}}
function changi(b){const airport=batch();cube(airport,0,.1,0,26,.25,40,0xb0c4b9);
 for(const x of[-6,7]){cube(airport,x,.28,0,3,.2,35,0x47596d);for(let z=-15;z<16;z+=3)cube(airport,x,.4,z,.12,.03,1.6,0xfff6d3);for(let side of[-1,1])for(let z=-15;z<16;z+=4)cube(airport,x+side*1.7,.5,z,.16,.12,.16,0xffe2a0);for(let z of[-14,14])for(let xx of[-.9,-.45,.45,.9])cube(airport,x+xx,.4,z,.17,.03,1.4,0xfff6d3)}
 cube(airport,0,1.5,1,5,2.5,13,0xe9e2cb);cube(airport,0,3,1,5.5,.5,13.5,0x91c5d5);for(let z=-3;z<7;z+=3)for(let side of[-1,1])cube(airport,side*3,1.1,z,2,1,.6,0xeeeecc);
 cyl(airport,-2,4,-9,.65,8,0xe9dbc1);cyl(airport,-2,8.1,-9,1.4,1.1,0x497f97);cyl(airport,-2,8.9,-9,1.5,.4,0xf6e5bb);cube(airport,-2,10,-9,.18,2,.18,0x677f8c);
 airport.add('ball',1,2.3,11,3.1,1.5,3.1,0x9cdae0);cyl(airport,1,3,11,.55,.2,0x497f81);
 textMesh(airport,'CHANGI · SIN',0,3.4,1,13,'#285069',null,true);
 const root=airport.finish().root;root.position.set(79,.15,-4);root.rotation.y=-.25;b.root.add(root);
 for(let i=0;i<2;i++){const jet=airliner();jet.name="sia-jet";root.add(jet);b.actors.push({mesh:jet,kind:'jet',t:i?.84:.19,speed:1/80,lane:i?13:0})}

}
function marina(b){
 cube(b,13,.25,24,33,.2,16,0x30b7ca);cube(b,21,.6,25,27,.9,8,0xe3d5b4);cube(b,14,.05,16,34,.4,1.2,0xf5e1b7);cube(b,-2,.08,23,1.4,.4,16,0xf5e1b7);cube(b,30,.08,24,2,.4,17,0xf5e1b7);
 // Three tapered towers carry one long cantilevered SkyPark.
 for(const x of[14,21,28]){cube(b,x,11.5,25,4.6,23,5.2,0xc3dfdf);cube(b,x-1,6,25,2.5,12,5.8,0xe8e2ce);for(let y=2;y<23;y+=1.2){cube(b,x,y,27.65,4.3,.44,.1,0x649da8);cube(b,x+2.34,y,25,.08,.44,4.8,0x7ab1bb)}cube(b,x,12,27.75,.22,22,.1,0xf8efdb)}
 cube(b,21,24,25,26,1.7,7,0xdbc99f);cube(b,35,24.4,25,3,1,5,0xdbc99f);cube(b,8,24.4,25,2,1,5,0xdbc99f);cube(b,21,25,25,25,.3,6.5,0x74b86d);cube(b,21,25.25,26.3,19,.2,2,0x36cfdf);for(let x=10;x<34;x+=4)cube(b,x,26,23.5,.8,1.3,.8,0x3b9156);
 // Merlion: stepped fish tail, scalloped body, lion's mane, ears and a water arc.
 cube(b,3,.6,23,4,1.1,4,0xe4d9be);cube(b,3,1.6,23,2.9,1.2,2.6,0xf9f0d9);cube(b,3,2.7,23,2.1,1.5,2,0xfff7e3);cube(b,3,4,23,1.5,1.3,1.5,0xfff7e3);
 cube(b,3,5.6,23,2.9,2.7,2.6,0xe9d8ad);cube(b,3.75,5.8,23,2,1.9,2,0xfff7e4);cube(b,4.75,5.1,23,1, .65,1.1,0xfff7e4);for(const z of[22.1,23.9]){cube(b,3.2,7.1,z,.65,.7,.5,0xf5e8c9);cube(b,4.55,6.15,z,.18,.2,.2,0x293d43)}
 for(let y=1.6;y<4;y+=.6)for(let z of[22.05,23.95])cube(b,3,y,z,1.6,.14,.2,0xd4c49e);cube(b,1.5,1.4,23,2.3,.6,3,0xefe7ce);
 for(let i=0;i<18;i++){const u=i/17,x=5.2+u*7,y=5.1+u*2.8-u*u*7.8;cube(b,x,y,23,.35,.35,.35,0xccffff)}
 const spray=new T.Group();for(let i=0;i<7;i++){const drop=new T.Mesh(new T.BoxGeometry(.22,.22,.22),new T.MeshBasicMaterial({color:0xebffff}));spray.add(drop)}b.root.add(spray);b.actors.push({mesh:spray,kind:'fountain',t:0,speed:.6});
 // Tiny park connectors and a Supertree silhouette behind the bay.
 for(let i=0;i<4;i++){const x=35+i*3.4,z=25+(i%2)*5;cube(b,x,3,z,.65,6,.65,0x996985);cyl(b,x,6.3,z,2,.7,0x986c9d);cyl(b,x,6.8,z,1.5,.4,0x79b977)}
 textMesh(b,'MARINA BAY',14,.1,19,19,'#effff6',null,true);
}
function anchorage(b){const colours=[0xe8704b,0xebc85a,0x51aeb6,0x5f739e,0xf3d8a0];for(let i=0;i<23;i++){
 const ship=batch(),tanker=i%3===0;cube(ship,0,.05,0,7,.9,2.6,0x274e71);cube(ship,0,.62,0,6.2,.3,2.4,tanker?0xba6748:0xeacb91);cube(ship,-2,1.2,0,1.4,1.2,2,0xf4efdb);if(tanker){for(let x=0;x<3;x++)cyl(ship,x,1.05,0,.65,.5,0xc39365)}else for(let k=0;k<3;k++)cube(ship,k*1.3,.99,0,1.1,.5,1.8,colours[(i+k)%5]);
 if(i>=21)cube(ship,-5,-.35,0,3,.04,1.3,0xd1ffff);const g=ship.finish().root;g.name=i<21?"anchored-ship":"transit-ship";b.root.add(g);if(i<21){const x=39+(i%7)*10+(Math.floor(i/7)%2)*3,z=35+Math.floor(i/7)*11+(i%3);g.position.set(x,-4.9,z);g.rotation.y=-.3+(i%4)*.16;b.actors.push({mesh:g,kind:'anchored',x,z,y:-4.9,heading:g.rotation.y,t:i/21,speed:.02})}else{b.actors.push({mesh:g,kind:'boat',offset:72+(i-21)*3,length:180,t:i*.13%1,horizontal:true,speed:(i%2?1:-1)*.006,baseY:-4.9})}
 }textMesh(b,'SOUTHEAST ANCHORAGE',69,-5.25,66,44,'#dcffff',null,true)}
function everydayLife(b){
 // A neighbourhood court, HDB homes and community greenery.
 cube(b,-60,.15,-10,12,.2,7,0x4cadad);for(const x of[-65,-55]){cube(b,x,.3,-10,.15,.05,6,0xf5f2d9);cube(b,x,2,-10,.16,3.5,.16,0x426978);cube(b,x,3.8,-10,.25,1.3,1.5,0xfff4ce)}cube(b,-60,.3,-10,.15,.03,6,0xf5f2d9);
 for(let i=0;i<4;i++){const person=personMesh([0xeac342,0xe47667,0x6eadd7,0xf9e8c7][i]);person.position.set(-63+i*2,0,-9+(i%2)*2);person.scale.setScalar(.7);b.root.add(person)}
 for(let i=0;i<6;i++){const bus=batch();cube(bus,0,1.1,0,4.1,1.8,1.8,i%2?0x82cc42:0xe45857);cube(bus,0,1.7,0,3.5,.65,1.85,0x497b97);for(const x of[-1.3,1.3])cube(bus,x,.3,0,.6,.6,2,0x344556);const root=bus.finish().root;b.root.add(root);b.actors.push({mesh:root,kind:'bus',offset:3+(i%2?.7:-.7),length:97,t:i/6,horizontal:true,speed:(i%2?1:-1)*.019})}
 // Botanic Gardens in the central-west; Mandai in the north.
 cube(b,-48,.15,-8,12,.3,12,0x76c353);for(let i=0;i<15;i++)tree(b,-53+hash(i,40)*10,-12+hash(i,41)*8,.4);
 cube(b,-26,.2,-32,11,.4,6,0x537f55);b.add('roof',-26,2,-32,10,1.2,6,0xa68254);for(let i=0;i<10;i++)tree(b,-32+hash(i,60)*13,-35+hash(i,61)*6,.5);
}
function gardens(){const b=batch();ground(b);cube(b,0,.3,0,112,.3,84,0x81bd59);
 for(let i=0;i<110;i++){const x=-53+hash(i,39)*106,z=-39+hash(i,14)*78;if(Math.hypot(x+12,z)<13||Math.abs(x-z*.4)<5||Math.hypot(x-30,z+17)<11)continue;tree(b,x,z,.7+hash(i,11)*.8)}
 for(let z=-40;z<42;z+=3)cube(b,z*.4,.55,z,4,.25,3.2,0xf0d9a4);
 cyl(b,30,.5,-17,11,.3,0x48b9bf);cyl(b,30,.7,-17,8,.2,0x62cdd0);cube(b,29,1,-16,1,.55,1.7,0xfff6e4);cube(b,29,1.65,-16.7,.4,1,.4,0xfff6e4);
 cyl(b,-12,.8,0,7,.6,0xf7e9c5);for(let i=0;i<8;i++){const a=i*Math.PI/4;cube(b,-12+Math.cos(a)*5,3.6,Math.sin(a)*5,.4,5.5,.4,0xfff3dc)}const roof=new T.Mesh(new T.ConeGeometry(7,3,8),new T.MeshLambertMaterial({color:0xf2e1b7}));roof.position.set(-12,7,0);b.root.add(roof);
 for(let i=0;i<15;i++){const x=-30+(i%5)*3,z=22+Math.floor(i/5)*3;cube(b,x,1,z,.3,1.5,.3,0x3c9654);b.add('ball',x,2,z,.8,.6,.8,[0xd982d8,0xf7c87f,0xf8efde][i%3])}
 for(let z=-30;z<35;z+=16){cube(b,z*.4+6,1,z,3,.4,1,0xa18558);cube(b,z*.4+6,1.7,z+.5,3,1,.25,0xa18558)}
 textMesh(b,'SINGAPORE BOTANIC GARDENS',0,.8,37,64,'#355f3e',null,true);target(b,D.places.find(p=>p.id==='botanic-gardens'),11);return b.finish()}
function animal(b,x,z,type='tapir'){const c=type==='tapir'?0x344b50:0xb58b55;cube(b,x,1.7,z,3.5,2,1.5,c);if(type==='tapir')cube(b,x,1.7,z,1.8,2.04,1.54,0xe3dfd0);cube(b,x-2,2,z,1.3,1.3,1.2,c);cube(b,x-2.6,1.6,z,.7,.5,.7,c);for(const xx of[-1.2,1.2])for(const zz of[-.5,.5])cube(b,x+xx,.65,z+zz,.45,1.3,.45,c);for(const zz of[-.4,.4])cube(b,x-2,2.9,z+zz,.4,.6,.4,c)}
function mandai(){const b=batch();ground(b);cube(b,0,.3,0,114,.3,86,0x537a51);
 for(let i=0;i<100;i++){const x=-53+hash(i,39)*106,z=-40+hash(i,14)*80;if(Math.abs(z-17)<8||Math.hypot(x+22,z-16)<13||Math.hypot(x-22,z+8)<13)continue;tree(b,x,z,.9+hash(i,11)*.9)}
 cube(b,0,.6,17,108,.2,5,0xa39976);cube(b,-23,.5,4,4,.3,35,0xa39976);cube(b,22,.5,0,3,.3,28,0xa39976);
 for(let x=-49;x<52;x+=10){cube(b,x,1.5,13,.35,2.5,.35,0x786844);light(b,x,21)}
 cube(b,-22,3,16,18,5,8,0x97704c);b.add('roof',-22,6,16,22,3,11,0x574c43);textMesh(b,'NIGHT SAFARI',-22,4.4,20.2,17,'#ffe2a1','#33463e');
 animal(b,21,-7);animal(b,31,-14);animal(b,-8,-19,'deer');animal(b,3,-21,'deer');cube(b,30,.6,-23,14,.3,7,0x4b9aa7);
 const tram=batch();for(let i=0;i<3;i++){cube(tram,-i*6,1.2,0,5,1.3,2.5,0xd6ad69);cube(tram,-i*6,3,0,5.5,.35,3,0x9f7745);for(const x of[-2,2])cube(tram,-i*6+x,2.2,0,.2,1.8,2.4,0xe4c887);for(const x of[-1.6,1.6])cube(tram,-i*6+x,.5,0,.6,.7,2.7,0x35403e)}const root=tram.finish().root;b.root.add(root);b.actors.push({mesh:root,kind:'tram',offset:17,length:84,t:.65,horizontal:true,speed:.014});
 textMesh(b,'MANDAI · AFTER DARK',6,.9,36,52,'#efddb0',null,true);target(b,D.places.find(p=>p.id==='night-safari'),11);return b.finish()}

function island(){
 const b=batch(),outline=[[-87,7],[-80,-7],[-66,-18],[-49,-31],[-24,-38],[0,-37],[24,-30],[45,-29],[65,-20],[74,-24],[88,-24],[96,-11],[96,7],[85,17],[62,19],[39,23],[20,28],[1,29],[-14,36],[-32,33],[-49,27],[-65,23],[-78,16]];
 const inside=(x,z)=>{let yes=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],q=outline[j];if((a[1]>z)!==(q[1]>z)&&x<(q[0]-a[0])*(z-a[1])/(q[1]-a[1])+a[0])yes=!yes}return yes};
 cube(b,0,-7.3,0,246,3,158,0x167da9);cube(b,0,-5.65,0,242,.3,154,0x25b9d2);
 for(let x=-90;x<=100;x+=5)for(let z=-40;z<=40;z+=5){if(!inside(x,z))continue;const coast=!inside(x-5,z)||!inside(x+5,z)||!inside(x,z-5)||!inside(x,z+5);cube(b,x,-3,z,5,5,5,coast?0xc99252:0xa37648);cube(b,x,-.25,z,5,.5,5,coast?0xf4d482:[0x72c54b,0x79ce50,0x67bc46][Math.floor(hash(x,z)*3)%3]);if(coast)cube(b,x,-5.25,z,7,.6,7,0x63d9d4)}
 // Woodland and stepped central hills.
 for(let i=0;i<125;i++){const x=-69+hash(i,9)*121,z=-33+hash(i,21)*20;if(inside(x,z)&&!(x>-22&&x<13&&z>-33&&z<-17))tree(b,x,z,.42+hash(i,7)*.32)}
 for(let level=0;level<4;level++)cube(b,-37,level*1.5+.7,-22,24-level*5,1.5,16-level*3,[0x50ab47,0x60b84b,0x76c355,0x8fd866][level]);for(let i=0;i<8;i++)tree(b,-44+i*2,-24,.48);
 cube(b,-5,.1,-25,25,.3,11,0x23a7bc);cube(b,-5,.12,-24,19,.35,7,0x2bb9cd);for(let i=0;i<4;i++)cube(b,-14+i*5,.33,-23,2,.04,.25,0x9de9e6);
 function route(x1,z1,x2,z2,w=2.4){const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),r=-Math.atan2(dz,dx);cube(b,(x1+x2)/2,.22,(z1+z2)/2,len,.2,w,0x516d80,r);for(let i=2;i<len;i+=5)cube(b,x1+dx*i/len,.35,z1+dz*i/len,1.7,.03,.13,0xffe6a0,r)}
 route(-73,8,-48,3);route(-48,3,2,3);route(2,3,62,4);route(-48,3,-44,24);route(-44,24,-13,27);route(-13,27,2,3);route(2,3,-2,-12);route(2,3,25,13);route(25,13,62,4);
 const colours=[0xffcf56,0xee8f79,0x5fc9c0,0xb39ae5,0xcde8f2,0xf2e9cf];
 for(let x=-72;x<77;x+=8)for(let z=-9;z<20;z+=9){if(!inside(x,z)||Math.abs(z-3)<4||Math.abs(x)<9||Math.abs(x+44)<10||x>62||(x>0&&x<40&&z>12)||(x<-42&&x>-57&&z<0)||(x>-69&&x<-52&&z<0))continue;const h=3+hash(x,z)*8;tower(b,x,z,4.8,4.8,h,colours[Math.floor(hash(x+2,z)*6)%6]);}
 // Each stop has a distinct miniature silhouette, enlarged to be discoverable.
 cube(b,-38,.6,1,15,1,11,0xf4dfa4);for(let x=-44;x<-30;x+=3){cube(b,x,2,0,2.5,2,3,0xf2a845);cube(b,x,3.6,0,2.7,.6,3.5,0xf26748)}tower(b,-34,-10,5,6,16,0xffe8b3);
 for(let i=0;i<4;i++){shophouse(b,-24+i*6,23,5.8,5.5,7,colours[i],1);tower(b,-25+i*6,14,4.2,4.5,13+i*3,0x92c7df)}
 for(let i=0;i<4;i++)shophouse(b,44+i*6,10,5.7,5.2,7,colours[(i+1)%6],1);for(let i=0;i<6;i++)palm(b,43+i*5,18,.45);
 deco(b,-48,20,12,8,6);deco(b,-60,16,10,6,6);cube(b,-49,4,12,11,1,7,0xfaac48);
 for(let i=0;i<4;i++)shophouse(b,-8+i*5,-12,4.8,6,6,[0xf4b842,0xcd7bd8,0x58c6bf,0xff886c][i],1);
 cube(b,26,2,1,15,4,8,0xffdb70);tower(b,30,-5,6,6,15,0x5cc7cf);for(let i=0;i<4;i++)cube(b,20+i*3,4.4,5,2.6,.8,.5,[0xeb6564,0xffffff,0x576fc9,0xeb6564][i]);
 // Port stacks and offshore islands add life without sightseeing destinations.
 for(let i=0;i<4;i++){const x=-67+i*7;cube(b,x,-2,32,8,5,6,0xd4b370);for(let j=0;j<3;j++)cube(b,x,1+j*.75,32,5,.7,2.2,colours[(i+j)%6])}
 offshoreIslands(b);changi(b);marina(b);everydayLife(b);
 for(let i=0;i<50;i++){const x=-113+hash(i,33)*226,z=-66+hash(i,82)*130;if(!inside(x,z)&&Math.abs(z)>38)cube(b,x,-5.35,z,2+hash(i,7)*3,.035,.25,0x9be8ee)}
 // Raised miniature rail, not a representation of an actual MRT alignment.
 cube(b,0,2.1,-5,128,.65,1.5,0xc7e6ec);for(let x=-61;x<65;x+=10)cube(b,x,1,-5,.7,2,.7,0x7299ae);for(let z of[-5.45,-4.55])cube(b,0,2.55,z,128,.12,.12,0x456379);
 const train=new T.Group();for(let i=0;i<3;i++){const g=batch();cube(g,-i*5,3.5,0,4.7,1.5,1.4,0xfaf2d4);cube(g,-i*5,3.2,.72,4.7,.3,.05,0xec5d49);cube(g,-i*5,3.9,.73,3.8,.5,.04,0x305a75);train.add(g.finish().root)}b.root.add(train);b.actors.push({mesh:train,kind:'train',offset:-5,length:103,t:.25,horizontal:true,speed:.018});
 anchorage(b);
 for(let i=0;i<3;i++){const cloud=batch();cube(cloud,0,0,0,9,1.7,4,0xffffff);cube(cloud,1,1,0,5,1.8,3.5,0xffffff);const root=cloud.finish().root;b.root.add(root);b.actors.push({mesh:root,kind:'cloud',offset:-54-i*7,length:190,t:i/3,horizontal:true,speed:.002,baseY:22+i*3});}
 textMesh(b,'S I N G A P O R E',-65,-5.32,63,45,'#e3ffff',null,true);textMesh(b,'JOHOR STRAIT',-55,-5.32,-49,30,'#c3ffff',null,true);
 const pins=[{id:'river',x:-37,z:0,y:8,number:'RV'},{id:'central',x:-13,z:25,y:10,number:'TA'},{id:'katong',x:56,z:11,y:9,number:'KT'},{id:'tiong',x:-49,z:21,y:9,number:'TB'},{id:'india',x:0,z:-13,y:11,number:'LI'},{id:'golden',x:26,z:2,y:10,number:'GM'},{id:'gardens',x:-48,z:-8,y:9,number:'BG'},{id:'mandai',x:-26,z:-32,y:8,number:'NS'}];
 for(const p of pins){const district=D.zones.find(z=>z.id===p.id),pos=new T.Vector3(p.x,p.y,p.z);cube(b,p.x,p.y/2,p.z,.35,p.y,.35,0xfff2bc);cube(b,p.x,p.y-1,p.z,3.3,2.5,.7,new T.Color(district.colour).getHex());b.labels.push({id:p.id,pos,text:district.short,number:p.number,district:true});const hit=new T.Mesh(new T.BoxGeometry(12,12,12),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.copy(pos);hit.userData.zone=p.id;b.root.add(hit);b.pickers.push(hit)}
 for(const l of D.landmarks){const pos=new T.Vector3(l.position[0],l.pinY,l.position[2]);b.labels.push({id:l.id,pos,text:l.short,number:l.badge,landmark:true});const hit=new T.Mesh(new T.BoxGeometry(9,l.pinY,9),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.set(pos.x,l.pinY/2,pos.z);hit.userData.landmark=l.id;b.root.add(hit);b.pickers.push(hit)}
 return b.finish();
}
function deco(b,x,z,w=17,d=12,h=10){
 cube(b,x,h/2+.5,z,w,h,d,0xffefce);cube(b,x+w/2-1,h/2+.5,z+d/2-1,3,h,3,0xffefce);
 for(let y=3;y<h;y+=3){cube(b,x,y,z+d/2+.25,w+1,.5,1.2,0xeacba2);for(let xx=-w/2+1.5;xx<w/2;xx+=3)cube(b,x+xx,y-1.25,z+d/2+.15,1.8,1.5,.25,0x42a5a6);cube(b,x+w/2+.1,y-1,z,.25,1.8,d*.75,0x7cc4bf)}
 cube(b,x,h+.7,z,w+1,.65,d+1,0xfef7e7);cube(b,x,h+1.1,z,w-1,.25,d-1,0xd6b78b);for(let i=0;i<3;i++)cube(b,x-w/2+2+i*.7,h-1.2,z+d/2+.3,.22,3,.3,0xdfa370);
}
function tiong(){const b=batch();ground(b);road(b,4,0,9,85);road(b,0,11,114,8);
 // Market cutaway: wet-market stalls below, hawker tables on the upper deck.
 cube(b,-25,.8,-14,35,1.2,26,0xdcd0ab);for(let x=-40;x<-8;x+=5)for(let z of[-25,-4])cube(b,x,4,z,.5,7,.5,0xf0d79b);
 for(let i=0;i<6;i++){cube(b,-39+i*5,1.9,-22,4.3,1.3,3,0x50b9af);for(let j=0;j<3;j++)cube(b,-40+i*5+j,2.7,-21.3,.8,.6,1,[0xffb63f,0x8fcd43,0xe57552][j])}
 cube(b,-25,4.8,-14,35,.6,26,0xf4ddad);for(let i=0;i<6;i++){cube(b,-39+i*5,6.5,-23,4.4,2.5,3,0xf1aa47);cube(b,-39+i*5,8.1,-23,4.6,.6,3.4,[0xeb7252,0x47bda9,0xeacb51][i%3]);cafeTables(b,-39+i*5,-12,1)}
 // Raise upper-floor table groups into the cutaway using a separate miniature batch.
 const tables=batch();for(let i=0;i<5;i++)cafeTables(tables,-37+i*5,-10,1);tables.finish().root.position.y=4.9;b.root.add(tables.root);
 for(let x=-41;x<-8;x+=6)cube(b,x,7.1,-3,.4,4,.4,0xffedc3);cube(b,-25,9.7,-23,36,.8,8,0xf2943c);textMesh(b,'TIONG BAHRU MARKET',-25,8.3,-.5,30,'#3c6045','#fff0b5');
 for(let i=0;i<3;i++){deco(b,22+i*12,-20,10,18,10);deco(b,-40+i*17,28,15,13,10)}deco(b,29,29,25,15,12);for(let i=0;i<8;i++){tree(b,-49+i*14,6,.7);light(b,-48+i*14,17)}
 cube(b,35,.5,1,29,.3,10,0x81c660);for(let x=24;x<50;x+=6)tree(b,x,1,.8);textMesh(b,'SENG POH ROAD',4,.65,2,23,'#fff0c8',null,true).rotation.z=Math.PI/2;textMesh(b,'TIONG POH / ENG HOON STREETS',1,.65,40,51,'#376351',null,true);population(b,true,11,105);target(b,D.places.find(p=>p.id==='tiong-market'),13);return b.finish()}
function india(){const b=batch();ground(b);road(b,0,0,114,9);road(b,37,0,7,84);const colours=[0xffba4c,0xc58dda,0x57c8be,0xf78368,0x8bbbe5,0xf1d65a];
 for(let i=0;i<8;i++){const x=-44+i*9;shophouse(b,x,-14,8.8,11+(i%2),15,colours[i%6],1);shophouse(b,x,20,8.8,10,14,colours[(i+2)%6],-1)}
 textMesh(b,'THE BANANA LEAF APOLO',-26,4.5,-5.65,17,'#fff5cf','#2d785c');textMesh(b,'JAGGI’S',10,4.5,-5.65,8,'#fff1bd','#a33f60');
 // Cloth awnings, flower garlands and little market counters.
 for(let i=0;i<7;i++){let x=-45+i*11;cube(b,x,4,10,5,.3,3,colours[(i+3)%6]);cube(b,x,1.7,10,4,1.5,1.8,0xac6846);for(let j=0;j<5;j++)cube(b,x-1.8+j*.85,2.7,10,.6,.6,.6,[0xf5be36,0xe874aa,0xffffff][j%3]);tree(b,x,-29,.7)}
 for(let x=-48;x<30;x+=8){cube(b,x,7,4,.12,7,.12,0x53756a);for(let k=0;k<5;k++)cube(b,x+k*1.3,7-Math.sin(k/4*Math.PI)*.8,4,.65,.65,.18,colours[(k+2)%6])}for(let x=-47;x<45;x+=16)light(b,x,6);
 textMesh(b,'RACE COURSE ROAD',-5,.65,0,43,'#fff0c3',null,true);population(b,true,0,106);for(const p of D.places.filter(p=>p.zone==='india'))target(b,p,16);return b.finish()}
function golden(){const b=batch();ground(b);road(b,0,0,114,10);road(b,4,0,7,85);
 // Beach Road / City Gate and Lavender / Aperia are deliberately compressed.
 tower(b,-28,25,30,16,26,0x9fd8d8);cube(b,-28,3.1,15,31,5,6,0xf3d488);cube(b,-28,3.5,11.8,25,3,.2,0x315f6b);textMesh(b,'DIANDIN LELUK · CITY GATE',-27,6.4,11.6,28,'#fff4d6','#bf593b');cafeTables(b,-39,9,5);
 cube(b,29,7,-22,38,14,29,0xc3e7e8);tower(b,40,-28,13,13,32,0x67b1c3);for(let y=4;y<14;y+=4)cube(b,29,y,-7.35,36,2.5,.3,0x438a9f);cube(b,29,2.7,-5.7,30,4,3,0xf1c567);textMesh(b,'IM-EM · APERIA',28,4.3,-4,21,'#fff4db','#486383');
 for(let i=0;i<5;i++)shophouse(b,-46+i*9,-22,8.7,10,16,[0xefaa65,0x66beb4,0xf4d878,0xea9297,0xb6a1d1][i],1);
 for(let i=0;i<4;i++)shophouse(b,17+i*10,26,9.5,10,15,[0xf4d283,0xe69f7f,0x8bcbd1,0xc3dc8b][i],-1);
 for(let x=-50;x<55;x+=12){palm(b,x,7, .8);light(b,x,-7)}for(let x=-48;x<-10;x+=7)tree(b,x,39,.8);
 textMesh(b,'BEACH ROAD / LAVENDER',-1,.65,0,49,'#fff4cf',null,true);textMesh(b,'NEW ADDRESSES · SAME FOOD COMMUNITY',0,.65,-38,69,'#3d695c',null,true);population(b,true,0,107);for(const p of D.places.filter(p=>p.zone==='golden'))target(b,p,18);return b.finish()}

function river(){const b=batch();ground(b);road(b,10,0,10,86);road(b,0,-35,114,7);cube(b,-35,.28,29,43,.15,10,PAL.water);cube(b,-35,.50,22.5,43,.3,2.1,PAL.walk);cube(b,-35,.45,36,43,.3,2.1,PAL.walk);cube(b,-6,.85,29,7,1.5,14,0xd6cfb5);for(let x=-9;x<-2;x+=1.8)cube(b,x,1.8,29,.15,1.3,14,0x728679);
 // Open-sided hawker centre with a deliberately cutaway roof.
 cube(b,-32,.8,16,29,1,13,0xe5d8b7);for(let x=-44;x<=-20;x+=4)for(let z of[10,21])cube(b,x,3,z,.4,4.5,.4,0xd7cba7);
 for(let x=-43;x<=-23;x+=5){cube(b,x,2.5,11,4.4,3,2.2,0x648a7a);cube(b,x,4.2,11.2,4.5,.7,2.5,0xe2be76);cafeTables(b,x,17,1)}
 b.add('roof',-32,5.8,10,30,1.8,5,0xa97652);textMesh(b,'ZION RIVERSIDE',-32,4.8,23.1,23,'#355345','#f5e4b9');
 for(let i=0;i<5;i++)tree(b,-48+i*7,38,.8);for(let i=0;i<4;i++)tree(b,-49+i*10,-7,.8);
 // Orchard's contemporary hotel massing, including a small Level 2 bar cutaway.
 tower(b,29,-22,22,17,29,0xdbd5bd);cube(b,27,3.5,-11.7,23,6,4,0xbaa16b);cube(b,27,4.4,-9.55,18,3,.18,0x365558);cube(b,27,2.9,-8,18,.5,2,0x694e3e);for(let x=20;x<37;x+=3)cyl(b,x,1.6,-6.7,.6,1.1,0x846344);textMesh(b,'MANHATTAN · LEVEL 2',27,6.4,-9.35,21,'#f3d59a','#344b4a');
 for(let x of[15,41])palm(b,x,-8,1);for(let i=0;i<3;i++)tower(b,-40+i*17,-23,11,10,18+i*5,0xbbc9b7);for(let i=0;i<3;i++)tower(b,28+i*11,22,8,10,13+i*3,0xc9d2bd);for(let z=-28;z<32;z+=15){tree(b,1,z,.8);light(b,18,z)}
 textMesh(b,'ZION ROAD',-2,.6,7,17,'#34574b',null,true);textMesh(b,'ORCHARD / CUSCADEN',31,.65,-37,29,'#34574b',null,true);textMesh(b,'ALEXANDRA CANAL',-32,.52,30,28,'#376c67',null,true);population(b,false,10,72);for(const p of D.places.filter(p=>p.zone==='river'))target(b,p,p.id==='manhattan'?34:9);return b.finish()}
function central(){const b=batch();ground(b);road(b,0,0,114,8);road(b,6,0,8,85);const colours=[0xe8dac0,0xb5c5ac,0xe4c5ac,0xf0ddc1,0x9dbaba];
 for(let i=0;i<5;i++){let x=-46+i*8;shophouse(b,x,-14,8,11,15,colours[i],1,x===-22?'MEATSMITH':null)}
 // Meatsmith frontage and pavement tables.
 cube(b,-22,2.7,-5.8,7.6,4.2,.35,0x3d4541);textMesh(b,'MEATSMITH',-22,4.15,-5.5,7.1,'#f8ddbc','#3d4541');cafeTables(b,-28,-3.8,3);
 for(let i=0;i<5;i++){let x=17+i*8;shophouse(b,x,18,8,9.5,15,colours[(i+2)%5],-1,x===25?'BIRDS OF PARADISE':null)}
 textMesh(b,'BIRDS OF PARADISE',25,4.2,9.1,7.5,'#355e4c','#eee8d5').rotation.y=Math.PI;
 for(let i=0;i<4;i++){shophouse(b,-43+i*10,23,9,9,12,colours[i],-1);tower(b,18+i*10,-29,8,9,25+i*7,0xbaccc3)}
 cube(b,42,.5,36,18,.3,10,0x8fa67b);for(let x=36;x<53;x+=5)tree(b,x,35,.9);for(let x=-46;x<53;x+=16){tree(b,x,-5.4,.7);light(b,x,5.9)}
 textMesh(b,'TELOK AYER STREET',-29,.60,1,30,'#efe8ce',null,true);textMesh(b,'CRAIG ROAD',31,.65,5.9,24,'#37554b',null,true);textMesh(b,'CENTRAL SHOPHOUSES',-18,.5,-35,34,'#547567',null,true);population(b,true,0,108);for(const p of D.places.filter(p=>p.zone==='central'))target(b,p,p.id==='meatsmith'?15:13);return b.finish()}
function katong(){const b=batch();ground(b);road(b,0,-3,114,9);road(b,31,0,7,83);const colours=[0xb3c9ad,0xe1b7a2,0xf0dfbb,0x9ebec0,0xe6c89f,0xb7b6ce];
 for(let i=0;i<7;i++){const x=-44+i*9;shophouse(b,x,8,8.8,10+(i%2)*1.5,13,colours[i%6],-1,x===-8?'BIRDS OF PARADISE':null);for(let k of[-.28,.28])cube(b,x+k*8.8,8,1.2,.8,.35,.3,0xf7eacf)}
 for(let i=0;i<8;i++)shophouse(b,-45+i*12,-19,10,12,15,colours[(i+2)%6],1);
 for(let i=0;i<4;i++){shophouse(b,-40+i*16,30,11,9,11,colours[(i+3)%6],-1);tree(b,-33+i*16,20,.85)}
 tower(b,45,22,13,12,25,0xd6dac3);tower(b,47,-27,12,13,20,0xccd4c0);for(let x=-49;x<47;x+=14){palm(b,x,-8.7,.75);light(b,x,3)}cafeTables(b,-17,0,2);
 textMesh(b,'EAST COAST ROAD',-12,.65,-3,39,'#f0e6cb',null,true);textMesh(b,'K A T O N G',-8,.5,40,36,'#487361',null,true);population(b,true,-3,108);target(b,D.places.find(p=>p.id==='bop-katong'),15);return b.finish()}
function hash(x,z){return (Math.sin(x*12.9898+z*78.233)*43758.5453)%1*.5+.5}
function makeZone(id){if(!cache.has(id))cache.set(id,({island,river,central,katong,tiong,india,golden,gardens,mandai}[id])());return cache.get(id)}
function rebuildPins(){const holder=$('pins');holder.replaceChildren();if(!active)return;for(const p of active.labels){const el=document.createElement('button');el.className='pin'+(p.district||p.landmark?' district-pin':'')+(p.landmark?' landmark-pin':'')+(p.id===selected?' selected':'');el.innerHTML='<b>'+p.number+'</b><span>'+p.text+'</span>';el.title=p.text;el.setAttribute('aria-label',p.district?'Explore '+p.text:'View '+p.text);el.onclick=()=>p.district?setZone(p.id):p.landmark?selectLandmark(p.id):selectPlace(p.id);holder.appendChild(el);p.el=el}}
function updatePins(){if(!active)return;for(const p of active.labels){projection.copy(p.pos).project(camera);const x=(projection.x*.5+.5)*width,y=(-projection.y*.5+.5)*height;const off=projection.z>1||projection.z< -1||x<25||x>width-25||y<75||y>height-85;p.el.hidden=off;p.el.style.left=x+'px';p.el.style.top=y+'px';p.el.classList.toggle('selected',p.id===(selectedLandmark||selected))}}
function renderList(){const places=zone==='island'?D.places:D.places.filter(p=>p.zone===zone);$('places').innerHTML='';for(const p of places){const b=document.createElement('button');b.className='place';b.setAttribute('aria-pressed',String(p.id===(selectedLandmark||selected)));b.innerHTML='<span class="num">'+p.number+'</span><span><strong>'+p.short+'</strong><small>'+p.type+'</small></span><span class="arrow">↗</span>';b.onclick=()=>selectPlace(p.id);$('places').appendChild(b)}}
function renderLandmarks(){const holder=$('landmarkList');holder.innerHTML='';$('landmarkSection').hidden=zone!=='island';for(const l of D.landmarks){const el=document.createElement('button');el.className='place';el.innerHTML='<span class="num">'+esc(l.badge)+'</span><span><strong>'+esc(l.short)+'</strong><small>Island landmark</small></span>';el.onclick=()=>selectLandmark(l.id);holder.appendChild(el)}}
function selectLandmark(id){const l=D.landmarks.find(l=>l.id===id);if(!l)return;if(zone!=='island')setZone('island');selected=null;selectedLandmark=id;$('browse').hidden=true;$('detail').hidden=false;$('detail').innerHTML='<button class="back-list" id="backLandmarks">← Back to the island list</button><div class="tag">Around the island</div><h2>'+esc(l.short)+'</h2><p class="description">'+esc(l.description)+'</p><div class="section"><h3>In the miniature</h3><p>'+esc(l.note)+'</p></div><div class="sources"><a href="'+l.source+'" target="_blank" rel="noopener noreferrer">'+esc(l.sourceLabel)+' ↗</a></div><a class="primary" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(l.query)+'" target="_blank" rel="noopener noreferrer">Find it on Google Maps ↗</a>';$('backLandmarks').onclick=()=>setZone('island');if(ready){cam.toTarget.set(l.position[0],Math.min(9,l.pinY*.25),l.position[2]);cam.toDistance=l.id==='changi'?112:width<650?105:78;cam.toPitch=.85;renderNeeded=true}$('sidebar').scrollTop=0;$('status').textContent=l.short+'. '+l.description;try{history.replaceState(null,'','#landmark='+l.id)}catch(e){}}
function syncZoneUI(){const z=D.zones.find(z=>z.id===zone);$('zoneKicker').textContent=z.kicker;$('zoneTitle').textContent=z.name;$('zoneIntro').textContent=z.intro;for(const b of $('zones').children)b.setAttribute('aria-pressed',String(b.dataset.zone===zone));renderList();renderLandmarks()}
function homeCamera(){cam.toTarget.set(zone==='island'?5:0,0,0);cam.toYaw=zone==='island'?.10:.38;cam.toPitch=zone==='island'?1.02:.87;cam.toDistance=zone==='island'?Math.max(192,270/Math.max(.65,width/height)):135;if(width<650&&zone!=='island')cam.toDistance*=1.12}
function setZone(id,keepSelection=false){if(!D.zones.some(z=>z.id===id))return;zone=id;if(id==='mandai')night=true;if(!keepSelection){selected=null;selectedLandmark=null;$('browse').hidden=false;$('detail').hidden=true}if(ready){if(active)scene.remove(active.root);active=makeZone(id);scene.add(active.root);updateActors(0);rebuildPins();homeCamera();syncLighting()}syncZoneUI();$('status').textContent='Exploring '+D.zones.find(z=>z.id===id).name;renderNeeded=true}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mapLink(p){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.name+' '+p.address)}
function selectPlace(id){const p=D.places.find(p=>p.id===id);if(!p)return;selectedLandmark=null;if(zone!==p.zone)setZone(p.zone,true);selected=id;$('browse').hidden=true;$('detail').hidden=false;const pair=D.places.find(x=>x.id===p.pair);
 $('detail').innerHTML='<button class="back-list" id="backList">← All places in this neighbourhood</button><div class="tag">'+esc(p.type)+' / '+esc(p.occasion)+'</div><h2>'+esc(p.name)+'</h2><p class="description">'+esc(p.description)+'</p><div class="personal"><span class="label">'+esc(p.tag)+'</span><p>'+esc(p.note)+'</p></div><div class="section"><h3>Find it</h3><p>'+esc(p.address)+'</p></div><a class="primary" href="'+mapLink(p)+'" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a><div class="section"><h3>When to go</h3><p>'+esc(p.hours)+'</p></div><div class="section"><h3>'+esc(p.orderLabel||'On the menu')+'</h3><p>'+esc(p.order)+'</p></div><div class="section"><h3>Before you go</h3><p>'+esc(p.tip)+'</p></div><div class="section"><h3>Make an outing of it</h3><p>'+esc(p.pairText)+'</p><button class="secondary" id="pair">'+esc(pair.short)+'<span>↗</span></button></div><div class="sources"><a href="'+p.source+'" target="_blank" rel="noopener noreferrer">'+esc(p.sourceLabel)+' ↗</a><a href="'+p.extraSource+'" target="_blank" rel="noopener noreferrer">'+esc(p.extraLabel)+' ↗</a><span class="checked">Details checked '+D.checked+'. Hours and menus may change; this is not live opening status.</span></div>';
 $('backList').onclick=()=>{selected=null;$('browse').hidden=false;$('detail').hidden=true;renderList();homeCamera();renderNeeded=true};$('pair').onclick=()=>selectPlace(p.pair);renderList();if(ready){cam.toTarget.set(p.position[0]*.55,3,p.position[2]*.55);cam.toDistance=width<650?126:110;cam.toPitch=.92;renderNeeded=true}$('sidebar').scrollTop=0;$('status').textContent=p.name+'. '+p.type+'. '+p.address;try{history.replaceState(null,'','#place='+p.id)}catch(e){}
}
let ambient,sun,renderNeeded=true;
function syncLighting(){if(!ready)return;document.body.classList.toggle('theme-night',night);scene.background.set(night?0x132d3b:0x9bdce9);scene.fog.color.copy(scene.background);ambient.intensity=night?.85:2.1;sun.intensity=night?.6:2.1;sun.color.set(night?0xbad4e0:0xfff1dc);instancedMaterial.color.set(night?0xb6c6bc:0xffffff);for(const b of cache.values())for(const l of b.lights)l.visible=night;$('lighting').textContent=night?'AM':'PM';$('lighting').setAttribute('aria-pressed',String(night));$('lighting').setAttribute('aria-label',night?'Switch to daytime lighting':'Switch to evening lighting');renderNeeded=true}
function updateActors(dt){if(!active)return;for(const a of active.actors){
 if(a.kind==='ring'){a.mesh.material.opacity=a.id===selected?.9:.4;continue}
 if(moving)a.t=(a.t+dt*a.speed+1)%1;
 if(a.kind==='jet'){const p=flightPose(a.t,a.lane);a.mesh.position.set(p.x,p.y,p.z);a.mesh.rotation.set(p.pitch,p.yaw,0,'YXZ');continue}
 if(a.kind==='anchored'){a.mesh.position.set(a.x,a.y+Math.sin(a.t*Math.PI*2)*.06,a.z);a.mesh.rotation.y=a.heading;continue}
 if(a.kind==='fountain'){a.mesh.children.forEach((drop,i)=>{const u=(a.t+i/7)%1;drop.position.set(5.2+u*7,5.1+u*2.8-u*u*7.8,23)});continue}
 const pos=(a.t-.5)*a.length;if(a.horizontal)a.mesh.position.set(pos,a.baseY||0,a.offset);else a.mesh.position.set(a.offset,a.baseY||0,pos);
 if(['boat','bus','tram'].includes(a.kind))a.mesh.rotation.y=a.speed>0?0:Math.PI;
 if(a.kind==='walk'){a.mesh.rotation.y=a.horizontal?(a.speed>0?Math.PI/2:-Math.PI/2):(a.speed>0?0:Math.PI);a.mesh.children[2].rotation.x=Math.sin(time*9+a.t*20)*.35;a.mesh.children[3].rotation.x=-Math.sin(time*9+a.t*20)*.35}
}}
function resize(){const r=$('world').getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);if(ready){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderNeeded=true}}
function tick(now){frameId=requestAnimationFrame(tick);if(document.hidden){last=now;return}const dt=Math.min(.05,(now-last)/1000||0);last=now;if(moving)time+=dt;const k=reduced?1:1-Math.exp(-dt*6);let unsettled=Math.abs(cam.yaw-cam.toYaw)+Math.abs(cam.pitch-cam.toPitch)+Math.abs(cam.distance-cam.toDistance)+cam.target.distanceTo(cam.toTarget)>.002;cam.yaw+=(cam.toYaw-cam.yaw)*k;cam.pitch+=(cam.toPitch-cam.pitch)*k;cam.distance+=(cam.toDistance-cam.distance)*k;cam.target.lerp(cam.toTarget,k);camera.position.set(cam.target.x+Math.sin(cam.yaw)*Math.cos(cam.pitch)*cam.distance,cam.target.y+Math.sin(cam.pitch)*cam.distance,cam.target.z+Math.cos(cam.yaw)*Math.cos(cam.pitch)*cam.distance);camera.lookAt(cam.target);camera.updateMatrixWorld();if(moving||unsettled||renderNeeded){updateActors(dt);updatePins();renderer.render(scene,camera);renderNeeded=false}}
const points=new Map();let gesture=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture={x:e.clientX,y:e.clientY,moved:false};});
canvas.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const p=points.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;const before=[...points.values()];points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(gesture&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5)gesture.moved=true;if(points.size===2){const after=[...points.values()],a=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),b=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);if(b>1)cam.toDistance=clamp(cam.toDistance*a/b,65,450)}else{cam.toYaw-=dx*.007;cam.toPitch=clamp(cam.toPitch+dy*.005,.35,1.48)}renderNeeded=true});
canvas.addEventListener('pointerup',e=>{const wasMulti=points.size>1;points.delete(e.pointerId);if(gesture&&!gesture.moved&&!wasMulti&&ready){const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(active.pickers)[0];if(hit){if(hit.object.userData.zone)setZone(hit.object.userData.zone);else if(hit.object.userData.landmark)selectLandmark(hit.object.userData.landmark);else selectPlace(hit.object.userData.place)}}gesture=null});canvas.addEventListener('pointercancel',e=>{points.delete(e.pointerId);gesture=null});canvas.addEventListener('wheel',e=>{e.preventDefault();cam.toDistance=clamp(cam.toDistance*Math.exp(e.deltaY*.001),65,450);renderNeeded=true},{passive:false});
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')cam.toYaw-=.14;if(e.key==='ArrowRight')cam.toYaw+=.14;if(e.key==='ArrowUp')cam.toPitch=clamp(cam.toPitch+.1,.35,1.48);if(e.key==='ArrowDown')cam.toPitch=clamp(cam.toPitch-.1,.35,1.48);if(e.key==='+')cam.toDistance=clamp(cam.toDistance*.85,65,450);if(e.key==='-')cam.toDistance=clamp(cam.toDistance/ .85,65,450);if(e.key==='Home')homeCamera();renderNeeded=true});
$('zoomIn').onclick=()=>{cam.toDistance=clamp(cam.toDistance*.82,65,450);renderNeeded=true};$('zoomOut').onclick=()=>{cam.toDistance=clamp(cam.toDistance/ .82,65,450);renderNeeded=true};$('reset').onclick=()=>{homeCamera();renderNeeded=true};$('lighting').onclick=()=>{night=!night;syncLighting()};$('motion').setAttribute('aria-pressed',String(moving));$('motion').textContent=moving?'Ⅱ':'▶';$('motion').onclick=()=>{moving=!moving;$('motion').textContent=moving?'Ⅱ':'▶';$('motion').setAttribute('aria-pressed',String(moving));renderNeeded=true};
function tourStep(){const p=D.places[tourIndex];selectPlace(p.id);$('tour').hidden=false;$('tourCount').textContent=(tourIndex+1)+' / '+D.places.length+' PLACES';$('tourTitle').textContent=p.short;$('tourCopy').textContent=p.occasion+' · '+p.type+'. Explore the scene, then move on when you’re ready.';$('tourNext').textContent=tourIndex===D.places.length-1?'Back to the island':'Next place →'}
$('tourStart').onclick=()=>{tourIndex=0;tourStep()};$('tourNext').onclick=()=>{if(tourIndex===D.places.length-1){tourIndex=-1;$('tour').hidden=true;setZone('island')}else{tourIndex++;tourStep()}};$('tourStop').onclick=()=>{tourIndex=-1;$('tour').hidden=true};$('dismissError').onclick=()=>$('error').hidden=true;
$('mapSources').innerHTML=D.mapSources.map(s=>'<a href="'+s.url+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>').join('');
for(const z of D.zones){const b=document.createElement('button');b.textContent=z.short;b.dataset.zone=z.id;b.setAttribute('aria-pressed',String(z.id==='island'));b.onclick=()=>{tourIndex=-1;$('tour').hidden=true;setZone(z.id)};$('zones').appendChild(b)}syncZoneUI();
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0x9bdce9);scene=new T.Scene();scene.background=new T.Color(0x9bdce9);scene.fog=new T.Fog(0x9bdce9,450,850);ambient=new T.HemisphereLight(0xe2f3ec,0x819586,2.1);scene.add(ambient);sun=new T.DirectionalLight(0xfff1dc,2.1);sun.position.set(-55,100,50);scene.add(sun);camera=new T.PerspectiveCamera(43,1,.1,950);ready=true;resize();setZone('island');cam.yaw=cam.toYaw;cam.pitch=cam.toPitch;cam.distance=cam.toDistance;new ResizeObserver(resize).observe($('world'));$('loading').hidden=true;requestAnimationFrame(tick);const id=new URLSearchParams(location.hash.slice(1)).get('place');if(id)selectPlace(id);else{const landmark=new URLSearchParams(location.hash.slice(1)).get('landmark');if(landmark)selectLandmark(landmark)}}catch(e){console.error(e);$('loading').hidden=true;$('error').hidden=false;$('status').textContent='3D unavailable. The place guide remains available.'}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;cancelAnimationFrame(frameId);$('error').hidden=false;$('error').querySelector('h2').textContent='The 3D view was interrupted.'});
window.SGExplorer={setZone,selectPlace,selectLandmark,flightPose,getStats:()=>({zone,selected,selectedLandmark,places:D.places.length,cachedScenes:cache.size,actors:active?active.actors.reduce((counts,a)=>(counts[a.kind]=(counts[a.kind]||0)+1,counts),{}):{},instances:[...cache.values()].reduce((n,b)=>n+Object.values(b.groups).reduce((a,g)=>a+g.length,0),0),ready}),mapLink};
})();
