export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
  },
  analysis: {
    submitTask: "/analysis/task",
  },
  ai: {
    plan: "/ai/plan",
  },
  users: {
    profile: "/users/profile",
    updateProfile: "/users/profile",
    uploadData: "/users/upload-data",
    datasets: "/users/datasets",
    datasetById: (id: string | number) => `/users/datasets/${id}`,
    assetFile: (id: string | number) => `/users/assets/${id}/file`,
    publishDataset: "/users/datasets/publish",
    saveCzml: "/users/datasets/czml",
    cleanupDatasets: "/users/datasets/cleanup",
    aiSettings: "/users/ai-settings",
  },
} as const;
