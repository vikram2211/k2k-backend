export const factoryPermissions = {
  "Falcon Facade": [
    { module: "Work Order", create: true, read: true, update: true, updateStatus: true, delete: true },
    { module: "Job Order", create: true, read: true, update: true, updateStatus: false, delete: true },
    { module: "Daily Production Report", create: true, read: true, update: true, updateStatus: false, delete: false },
    { module: "Users", create: true, read: true, update: true, updateStatus: true, delete: false },
    { module: "QC Check", create: true, read: true, update: false, updateStatus: false, delete: true },
    { module: "Dispatch", create: true, read: true, update: true, updateStatus: true, delete: true },
    { module: "Packing", create: true, read: true, update: true, updateStatus: false, delete: false }
  ],
  "Konkrete Klinkers": [
    { module: "Work Order", create: false, read: true, update: false, updateStatus: false, delete: false },
    { module: "Job Order", create: true, read: true, update: false, updateStatus: false, delete: false },
    { module: "Daily Production Report", create: true, read: true, update: false, updateStatus: false, delete: false },
    { module: "Users", create: false, read: true, update: false, updateStatus: false, delete: false },
    { module: "QC Check", create: false, read: true, update: false, updateStatus: false, delete: false },
    { module: "Dispatch", create: true, read: true, update: false, updateStatus: false, delete: false },
    { module: "Packing", create: false, read: true, update: false, updateStatus: false, delete: false },
     { module: "Packing1", create: false, read: true, update: false, updateStatus: false, delete: false }
  ],
  "Iron Smith": [
    { module: "Work Order", create: true, read: true, update: false, updateStatus: false, delete: true },
    { module: "Job Order", create: false, read: true, update: false, updateStatus: false, delete: false },
    { module: "Daily Production Report", create: true, read: true, update: true, updateStatus: false, delete: false },
    { module: "Users", create: true, read: true, update: false, updateStatus: false, delete: false },
    { module: "QC Check", create: false, read: true, update: false, updateStatus: false, delete: false },
    { module: "Dispatch", create: true, read: true, update: true, updateStatus: false, delete: true },
    { module: "Packing", create: false, read: true, update: true, updateStatus: false, delete: false }
  ]
};
