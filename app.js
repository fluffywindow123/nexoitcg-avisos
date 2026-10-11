const status = document.querySelector('#status');
const enable = document.querySelector('#enable');
const disable = document.querySelector('#disable');
const routes = new Set(['tasks','subjects','events','schedule']);
const route = new URL(location.href).searchParams.get('open');
if (routes.has(route)) document.querySelector('#open').href = `nexoitcg://${route}`;
let api, registration;
const say = text => { status.textContent = text; };
async function request(path, body) {
  const token = localStorage.getItem('nexo-device-token');
  const response = await fetch(api + path, {method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),credentials:'omit',referrerPolicy:'no-referrer'});
  if (!response.ok) throw new Error('No se pudo conectar el dispositivo. Vuelve a vincularlo desde NexoITCG.');
  return response.json();
}
async function setup() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { say('Este navegador no permite avisos web. En iPhone o iPad, añade la página a Inicio desde Safari.'); return; }
  registration = await navigator.serviceWorker.register('./sw.js', {scope:'./'});
  const config = await fetch('./config.json',{cache:'no-store'}).then(r=>r.json());
  if (!config.apiBase) { say('La web está lista. Falta conectar el servicio de avisos para activar las notificaciones.'); return; }
  const target = new URL(config.apiBase);
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.workers.dev')) throw new Error('La dirección del servicio de avisos no es válida.');
  api = target.origin;
  const pairing = new URLSearchParams(location.hash.slice(1)).get('pair');
  history.replaceState(null,'',location.pathname + location.search);
  if (pairing) {
    const result = await request('/api/pair/redeem',{code:pairing});
    if (typeof result.token !== 'string') throw new Error('No se pudo vincular este dispositivo.');
    localStorage.setItem('nexo-device-token',result.token);
  }
  if (!localStorage.getItem('nexo-device-token')) { say('Abre el enlace de vinculación desde la configuración de NexoITCG.'); return; }
  const existing = await registration.pushManager.getSubscription();
  disable.hidden = !existing;
  enable.disabled = !!existing;
  say(existing ? 'Este dispositivo tiene una suscripción de avisos activa.' : 'Dispositivo vinculado. Activa los avisos cuando quieras.');
}
enable.addEventListener('click',async()=>{
  enable.disabled = true;
  try {
    // Permission must originate from this direct user gesture, not page startup.
    if (await Notification.requestPermission() !== 'granted') throw new Error('Los avisos no están permitidos. Puedes cambiar el permiso en los ajustes del dispositivo.');
    const response = await fetch(api+'/api/public-config',{credentials:'omit'});
    if (!response.ok) throw new Error('El servicio de avisos no está disponible.');
    const {publicKey} = await response.json();
    const decoded = atob(publicKey.replace(/-/g,'+').replace(/_/g,'/'));
    const subscription = await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(decoded,c=>c.charCodeAt(0))});
    try { await request('/api/subscriptions',{subscription:subscription.toJSON()}); }
    catch(error) { await subscription.unsubscribe(); throw error; }
    disable.hidden = false; say('Avisos activados en este dispositivo.');
  } catch(error) { say(error.message); enable.disabled=false; }
});
disable.addEventListener('click',async()=>{
  disable.disabled=true;
  try {
    const subscription=await registration.pushManager.getSubscription();
    if(subscription) { await request('/api/subscriptions/remove',{endpoint:subscription.endpoint}); await subscription.unsubscribe(); }
    localStorage.removeItem('nexo-device-token'); disable.hidden=true; enable.disabled=true;
    say('Avisos desactivados. Para volver a activarlos, vincula de nuevo desde NexoITCG.');
  } catch(error) { say(error.message); } finally {disable.disabled=false;}
});
setup().catch(()=>say('No se pudo preparar este dispositivo. Revisa tu conexión y vuelve a abrir la página.'));
