import { API_ENDPOINTS } from "./endpoints";
import service, { BASE_URL } from "./request";

export interface CleanupResourceItem {
  storeName: string;
  layerName?: string;
  resourceType: string;
  cleanupGroup?: string;
}

export interface PublishDatasetResponse {
  code: number;
  message: string;
  storeName?: string;
  layerName?: string;
  resourceType: string;
  cleanupGroup?: string;
  wmsUrl?: string;
  layers?: string;
  viewparams?: string;
  fileUrl?: string;
  terrainUrl?: string;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
}

export const fetchUserDatasets = async () => {
  const response = await service.get(API_ENDPOINTS.users.datasets);
  return response.data;
};

export const deleteUserDataset = async (id: string | number) => {
  const response = await service.delete(API_ENDPOINTS.users.datasetById(id));
  return response.data;
};

export const uploadUserData = async (
  authHeader: string,
  formData: FormData,
  onUploadProgress?: (progressEvent: any) => void,
) => {
  const response = await service.post(API_ENDPOINTS.users.uploadData, formData, {
    headers: {
      Authorization: authHeader,
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress,
  });
  return response.data;
};

export const publishUserDataset = async (
  payload: { filename: string; assetId: string },
): Promise<PublishDatasetResponse> => {
  const response = await service.post(API_ENDPOINTS.users.publishDataset, payload);
  return response.data;
};

export const buildUserAssetFileUrl = (assetId: string | number) =>
  `${BASE_URL}${API_ENDPOINTS.users.assetFile(assetId)}`;

export const saveCzmlScene = async (payload: { name: string; czml: unknown[] }) => {
  const response = await service.post(API_ENDPOINTS.users.saveCzml, payload);
  return response.data;
};

export const sendDatasetCleanup = (payload: {
  workspace: string;
  resources: CleanupResourceItem[];
}) => {
  const url = `${BASE_URL}${API_ENDPOINTS.users.cleanupDatasets}`;
  const data = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(url, blob);
    return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data,
    keepalive: true,
  });
};
