<script setup lang="ts">
import * as Cesium from "cesium";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";
import {
  buildUserAssetFileUrl,
  fetchUserDatasets,
  saveCzmlScene,
  uploadUserData,
} from "@/api/datasets";
import { buildBackendUrl } from "@/api/request";

interface UserModelAsset {
  id: string;
  name: string;
  filename: string;
  path?: string;
  fileUrl?: string;
}

interface ModelSource {
  id: string;
  name: string;
  uri: string;
  source: "default" | "user";
  assetId?: string;
}

interface SceneKeyframe {
  id: string;
  time: string;
  lon: number;
  lat: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
}

interface SceneObject {
  id: string;
  name: string;
  model: ModelSource;
  visible: boolean;
  keyframes: SceneKeyframe[];
  activeKeyframeId: string;
}

const props = defineProps<{
  viewer: Cesium.Viewer | null;
  loadedLayers: WorkbenchLayerItem[];
}>();

const emit = defineEmits<{
  (event: "add-drawing-layer", layer: WorkbenchLayerItem): void;
}>();

const defaultModels: ModelSource[] = [
  {
    id: "default-cube",
    name: "正方体",
    uri: "/models/default/cube.glb",
    source: "default",
  },
  {
    id: "default-sphere",
    name: "球体",
    uri: "/models/default/sphere.glb",
    source: "default",
  },
  {
    id: "default-plane",
    name: "简易飞机",
    uri: "/models/default/simple-plane.glb",
    source: "default",
  },
];

const sceneName = ref("三维活动场景");
const startTime = ref(new Date().toISOString().slice(0, 19));
const stopTime = ref(new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 19));
const multiplier = ref(1);
const objects = ref<SceneObject[]>([]);
const activeObjectId = ref("");
const userModels = ref<UserModelAsset[]>([]);
const loadingAssets = ref(false);
const isPicking = ref(false);
const isPreviewing = ref(false);
const uploadInputRef = ref<HTMLInputElement | null>(null);

let editorDataSource: Cesium.CustomDataSource | null = null;
let previewDataSource: Cesium.CzmlDataSource | null = null;
let pickHandler: Cesium.ScreenSpaceEventHandler | null = null;

const hprForm = reactive({
  lon: 116.391,
  lat: 39.907,
  height: 500,
  heading: 0,
  pitch: 0,
  roll: 0,
  scale: 80,
  time: startTime.value,
});

const activeObject = computed(() =>
  objects.value.find((item) => item.id === activeObjectId.value),
);

const activeKeyframe = computed(() => {
  const target = activeObject.value;
  if (!target) return null;
  return target.keyframes.find((item) => item.id === target.activeKeyframeId) ?? null;
});

const modelLibrary = computed<ModelSource[]>(() => [
  ...defaultModels,
  ...userModels.value.map((item) => ({
    id: item.id,
    name: item.name,
    uri: getAssetModelUri(item),
    source: "user" as const,
    assetId: item.id,
  })),
]);

const pad = (value: number) => String(value).padStart(2, "0");

const toLocalDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const toIso = (value: string) => new Date(value).toISOString();

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const getAssetModelUri = (asset: UserModelAsset) => {
  if (asset.path) {
    return buildBackendUrl(`/${asset.path.replace(/\\/g, "/")}`);
  }

  return buildUserAssetFileUrl(asset.id);
};

const getViewerCenter = () => {
  const viewer = props.viewer;
  if (!viewer) {
    return { lon: hprForm.lon, lat: hprForm.lat, height: hprForm.height };
  }

  const canvas = viewer.scene.canvas;
  const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const cartesian =
    viewer.scene.pickPosition(center) ||
    viewer.camera.pickEllipsoid(center, viewer.scene.globe.ellipsoid);

  if (cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      height: Math.max(cartographic.height, 120),
    };
  }

  const camera = viewer.camera.positionCartographic;
  return {
    lon: Cesium.Math.toDegrees(camera.longitude),
    lat: Cesium.Math.toDegrees(camera.latitude),
    height: Math.max(camera.height * 0.18, 120),
  };
};

const createKeyframe = (partial: Partial<SceneKeyframe> = {}): SceneKeyframe => ({
  id: uid("kf"),
  time: partial.time ?? hprForm.time,
  lon: Number(partial.lon ?? hprForm.lon),
  lat: Number(partial.lat ?? hprForm.lat),
  height: Number(partial.height ?? hprForm.height),
  heading: Number(partial.heading ?? hprForm.heading),
  pitch: Number(partial.pitch ?? hprForm.pitch),
  roll: Number(partial.roll ?? hprForm.roll),
  scale: Number(partial.scale ?? hprForm.scale),
});

const keyframePosition = (keyframe: SceneKeyframe) =>
  Cesium.Cartesian3.fromDegrees(keyframe.lon, keyframe.lat, keyframe.height);

const keyframeOrientation = (keyframe: SceneKeyframe) => {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(keyframe.heading),
    Cesium.Math.toRadians(keyframe.pitch),
    Cesium.Math.toRadians(keyframe.roll),
  );
  return Cesium.Transforms.headingPitchRollQuaternion(keyframePosition(keyframe), hpr);
};

const ensureEditorDataSource = async () => {
  if (!props.viewer) return null;

  if (!editorDataSource) {
    editorDataSource = new Cesium.CustomDataSource("scene-editor");
    await props.viewer.dataSources.add(editorDataSource);
  }

  return editorDataSource;
};

const refreshObjectEntity = async (object: SceneObject) => {
  const dataSource = await ensureEditorDataSource();
  if (!dataSource) return;

  const keyframe = object.keyframes.find((item) => item.id === object.activeKeyframeId);
  if (!keyframe) return;

  const entity = dataSource.entities.getById(object.id);
  const position = keyframePosition(keyframe);
  const orientation = keyframeOrientation(keyframe);

  if (entity) {
    entity.position = new Cesium.ConstantPositionProperty(position);
    entity.orientation = new Cesium.ConstantProperty(orientation);
    entity.show = object.visible;
    entity.model = new Cesium.ModelGraphics({
      uri: object.model.uri,
      scale: keyframe.scale,
      minimumPixelSize: 48,
    });
    return;
  }

  dataSource.entities.add({
    id: object.id,
    name: object.name,
    show: object.visible,
    position,
    orientation,
    model: {
      uri: object.model.uri,
      scale: keyframe.scale,
      minimumPixelSize: 48,
    },
    path: {
      show: true,
      width: 2,
      material: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.85),
    },
  });
};

const syncFormFromKeyframe = (keyframe: SceneKeyframe | null) => {
  if (!keyframe) return;
  hprForm.time = keyframe.time;
  hprForm.lon = keyframe.lon;
  hprForm.lat = keyframe.lat;
  hprForm.height = keyframe.height;
  hprForm.heading = keyframe.heading;
  hprForm.pitch = keyframe.pitch;
  hprForm.roll = keyframe.roll;
  hprForm.scale = keyframe.scale;
};

const applyFormToKeyframe = async () => {
  const object = activeObject.value;
  const keyframe = activeKeyframe.value;
  if (!object || !keyframe) return;

  keyframe.time = hprForm.time;
  keyframe.lon = Number(hprForm.lon);
  keyframe.lat = Number(hprForm.lat);
  keyframe.height = Number(hprForm.height);
  keyframe.heading = Number(hprForm.heading);
  keyframe.pitch = Number(hprForm.pitch);
  keyframe.roll = Number(hprForm.roll);
  keyframe.scale = Number(hprForm.scale);
  await refreshObjectEntity(object);
};

const selectObject = (id: string) => {
  activeObjectId.value = id;
  syncFormFromKeyframe(activeKeyframe.value);
};

const addModel = async (model: ModelSource) => {
  const center = getViewerCenter();
  const now = startTime.value;
  const firstKeyframe = createKeyframe({
    time: now,
    lon: center.lon,
    lat: center.lat,
    height: center.height,
    heading: model.id.includes("plane") ? 90 : 0,
    scale: model.id.includes("plane") ? 120 : 80,
  });

  const object: SceneObject = {
    id: uid("obj"),
    name: `${model.name} ${objects.value.length + 1}`,
    model,
    visible: true,
    keyframes: [firstKeyframe],
    activeKeyframeId: firstKeyframe.id,
  };

  objects.value = [...objects.value, object];
  activeObjectId.value = object.id;
  syncFormFromKeyframe(firstKeyframe);
  await refreshObjectEntity(object);
  props.viewer?.flyTo(editorDataSource as Cesium.DataSource, { duration: 0.6 });
};

const removeObject = async (object: SceneObject) => {
  objects.value = objects.value.filter((item) => item.id !== object.id);
  editorDataSource?.entities.removeById(object.id);
  if (activeObjectId.value === object.id) {
    activeObjectId.value = objects.value[0]?.id ?? "";
    syncFormFromKeyframe(activeKeyframe.value);
  }
};

const addKeyframe = async () => {
  const object = activeObject.value;
  if (!object) {
    ElMessage.warning("请先添加一个模型");
    return;
  }

  const last = object.keyframes[object.keyframes.length - 1];
  const baseDate = last ? new Date(last.time) : new Date(startTime.value);
  const nextTime = toLocalDateTime(new Date(baseDate.getTime() + 60 * 1000));
  const keyframe = createKeyframe({
    ...(last ?? {}),
    id: uid("kf"),
    time: nextTime,
  });
  object.keyframes.push(keyframe);
  object.activeKeyframeId = keyframe.id;
  syncFormFromKeyframe(keyframe);
  await refreshObjectEntity(object);
};

const deleteKeyframe = async (keyframe: SceneKeyframe) => {
  const object = activeObject.value;
  if (!object || object.keyframes.length <= 1) {
    ElMessage.warning("至少保留一个关键帧");
    return;
  }

  object.keyframes = object.keyframes.filter((item) => item.id !== keyframe.id);
  object.activeKeyframeId = object.keyframes[0]!.id;
  syncFormFromKeyframe(activeKeyframe.value);
  await refreshObjectEntity(object);
};

const selectKeyframe = async (keyframe: SceneKeyframe) => {
  const object = activeObject.value;
  if (!object) return;
  object.activeKeyframeId = keyframe.id;
  syncFormFromKeyframe(keyframe);
  await refreshObjectEntity(object);
};

const startPickPosition = () => {
  const viewer = props.viewer;
  const object = activeObject.value;
  if (!viewer || !object) {
    ElMessage.warning("请先添加并选中模型");
    return;
  }

  isPicking.value = true;
  pickHandler?.destroy();
  pickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  pickHandler.setInputAction(async (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const cartesian =
      viewer.scene.pickPosition(movement.position) ||
      viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    hprForm.lon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6));
    hprForm.lat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6));
    hprForm.height = Math.max(Number(cartographic.height.toFixed(2)), 0);
    await applyFormToKeyframe();
    stopPickPosition();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
};

const stopPickPosition = () => {
  isPicking.value = false;
  pickHandler?.destroy();
  pickHandler = null;
};

const sortedKeyframes = (object: SceneObject) =>
  [...object.keyframes].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

const buildCzml = () => {
  const startIso = toIso(startTime.value);
  const stopIso = toIso(stopTime.value);
  const startMs = new Date(startIso).getTime();

  const czml: any[] = [
    {
      id: "document",
      name: sceneName.value || "三维活动场景",
      version: "1.0",
      clock: {
        interval: `${startIso}/${stopIso}`,
        currentTime: startIso,
        multiplier: Number(multiplier.value) || 1,
        range: "LOOP_STOP",
        step: "SYSTEM_CLOCK_MULTIPLIER",
      },
    },
  ];

  for (const object of objects.value) {
    const frames = sortedKeyframes(object);
    if (frames.length === 0) continue;

    const cartographicDegrees = frames.flatMap((frame) => [
      Math.max(0, (new Date(frame.time).getTime() - startMs) / 1000),
      frame.lon,
      frame.lat,
      frame.height,
    ]);

    const firstScale = frames[0]?.scale ?? 1;
    czml.push({
      id: object.id,
      name: object.name,
      availability: `${startIso}/${stopIso}`,
      position: {
        epoch: startIso,
        interpolationAlgorithm: "LAGRANGE",
        interpolationDegree: 1,
        cartographicDegrees,
      },
      orientation:
        frames.length > 1
          ? { velocityReference: "#position" }
          : {
              unitQuaternion: [
                keyframeOrientation(frames[0]!).x,
                keyframeOrientation(frames[0]!).y,
                keyframeOrientation(frames[0]!).z,
                keyframeOrientation(frames[0]!).w,
              ],
            },
      model: {
        gltf: object.model.uri,
        scale: firstScale,
        minimumPixelSize: 48,
      },
      path: {
        show: frames.length > 1,
        width: 2,
        material: {
          solidColor: {
            color: { rgba: [56, 189, 248, 220] },
          },
        },
      },
    });
  }

  return czml;
};

const stopPreview = async () => {
  if (!props.viewer) return;
  if (previewDataSource) {
    await props.viewer.dataSources.remove(previewDataSource, true);
    previewDataSource = null;
  }
  if (editorDataSource) {
    editorDataSource.show = true;
  }
  isPreviewing.value = false;
};

const previewScene = async () => {
  if (!props.viewer) return;
  if (objects.value.length === 0) {
    ElMessage.warning("请先添加模型和关键帧");
    return;
  }

  await stopPreview();
  const czml = buildCzml();
  if (editorDataSource) editorDataSource.show = false;
  previewDataSource = await Cesium.CzmlDataSource.load(czml);
  await props.viewer.dataSources.add(previewDataSource);

  if (previewDataSource.clock) {
    props.viewer.clock.startTime = previewDataSource.clock.startTime.clone();
    props.viewer.clock.stopTime = previewDataSource.clock.stopTime.clone();
    props.viewer.clock.currentTime = previewDataSource.clock.currentTime.clone();
    props.viewer.clock.multiplier = Number(multiplier.value) || 1;
    props.viewer.clock.shouldAnimate = true;
  }

  await props.viewer.flyTo(previewDataSource, { duration: 0.8 });
  isPreviewing.value = true;
};

const saveScene = async () => {
  if (objects.value.length === 0) {
    ElMessage.warning("场景中还没有模型");
    return;
  }

  try {
    const response = await saveCzmlScene({
      name: sceneName.value || "三维活动场景",
      czml: buildCzml(),
    });

    if (response.code === 200) {
      ElMessage.success("场景已保存为 CZML 个人资产");
      return;
    }

    ElMessage.error(response.message || "保存失败");
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || error.message || "保存失败");
  }
};

const finishScene = async () => {
  if (!props.viewer) return;
  if (objects.value.length === 0) {
    ElMessage.warning("场景中还没有模型");
    return;
  }

  await stopPreview();

  const czml = buildCzml();
  const dataSource = await Cesium.CzmlDataSource.load(czml);
  await props.viewer.dataSources.add(dataSource);

  if (editorDataSource) {
    editorDataSource.show = false;
  }

  if (dataSource.clock) {
    props.viewer.clock.startTime = dataSource.clock.startTime.clone();
    props.viewer.clock.stopTime = dataSource.clock.stopTime.clone();
    props.viewer.clock.currentTime = dataSource.clock.currentTime.clone();
    props.viewer.clock.multiplier = Number(multiplier.value) || dataSource.clock.multiplier;
    props.viewer.clock.shouldAnimate = true;
  }

  emit("add-drawing-layer", {
    id: uid("scene-layer"),
    label: sceneName.value || "三维活动场景",
    visible: true,
    cesiumLayer: null,
    dataSource,
    type: "czml",
  });

  await props.viewer.flyTo(dataSource, { duration: 0.8 });
  ElMessage.success("场景已完成并加入图层");
};

const loadUserModels = async () => {
  loadingAssets.value = true;
  try {
    const response = await fetchUserDatasets();
    if (response.code === 200) {
      userModels.value = response.data
        .filter((item: any) => item.type === "glb" || item.name?.toLowerCase().endsWith(".glb"))
        .map((item: any) => ({
          id: item._id,
          name: item.name,
          filename: item.filename,
          path: item.path,
          fileUrl: item.fileUrl,
        }));
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || "获取模型资产失败");
  } finally {
    loadingAssets.value = false;
  }
};

const triggerUpload = () => {
  uploadInputRef.value?.click();
};

const handleUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".glb")) {
    ElMessage.warning("三维模型只支持 .glb 文件");
    input.value = "";
    return;
  }

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("type", "glb");

  const token = localStorage.getItem("token");
  if (!token) {
    ElMessage.error("请先登录");
    return;
  }

  try {
    const response = await uploadUserData(
      token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      formData,
    );
    if (response.code === 200) {
      ElMessage.success("GLB 模型上传成功");
      await loadUserModels();
    } else {
      ElMessage.error(response.message || "上传失败");
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || error.message || "上传失败");
  } finally {
    input.value = "";
  }
};

watch(
  () => activeKeyframe.value?.id,
  () => syncFormFromKeyframe(activeKeyframe.value),
);

watch(
  () => ({ ...hprForm }),
  () => {
    void applyFormToKeyframe();
  },
  { deep: true },
);

onMounted(async () => {
  const now = new Date();
  startTime.value = toLocalDateTime(now);
  stopTime.value = toLocalDateTime(new Date(now.getTime() + 5 * 60 * 1000));
  hprForm.time = startTime.value;
  await ensureEditorDataSource();
  await loadUserModels();
});

onBeforeUnmount(() => {
  stopPickPosition();
  if (props.viewer) {
    if (previewDataSource) {
      props.viewer.dataSources.remove(previewDataSource, true);
    }
    if (editorDataSource) {
      props.viewer.dataSources.remove(editorDataSource, true);
    }
  }
  previewDataSource = null;
  editorDataSource = null;
});
</script>

<template>
  <div class="scene-create-form">
    <section class="scene-block scene-meta">
      <label class="field">
        <span>场景名称</span>
        <input v-model="sceneName" type="text" />
      </label>
      <div class="time-grid">
        <label class="field">
          <span>开始</span>
          <input v-model="startTime" type="datetime-local" step="1" />
        </label>
        <label class="field">
          <span>结束</span>
          <input v-model="stopTime" type="datetime-local" step="1" />
        </label>
      </div>
      <label class="field">
        <span>播放倍率</span>
        <input v-model.number="multiplier" type="number" min="0.1" step="0.5" />
      </label>
    </section>

    <section class="scene-block">
      <div class="section-head">
        <span>模型库</span>
        <button type="button" class="ghost-btn" @click="triggerUpload">上传 GLB</button>
        <input
          ref="uploadInputRef"
          type="file"
          accept=".glb"
          class="hidden-input"
          @change="handleUpload"
        />
      </div>
      <div class="model-grid">
        <button
          v-for="model in modelLibrary"
          :key="model.id"
          type="button"
          class="model-chip"
          @click="addModel(model)"
        >
          <span class="model-mark" :class="model.source">{{ model.source === "default" ? "D" : "U" }}</span>
          <span>{{ model.name }}</span>
        </button>
      </div>
      <p v-if="loadingAssets" class="hint">正在读取个人模型资产...</p>
      <p v-else-if="userModels.length === 0" class="hint">可上传 .glb 作为个人模型资产。</p>
    </section>

    <section class="scene-block">
      <div class="section-head">
        <span>场景对象</span>
        <span class="count">{{ objects.length }}</span>
      </div>
      <div class="object-list">
        <button
          v-for="object in objects"
          :key="object.id"
          type="button"
          class="object-row"
          :class="{ active: object.id === activeObjectId }"
          @click="selectObject(object.id)"
        >
          <span>{{ object.name }}</span>
          <small>{{ object.keyframes.length }} 帧</small>
        </button>
        <div v-if="objects.length === 0" class="empty-line">从模型库添加一个对象开始。</div>
      </div>
      <div v-if="activeObject" class="row-actions">
        <input v-model="activeObject.name" class="name-input" type="text" />
        <button type="button" class="danger-btn" @click="removeObject(activeObject)">删除</button>
      </div>
    </section>

    <section v-if="activeObject" class="scene-block">
      <div class="section-head">
        <span>关键帧</span>
        <button type="button" class="ghost-btn" @click="addKeyframe">添加帧</button>
      </div>
      <div class="keyframe-list">
        <button
          v-for="frame in sortedKeyframes(activeObject)"
          :key="frame.id"
          type="button"
          class="keyframe-row"
          :class="{ active: frame.id === activeObject.activeKeyframeId }"
          @click="selectKeyframe(frame)"
        >
          <span>{{ frame.time.replace('T', ' ') }}</span>
          <button type="button" class="mini-danger" @click.stop="deleteKeyframe(frame)">×</button>
        </button>
      </div>

      <div class="form-grid">
        <label class="field full">
          <span>时间</span>
          <input v-model="hprForm.time" type="datetime-local" step="1" />
        </label>
        <label class="field">
          <span>经度</span>
          <input v-model.number="hprForm.lon" type="number" step="0.000001" />
        </label>
        <label class="field">
          <span>纬度</span>
          <input v-model.number="hprForm.lat" type="number" step="0.000001" />
        </label>
        <label class="field">
          <span>高度</span>
          <input v-model.number="hprForm.height" type="number" step="10" />
        </label>
        <label class="field">
          <span>缩放</span>
          <input v-model.number="hprForm.scale" type="number" min="0.1" step="5" />
        </label>
        <label class="field">
          <span>航向</span>
          <input v-model.number="hprForm.heading" type="number" step="5" />
        </label>
        <label class="field">
          <span>俯仰</span>
          <input v-model.number="hprForm.pitch" type="number" step="5" />
        </label>
        <label class="field">
          <span>翻滚</span>
          <input v-model.number="hprForm.roll" type="number" step="5" />
        </label>
      </div>
      <button type="button" class="pick-btn" :class="{ active: isPicking }" @click="isPicking ? stopPickPosition() : startPickPosition()">
        {{ isPicking ? "取消拾取" : "从地图拾取位置" }}
      </button>
    </section>

    <section class="scene-actions">
      <button type="button" class="primary-btn" @click="previewScene">预览</button>
      <button v-if="isPreviewing" type="button" class="ghost-btn" @click="stopPreview">停止预览</button>
      <button type="button" class="finish-btn" @click="finishScene">完成查看</button>
      <button type="button" class="save-btn" @click="saveScene">保存 CZML</button>
    </section>
  </div>
</template>

<style scoped>
.scene-create-form {
  display: flex;
  max-height: calc(100vh - 128px);
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  color: #dbeafe;
}

.scene-block {
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(8, 13, 24, 0.68);
}

.scene-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 700;
}

.count {
  color: #38bdf8;
  font-size: 12px;
}

.time-grid,
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.form-grid {
  margin-top: 10px;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  color: #94a3b8;
  font-size: 11px;
}

.field.full {
  grid-column: 1 / -1;
}

.field input,
.name-input {
  width: 100%;
  min-width: 0;
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.92);
  color: #e2e8f0;
  font-size: 12px;
  outline: none;
  padding: 0 8px;
}

.field input:focus,
.name-input:focus {
  border-color: rgba(56, 189, 248, 0.72);
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.model-chip,
.object-row,
.keyframe-row {
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 7px;
  background: rgba(15, 23, 42, 0.78);
  color: #dbeafe;
  cursor: pointer;
}

.model-chip {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 7px;
  font-size: 12px;
  text-align: left;
}

.model-chip:hover,
.object-row:hover,
.keyframe-row:hover {
  border-color: rgba(56, 189, 248, 0.5);
  background: rgba(14, 116, 144, 0.2);
}

.model-mark {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 800;
}

.model-mark.default {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}

.model-mark.user {
  background: rgba(16, 185, 129, 0.18);
  color: #6ee7b7;
}

.object-list,
.keyframe-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.object-row,
.keyframe-row {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  text-align: left;
}

.object-row.active,
.keyframe-row.active {
  border-color: rgba(56, 189, 248, 0.8);
  background: rgba(8, 145, 178, 0.22);
}

.object-row small,
.hint,
.empty-line {
  color: #64748b;
  font-size: 11px;
}

.hint {
  margin: 8px 0 0;
}

.empty-line {
  padding: 8px 2px;
}

.row-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 10px;
}

.ghost-btn,
.danger-btn,
.primary-btn,
.finish-btn,
.save-btn,
.pick-btn,
.mini-danger {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.82);
  color: #dbeafe;
  cursor: pointer;
  font-size: 12px;
}

.ghost-btn,
.danger-btn {
  height: 28px;
  padding: 0 9px;
}

.ghost-btn:hover,
.pick-btn:hover {
  border-color: rgba(56, 189, 248, 0.55);
  color: #7dd3fc;
}

.danger-btn,
.mini-danger {
  color: #fca5a5;
}

.mini-danger {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
}

.pick-btn {
  width: 100%;
  height: 32px;
  margin-top: 10px;
}

.pick-btn.active {
  border-color: rgba(250, 204, 21, 0.65);
  color: #fde68a;
}

.scene-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding-bottom: 2px;
}

.primary-btn,
.finish-btn,
.save-btn {
  height: 34px;
  font-weight: 700;
}

.primary-btn {
  border-color: rgba(14, 165, 233, 0.55);
  background: rgba(14, 165, 233, 0.24);
  color: #bae6fd;
}

.finish-btn {
  border-color: rgba(250, 204, 21, 0.5);
  background: rgba(250, 204, 21, 0.16);
  color: #fde68a;
}

.save-btn {
  border-color: rgba(16, 185, 129, 0.52);
  background: rgba(16, 185, 129, 0.2);
  color: #bbf7d0;
}

.hidden-input {
  display: none;
}
</style>
