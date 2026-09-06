'use strict';
const id=new URLSearchParams(location.search).get('project');
const project=window.PROJECTS.find(p=>p.id===id);
if(!project){document.getElementById('title').textContent='Project not found';document.getElementById('error').hidden=false;}
else{
 document.title=project.title+' — Andrew’s Playground';document.getElementById('title').textContent=project.title;
 document.getElementById('actions').hidden=false;document.getElementById('download').href=project.file;document.getElementById('standalone').href=project.file;
 const frame=document.createElement('iframe');frame.src=project.file;frame.title=project.title;frame.allow='fullscreen';frame.allowFullscreen=true;document.getElementById('stage').appendChild(frame);
 const fullscreen=document.getElementById('fullscreen');
 if(!document.documentElement.requestFullscreen)fullscreen.hidden=true;
 fullscreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(e){fullscreen.textContent='Use browser fullscreen';}};
 document.addEventListener('fullscreenchange',()=>fullscreen.textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen');
}
