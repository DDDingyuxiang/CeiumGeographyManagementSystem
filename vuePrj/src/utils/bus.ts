import mitt from "mitt";

export interface AnalysisLayerPayload {
  id: string;
  label: string;
  type: string;
  visible: boolean;
  wmsUrl: string;
  layers: string;
  storeName?: string;
  resourceType?: string;
  cleanupGroup?: string;
  geoJsonPath?: string;
  sourceAssetId?: string;
}

type Events = {
  "add-analysis-layer": AnalysisLayerPayload;
};

const emitter = mitt<Events>();

export default emitter;
