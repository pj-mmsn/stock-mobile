const CACHE = 'stock-mobile-v36'
// 只缓存静态资源，不缓存HTML入口（让浏览器始终请求最新HTML指向最新JS）
const STATIC = ['./manifest.json', './icon-192.png', './icon-512.png']

// 新SW立即接管（不等标签页关闭），并清理旧缓存
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
    // 通知所有页面：有新版本，请刷新
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
  })())
})

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = e.request.url
  if (url.includes('eastmoney.com') || url.includes('deepseek.com') || url.includes('gtimg.cn') || url.includes('sina.com.cn') || url.includes('onrender.com')) return
  if (e.request.method !== 'GET') return
  // HTML请求：绕过HTTP缓存强制走网络（GitHub Pages默认域名HTML有max-age=600，不绕会拿到旧页面）
  if (e.request.destination === 'document' || url.endsWith('/') || url.endsWith('/stock-mobile/')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)))
    return
  }
  // JS/CSS等静态资源：网络优先，缓存兜底
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
      }
      return resp
    }).catch(() => caches.match(e.request))
  )
})
