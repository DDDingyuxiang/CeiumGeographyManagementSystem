export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
  },
  analysis: {
    submitTask: "/analysis/task",
  },
  users: {
    profile: "/users/profile",
    updateProfile: "/users/profile",
    uploadData: "/users/upload-data",
    datasets: "/users/datasets",
    datasetById: (id: string | number) => `/users/datasets/${id}`,
    publishDataset: "/users/datasets/publish",
    cleanupDatasets: "/users/datasets/cleanup",
  },
} as const;
