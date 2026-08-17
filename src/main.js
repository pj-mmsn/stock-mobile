import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

// ===== SW 更新通知：新版本激活后自动刷新页面 =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATED' && !sessionStorage.getItem('sm_sw_reloaded')) {
      sessionStorage.setItem('sm_sw_reloaded', '1')
      location.reload()
    }
  })
}
