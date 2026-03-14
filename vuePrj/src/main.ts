import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css' // 必须引入这个！
import 'element-plus/theme-chalk/dark/css-vars.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
