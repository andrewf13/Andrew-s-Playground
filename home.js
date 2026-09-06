'use strict';
const grid=document.getElementById('projects');
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
for(const p of window.PROJECTS){
 const card=document.createElement('article');card.className='project '+(p.id==='shield-dojo'?'featured ':'')+p.category.toLowerCase();card.dataset.category=p.category;
 const cover=p.id==='shield-dojo'?'<div class="preview-frame"><iframe src="assets/dojo-preview.html" title="Shield Dojo artwork preview" tabindex="-1" aria-hidden="true" loading="lazy"></iframe><div class="cover-caption"><span>BOUNCE EDITION v3</span><b>SHIELD<br>DOJO</b></div></div>':`<div class="type-cover"><div class="cover-top"><span>${escapeHTML(p.kind)}</span><span>${p.number} / 07</span></div><strong>${escapeHTML(p.line1)}<br>${escapeHTML(p.line2)}</strong><div class="cover-bottom"><span>${escapeHTML(p.edition)}</span><b>${p.year}</b></div></div>`;
 card.innerHTML=`<a class="cover-link" tabindex="-1" aria-hidden="true" href="play.html?project=${p.id}">${cover}</a><div class="project-body"><div class="project-meta"><span>${p.category}</span><span>${p.controls}</span></div><h2><a href="play.html?project=${p.id}">${escapeHTML(p.title)}</a></h2><p>${escapeHTML(p.description)}</p><div class="project-actions"><a class="launch" href="play.html?project=${p.id}">${p.category==='Games'?'Play now':'Explore'} <span aria-hidden="true">↗</span><span class="sr-only"> ${escapeHTML(p.title)}</span></a><a class="download" download href="${p.file}" aria-label="Download ${escapeHTML(p.title)} as an HTML file">HTML ↓</a></div></div>`;
 grid.appendChild(card);
}
const iframe=document.querySelector('.preview-frame iframe');
if(iframe){const fit=()=>{iframe.style.transform=`scale(${iframe.parentElement.clientWidth/800})`;};new ResizeObserver(fit).observe(iframe.parentElement);fit();}
const buttons=[...document.querySelectorAll('[data-filter]')];
function applyFilter(value){if(!buttons.some(b=>b.dataset.filter===value))value='All';for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.filter===value));let count=0;for(const card of grid.children){card.hidden=value!=='All'&&card.dataset.category!==value;if(!card.hidden)count++;}document.getElementById('showing').textContent=count+' projects';}
for(const b of buttons)b.addEventListener('click',()=>{applyFilter(b.dataset.filter);try{sessionStorage.setItem('playground-filter',b.dataset.filter)}catch(e){}});
try{applyFilter(sessionStorage.getItem('playground-filter')||'All')}catch(e){applyFilter('All')}
