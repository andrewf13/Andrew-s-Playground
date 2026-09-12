// A small painter's-algorithm renderer for browsers without WebGL.
// Uses the same Three.js scene graph and camera, with reduced terrain resolution.
function EverestSoftwareRenderer(canvas,T){
 const ctx=canvas.getContext('2d',{alpha:false}),v1=new T.Vector3(),v2=new T.Vector3(),v3=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3(),view=new T.Matrix4(),matrix=new T.Matrix4(),inst=new T.Matrix4(),world=new T.Matrix4();
 let width=1,height=1,last=0;this.isSoftware=true;this.setPixelRatio=()=>{};this.setSize=(w,h)=>{width=w;height=h;canvas.width=w;canvas.height=h};
 this.render=(scene,camera)=>{
 const now=performance.now();if(now-last<45)return;last=now;scene.updateMatrixWorld();camera.updateMatrixWorld();view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);const faces=[],background=scene.background.clone(),bg=background.getStyle();ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 let sunlight=.8;scene.traverse(o=>{if(o.isDirectionalLight)sunlight=.28+Math.min(o.intensity/3,.8)});
 const materialColor=(m,c,i)=>{const col=m.color?m.color.clone():new T.Color('#d5e4eb');if(c)col.setRGB(c.getX(i),c.getY(i),c.getZ(i));return col};
 function mesh(o,wm){const g=o.userData.softwareGeometry||o.geometry;if(!g)return;const p=g.attributes.position,colors=g.attributes.color,index=g.index,m=Array.isArray(o.material)?o.material[0]:o.material;if(!m||!p||m.opacity===0)return;matrix.multiplyMatrices(view,wm);const verts=new Array(p.count);
 for(let i=0;i<p.count;i++){v1.fromBufferAttribute(p,i).applyMatrix4(matrix);verts[i]=[(v1.x*.5+.5)*width,(-v1.y*.5+.5)*height,v1.z]}
 const n=index?index.count:p.count;
 for(let i=0;i<n;i+=3){const ai=index?index.getX(i):i,bi=index?index.getX(i+1):i+1,ci=index?index.getX(i+2):i+2,a=verts[ai],b=verts[bi],c=verts[ci];if(a[2]<-1||b[2]<-1||c[2]<-1||a[2]>1||b[2]>1||c[2]>1)continue;if((a[0]<0&&b[0]<0&&c[0]<0)||(a[0]>width&&b[0]>width&&c[0]>width)||(a[1]<0&&b[1]<0&&c[1]<0)||(a[1]>height&&b[1]>height&&c[1]>height))continue;const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(m.side!==T.DoubleSide&&area>=0)continue;if(Math.abs(area)<.15)continue;
 v1.fromBufferAttribute(p,ai).applyMatrix4(wm);v2.fromBufferAttribute(p,bi).applyMatrix4(wm);v3.fromBufferAttribute(p,ci).applyMatrix4(wm);normal.subVectors(v2,v1).cross(edge.subVectors(v3,v1)).normalize();const light=m.isMeshBasicMaterial?1:(.5+Math.max(0,normal.dot(new T.Vector3(-.4,.85,.3)))*.5)*sunlight;const col=materialColor(m,colors,ai);col.multiplyScalar(light);const distance=v1.distanceTo(camera.position);col.lerp(background,Math.min(.85,1-Math.exp(-Math.pow(scene.fog.density*distance,2))));faces.push({a,b,c,z:(a[2]+b[2]+c[2])/3,fill:col.getStyle()});}
 }
 scene.traverseVisible(o=>{if(o.isInstancedMesh){for(let i=0;i<o.count;i+=2){o.getMatrixAt(i,inst);world.multiplyMatrices(o.matrixWorld,inst);mesh(o,world)}}else if(o.isMesh)mesh(o,o.matrixWorld)});
 faces.sort((a,b)=>b.z-a.z);ctx.lineWidth=.5;for(const f of faces){ctx.fillStyle=f.fill;ctx.strokeStyle=f.fill;ctx.beginPath();ctx.moveTo(f.a[0],f.a[1]);ctx.lineTo(f.b[0],f.b[1]);ctx.lineTo(f.c[0],f.c[1]);ctx.closePath();ctx.fill();ctx.stroke()}
 scene.traverseVisible(o=>{if(!o.isPoints||o.material.opacity<.02)return;const p=o.geometry.attributes.position;matrix.multiplyMatrices(view,o.matrixWorld);ctx.fillStyle=o.material.color.getStyle();ctx.globalAlpha=o.material.opacity;for(let i=0;i<p.count;i+=3){v1.fromBufferAttribute(p,i).applyMatrix4(matrix);if(v1.z<1&&v1.z>-1){const x=(v1.x*.5+.5)*width,y=(-v1.y*.5+.5)*height;if(o.material.size<2)ctx.fillRect(x,y,1,3);else ctx.fillRect(x,y,1.5,1.5)}}ctx.globalAlpha=1});
 };
}
