import { Router } from "express";
import {
    createEmployee,
    getEmployees

} from "../controllers/employeeController.js";
import { factoryPermissions } from "../models/permissions.model.js";
const router = Router();

router.route("/emplyee/create").post(createEmployee);
router.route("/emplyee/get").get(getEmployees);

// Get permissions by factory
router.get("/permissions/:factory", (req, res) => {
  const { factory } = req.params;
  res.json(factoryPermissions[factory] || []);
});


// Hardcoded modules for each factory
const factoryModules = {
  "Falcon Facade": {
    modules: [
      { name: "Work Order", type: "standard" },
      { name: "Job Order", type: "standard" },
      { name: "Internal Work Order", type: "standard" },
      { 
        name: "Production", 
        type: "tab",
        tabs: ["Cutting", "Machining", "Assembling", "Glass fixing / glazing"]
      },
      { name: "Packings", type: "standard" },
      { name: "Dispatch", type: "standard" }
    ]
  },
  "Konkrete Klinkers": {
    modules: [
      { name: "Work Order", type: "standard" },
      { name: "Job Order", type: "standard" },
      { 
        name: "Production", 
        type: "tab",
        tabs: ["Planning", "Quality", "Output", "Efficiency"]
      },
      { name: "QC Check", type: "standard" },
      { name: "Packing", type: "standard" },
      { name: "Dispatch", type: "standard" },
      { name: "Inventory", type: "standard" },
      { name: "Stock Management", type: "standard" }
    ]
  },
  "Iron Smith": {
    modules: [
      { name: "Work Order", type: "standard" },
      { name: "Job Order", type: "standard" },
      { 
        name: "Production", 
        type: "tab",
        tabs: ["Past DPR", "Current DPR", "Future DPR"]
      },
      { name: "QC Check", type: "standard" },
      { name: "Packing", type: "standard" },
      { name: "Dispatch", type: "standard" }
    ]
  }
};

// API to get modules based on factory
router.get("/modules/:factoryName", (req, res) => {
  const { factoryName } = req.params;
  const modules = factoryModules[factoryName] || { modules: [] };
  res.json(modules);
});

export default router;

