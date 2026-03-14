import { createRouter,createWebHistory } from "vue-router";

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    title?: string;
  }
}

const routes = [
    {
        path:'/',
        redirect: '/workbench'
    },
    {
        path:'/login',
        name:'Login',
        component:()=>import('@/views/Login.vue'),
        meta:{title:'用户登录'}
    },
    {
        path:'/profile',
        name:'Profile',
        component:()=>import('@/views/Profile.vue'),
        meta:{
            title:'用户信息',
            requiredAuth:true
        }
    },
    {
        path:'/workbench',
        name:'Workbench',
        component:()=>import('@/views/Workbench.vue'),
        meta:{
            title:'数据查看与操作',
            requiredAuth:true
        }
    },
    {
        path:'/settings',
        name:'Settings',
        component:()=>import('@/views/settings.vue'),
        meta:{
            title:'系统设置',
            requiredAuth:true
        }
    }
];

const router = createRouter({
    history:createWebHistory(),
    routes,
});

// 路由守卫，无token跳转登陆
router.beforeEach((to,from,next)=>{
    const token = localStorage.getItem('token');
    if(to.meta.requiredAuth && !token){
        next('/Login');
    }else{
        document.title  = to.meta.title || 'GIS Platform',
        next();
    }
})

export default router;