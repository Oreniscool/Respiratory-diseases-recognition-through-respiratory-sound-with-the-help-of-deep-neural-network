import{c as r,r as s}from"./index-BxCvTtJs.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=r("AudioLines",[["path",{d:"M2 10v3",key:"1fnikh"}],["path",{d:"M6 6v11",key:"11sgs0"}],["path",{d:"M10 3v18",key:"yhl04a"}],["path",{d:"M14 8v7",key:"3a1oy3"}],["path",{d:"M18 5v13",key:"123xd1"}],["path",{d:"M22 10v3",key:"154ddg"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=r("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]),l="".replace(/\/$/,"");function h(){const[c,n]=s.useState({online:!1,datasetOnline:!1,classes:[],modelLoaded:!1,modelContract:"unknown"}),a=s.useRef(null),o=async()=>{try{const t=await fetch(`${l}/health`,{signal:AbortSignal.timeout(2500)});if(!t.ok)throw new Error("not ok");const e=await t.json();n({online:!0,datasetOnline:!!e.dataset,classes:Array.isArray(e.classes)?e.classes:[],modelLoaded:!!e.model,modelContract:typeof e.model_contract=="string"?e.model_contract:"unknown"})}catch{n(t=>({...t,online:!1,datasetOnline:!1,modelLoaded:!1}))}};return s.useEffect(()=>(o(),a.current=setInterval(o,5e3),()=>{a.current&&clearInterval(a.current)}),[]),c}export{i as A,u as S,h as u};
