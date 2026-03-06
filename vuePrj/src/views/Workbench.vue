<script setup lang="ts">
import * as Cesium from 'cesium'
import '../Widgets/widgets.css'
import { onMounted } from 'vue';

declare global {
	interface Window {
		CESIUM_BASE_URL?: string;
	}
}
window.CESIUM_BASE_URL = "/";
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESSTOKEN

onMounted(()=>{
  const viewer = new Cesium.Viewer('cesiumContainer',{
    infoBox: false, // 禁用 InfoBox 窗口
    selectionIndicator: false,
  })
  console.log(import.meta.env.VITE_CESIUM_ACCESSTOKEN);
  
})

</script>

<template>
<div>
  <div id="cesiumContainer">

  </div>
</div>
</template>

<style scoped>
* {
  padding: 0;
  margin: 0;
}
#cesiumContainer{
	width: 100vw;
	height: 100vh;
}
</style>