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
    publishDataset: "/users/datasets/publish",
    cleanupDatasets: "/users/datasets/cleanup",
    aiSettings: "/users/ai-settings",
  },
} as const;
