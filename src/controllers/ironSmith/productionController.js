import { ironDailyProduction } from "../../models/ironSmith/dailyProductionPlanning.js";
import { ironJobOrder } from "../../models/ironSmith/jobOrders.model.js";
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parse } from 'date-fns'; // Ensure this import is present
import { addMinutes } from 'date-fns';
import { ironQCCheck } from "../../models/ironSmith/qcCheck.model.js";



// const getProductionData = asyncHandler(async (req, res) => {
//     // Get current date (start of day in IST)
//     const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
//     console.log("today",today);
//     const [todayDate] = today.split(','); // Extract date part (e.g., "7/29/2025")
//     const [month, day, year] = todayDate.split('/');
//     const currentDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).toISOString();
//     console.log("currentDate",currentDate);
  
//     ///// Fetch all production records /////
//     const productions = await ironDailyProduction
//       .find()
//       .populate({
//         path: 'work_order',
//         select: '_id workOrderNumber',
//       })
//       .populate({
//         path: 'job_order',
//         select: 'job_order_number',
//       })
//       .populate({
//         path: 'products.shape_id',
//         select: 'shape_code name',
//       })
//       .populate({
//         path: 'products.machines',
//         select: 'name',
//       })
//       .populate({
//         path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
//         select: 'username email',
//       })
//       .lean();
  
//     // Categorize production records
//     const categorizedProductions = {
//       pastDPR: [],
//       todayDPR: [],
//       futureDPR: [],
//     };
  
//     productions.forEach((production) => {
//       const productionDate = new Date(production.date).toISOString() // Normalize to date only .split('T')[0];
//       // console.log("productionDate",productionDate);
  
//       if (productionDate < currentDate) {
//         console.log("productionDatePast",productionDate);
//         categorizedProductions.pastDPR.push(production);
//       } else if (productionDate === currentDate) {
//         console.log("productionDateToday",productionDate);

//         categorizedProductions.todayDPR.push(production);
//       } else {
//         console.log("productionDateFuture",productionDate);

//         categorizedProductions.futureDPR.push(production);
//       }
//     });
  
//     return res.status(200).json(
//       new ApiResponse(200, {
//         pastDPR: categorizedProductions.pastDPR,
//         todayDPR: categorizedProductions.todayDPR,
//         futureDPR: categorizedProductions.futureDPR,
//       }, 'Production data fetched successfully')
//     );
//   });


const getProductionData_30_07_2025 = asyncHandler(async (req, res) => {
  // Get user-provided date from query or default to current date for reference
  let userDate;
  if (req.query.date) {
    const dateRegex = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/; // Matches YYYY-MM-DD
    if (!dateRegex.test(req.query.date)) {
      throw new ApiError(400, 'Invalid date format. Use YYYY-MM-DD (e.g., 2025-07-29)');
    }
    userDate = new Date(req.query.date).toISOString();
  } else {
    const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    console.log("today", today);
    const [todayDateStr] = today.split(',');
    const [month, day, year] = todayDateStr.split('/');
    userDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).toISOString();
    console.log("currentDate", userDate);
  }

  // Get today's date for comparison
  const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const [todayDateStr] = today.split(',');
  const [monthToday, dayToday, yearToday] = todayDateStr.split('/');
  const currentDate = new Date(`${yearToday}-${monthToday.padStart(2, '0')}-${dayToday.padStart(2, '0')}T00:00:00Z`).toISOString();

  // Fetch production records
  const productions = req.query.date
    ? await ironDailyProduction
        .find({ date: new Date(userDate).toISOString().split('T')[0] }) // Filter by exact date if provided
        .populate({
          path: 'work_order',
          select: '_id workOrderNumber',
        })
        .populate({
          path: 'job_order',
          select: 'job_order_number',
        })
        .populate({
          path: 'products.shape_id',
          select: 'shape_code name',
        })
        .populate({
          path: 'products.machines',
          select: 'name',
        })
        .populate({
          path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
          select: 'username email',
        })
        .lean()
    : await ironDailyProduction
        .find() // Fetch all records if no date provided
        .populate({
          path: 'work_order',
          select: '_id workOrderNumber',
        })
        .populate({
          path: 'job_order',
          select: 'job_order_number',
        })
        .populate({
          path: 'products.shape_id',
          select: 'shape_code name',
        })
        .populate({
          path: 'products.machines',
          select: 'name',
        })
        .populate({
          path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
          select: 'username email',
        })
        .lean();

  // Check if no data found when a date is provided
  if (req.query.date && productions.length === 0) {
    throw new ApiError(404, `No production data found for date ${new Date(userDate).toISOString().split('T')[0]}`);
  }

  // Categorize production records based on today's date
  const categorizedProductions = {
    pastDPR: [],
    todayDPR: [],
    futureDPR: [],
  };

  productions.forEach((production) => {
    const productionDate = new Date(production.date).toISOString();
    console.log("productionDate", productionDate);

    if (productionDate < currentDate) {
      console.log("productionDatePast", productionDate);
      categorizedProductions.pastDPR.push(production);
    } else if (productionDate === currentDate) {
      console.log("productionDateToday", productionDate);
      categorizedProductions.todayDPR.push(production);
    } else {
      console.log("productionDateFuture", productionDate);
      categorizedProductions.futureDPR.push(production);
    }
  });

  return res.status(200).json(
    new ApiResponse(200, {
      pastDPR: categorizedProductions.pastDPR,
      todayDPR: categorizedProductions.todayDPR,
      futureDPR: categorizedProductions.futureDPR,
    }, 'Production data fetched successfully')
  );
});

const getProductionData_24_09_2025 = asyncHandler(async (req, res) => {
  // Get user-provided date from query or default to current date for reference
  let userDate;
  if (req.query.date) {
    const dateRegex = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/; // Matches YYYY-MM-DD
    if (!dateRegex.test(req.query.date)) {
      throw new ApiError(400, 'Invalid date format. Use YYYY-MM-DD (e.g., 2025-07-29)');
    }
    userDate = new Date(req.query.date).toISOString();
  } else {
    const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    console.log("today", today);
    const [todayDateStr] = today.split(',');
    const [month, day, year] = todayDateStr.split('/');
    userDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).toISOString();
    console.log("currentDate", userDate);
  }

  // Get today's date for comparison
  const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const [todayDateStr] = today.split(',');
  const [monthToday, dayToday, yearToday] = todayDateStr.split('/');
  const currentDate = new Date(`${yearToday}-${monthToday.padStart(2, '0')}-${dayToday.padStart(2, '0')}T00:00:00Z`).toISOString();

  // Fetch production records with additional population for client and project
  const productions = req.query.date
    ? await ironDailyProduction
        .find({ date: new Date(userDate).toISOString().split('T')[0] }) // Filter by exact date if provided
        .populate({
          path: 'work_order',
          select: '_id workOrderNumber',
          populate: [
            {
              path: 'clientId',
              model: 'ironClient',
              select: 'name -_id', // Select only name, exclude _id
              options: { lean: true },
              transform: (doc) => doc.name, // Transform to just the name
            },
            {
              path: 'projectId',
              model: 'ironProject',
              select: 'name -_id', // Select only name, exclude _id
              options: { lean: true },
              transform: (doc) => doc.name, // Transform to just the name
            },
          ],
        })
        .populate({
          path: 'job_order',
          select: 'job_order_number',
        })
        .populate({
          path: 'products.shape_id',
          select: 'shape_code name',
        })
        .populate({
          path: 'products.machines',
          select: 'name',
        })
        .populate({
          path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
          select: 'username email',
        })
        .lean()
    : await ironDailyProduction
        .find() // Fetch all records if no date provided
        .populate({
          path: 'work_order',
          select: '_id workOrderNumber',
          populate: [
            {
              path: 'clientId',
              model: 'ironClient',
              select: 'name -_id',
              options: { lean: true },
              transform: (doc) => doc.name,
            },
            {
              path: 'projectId',
              model: 'ironProject',
              select: 'name -_id',
              options: { lean: true },
              transform: (doc) => doc.name,
            },
          ],
        })
        .populate({
          path: 'job_order',
          select: 'job_order_number',
        })
        .populate({
          path: 'products.shape_id',
          select: 'shape_code name',
        })
        .populate({
          path: 'products.machines',
          select: 'name',
        })
        .populate({
          path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
          select: 'username email',
        })
        .lean();

  // Check if no data found when a date is provided
  if (req.query.date && productions.length === 0) {
    throw new ApiError(404, `No production data found for date ${new Date(userDate).toISOString().split('T')[0]}`);
  }

  // Categorize production records based on today's date
  const categorizedProductions = {
    pastDPR: [],
    todayDPR: [],
    futureDPR: [],
  };

  productions.forEach((production) => {
    const productionDate = new Date(production.date).toISOString();
    console.log("productionDate", productionDate);

    if (productionDate < currentDate) {
      console.log("productionDatePast", productionDate);
      categorizedProductions.pastDPR.push(production);
    } else if (productionDate === currentDate) {
      console.log("productionDateToday", productionDate);
      categorizedProductions.todayDPR.push(production);
    } else {
      console.log("productionDateFuture", productionDate);
      categorizedProductions.futureDPR.push(production);
    }
  });

  return res.status(200).json(
    new ApiResponse(200, {
      pastDPR: categorizedProductions.pastDPR,
      todayDPR: categorizedProductions.todayDPR,
      futureDPR: categorizedProductions.futureDPR,
    }, 'Production data fetched successfully')
  );
});

const getProductionData = asyncHandler(async (req, res) => {
  // 1. Get today's date in IST
  const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const [todayDateStr] = today.split(',');
  const [monthToday, dayToday, yearToday] = todayDateStr.split('/');
  const currentDate = new Date(`${yearToday}-${monthToday.padStart(2, '0')}-${dayToday.padStart(2, '0')}T00:00:00Z`);

  // 2. Fetch production records (with full population)
  const productions = req.query.date
    ? await ironDailyProduction
        .find({ date: new Date(req.query.date) })
        .populate({
          path: 'work_order',
          select: '_id workOrderNumber',
          populate: [
            {
              path: 'clientId',
              model: 'ironClient',
              select: 'name -_id',
              options: { lean: true },
              transform: (doc) => doc.name,
            },
            {
              path: 'projectId',
              model: 'ironProject',
              select: 'name -_id',
              options: { lean: true },
              transform: (doc) => doc.name,
            },
          ],
        })
        .populate({
          path: 'job_order',
          select: 'job_order_number date_range',
        })
        .populate({
          path: 'products.shape_id',
          select: 'shape_code name',
        })
        .populate({
          path: 'products.machines',
          select: 'name',
        })
        .populate({
          path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
          select: 'username email',
        })
        .lean()
    : await ironDailyProduction
        .find()
        .populate({
          path: 'work_order',
          select: '_id workOrderNumber',
          populate: [
            {
              path: 'clientId',
              model: 'ironClient',
              select: 'name -_id',
              options: { lean: true },
              transform: (doc) => doc.name,
            },
            {
              path: 'projectId',
              model: 'ironProject',
              select: 'name -_id',
              options: { lean: true },
              transform: (doc) => doc.name,
            },
          ],
        })
        .populate({
          path: 'job_order',
          select: 'job_order_number date_range',
        })
        .populate({
          path: 'products.shape_id',
          select: 'shape_code name',
        })
        .populate({
          path: 'products.machines',
          select: 'name',
        })
        .populate({
          path: 'submitted_by created_by updated_by qc_checked_by production_logs.user',
          select: 'username email',
        })
        .lean();

  // 3. Categorize based on Job Order's date_range
  const categorizedProductions = {
    pastDPR: [],
    todayDPR: [],
    futureDPR: [],
  };
  console.log("productions",productions);

  productions.forEach((production) => {
    const { date_range } = production.job_order;
    const fromDate = new Date(date_range.from);
    const toDate = new Date(date_range.to);

    if (fromDate <= currentDate && toDate >= currentDate) {
      categorizedProductions.todayDPR.push(production);
    } else if (toDate < currentDate) {
      categorizedProductions.pastDPR.push(production);
    } else {
      categorizedProductions.futureDPR.push(production);
    }
  });

  // 4. Return the same response structure
  return res.status(200).json(
    new ApiResponse(200, categorizedProductions, 'Production data fetched successfully')
  );
});


const manageIronProductionActions1 = asyncHandler(async (req, res) => {
  try {
    const { action, job_order, shape_id, _id } = req.body;

    // Validate required fields
    if (!['start', 'pause', 'resume', 'stop'].includes(action)) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Invalid action. Must be "start", "pause", "resume", or "stop".')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    if (!job_order || !shape_id || !_id) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, _id.')
      );
    }

    // Fetch the JobOrder to validate shape_id
    const jobOrder = await ironJobOrder.findById(job_order).populate('work_order', 'work_order_number');
    if (!jobOrder) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Job order not found.')
      );
    }
    // console.log("product",jobOrder.products)
    // console.log("shape_id",shape_id)

    const jobOrderShape = jobOrder.products.find((product) =>
  
      product.shape.equals(shape_id)
    );
    if (!jobOrderShape) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Shape ID not found in job order.')
      );
    }

    // Fetch or initialize DailyProduction
    let dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
    });

    if (action === 'start') {
      if (dailyProduction) {
        if (dailyProduction.started_at) {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production already started for this job order and shape.')
          );
        }
        dailyProduction.started_at = new Date();
        dailyProduction.submitted_by = req.user._id;
        dailyProduction.updated_by = req.user._id;
        dailyProduction.status = 'In Progress';
        dailyProduction.production_logs.push({
          action: 'Start',
          timestamp: new Date(),
          user: req.user._id,
          description: 'Production started',
        });
        const updatedProduction = await dailyProduction.save();
        return res.status(200).json(
          new ApiResponse(200, updatedProduction, 'Production started successfully for the specified shape.')
        );
      } else {
        const schemaProducts = jobOrder.products
          .filter((product) => product.shape_id.equals(shape_id))
          .map((product) => ({
            shape_id: product.shape_id,
            planned_quantity: product.planned_quantity,
            machines: product.machines || [],
            achieved_quantity: 0,
            rejected_quantity: 0,
            recycled_quantity: 0,
          }));

        if (schemaProducts.length === 0) {
          return res.status(400).json(
            new ApiResponse(400, null, 'No matching shape found to start production.')
          );
        }

        const newProduction = new ironDailyProduction({
          work_order: jobOrder.work_order._id,
          job_order,
          products: schemaProducts,
          submitted_by: req.user._id,
          started_at: new Date(),
          created_by: req.user._id,
          updated_by: req.user._id,
          status: 'In Progress',
          production_logs: [
            {
              action: 'Start',
              timestamp: new Date(),
              user: req.user._id,
              description: 'Production started',
            },
          ],
        });

        const savedProduction = await newProduction.save();
        return res.status(201).json(
          new ApiResponse(201, savedProduction, 'Production started successfully.')
        );
      }
    } else {
      // Handle pause, resume, stop (requires existing dailyProduction)
      if (!dailyProduction) {
        return res.status(404).json(
          new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
        );
      }
      if (!dailyProduction.started_at) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Production has not started for this job order and shape.')
        );
      }
      if (dailyProduction.stopped_at && action !== 'resume') {
        return res.status(400).json(
          new ApiResponse(400, null, 'Production already stopped for this job order and shape.')
        );
      }

      // Validate the _id exists in the products array
      const productIndex = dailyProduction.products.findIndex((p) => p._id.equals(_id));
      if (productIndex === -1) {
        return res.status(404).json(
          new ApiResponse(404, null, '_id not found in the products array.')
        );
      }

      if (action === 'pause') {
        if (dailyProduction.status === 'Paused') {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production is already paused.')
          );
        }
        dailyProduction.status = 'Paused';
        dailyProduction.updated_by = req.user._id;
        dailyProduction.production_logs.push({
          action: 'Pause',
          timestamp: new Date(),
          user: req.user._id,
          description: req.body.pause_description || 'Production paused',
        });
      } else if (action === 'resume') {
        if (dailyProduction.status !== 'Paused') {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production is not paused.')
          );
        }
        if (!dailyProduction.stopped_at) {
          dailyProduction.status = 'In Progress';
          dailyProduction.updated_by = req.user._id;
          dailyProduction.production_logs.push({
            action: 'Resume',
            timestamp: new Date(),
            user: req.user._id,
            description: 'Production resumed',
          });
        } else {
          return res.status(400).json(
            new ApiResponse(400, null, 'Cannot resume a stopped production.')
          );
        }
      } else if (action === 'stop') {
        if (dailyProduction.status === 'Pending QC') {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production is already stopped and pending QC.')
          );
        }
        dailyProduction.stopped_at = new Date();
        dailyProduction.updated_by = req.user._id;
        dailyProduction.status = 'Pending QC';
        dailyProduction.production_logs.push({
          action: 'Stop',
          timestamp: new Date(),
          user: req.user._id,
          description: 'Production stopped',
        });
      }

      // Add downtime if provided, associated with the specific product
      if (req.body.downtime && req.body.downtime.description && req.body.downtime.minutes !== undefined) {
        const downtimeEntry = {
          description: req.body.downtime.description,
          minutes: Number(req.body.downtime.minutes),
          remarks: req.body.downtime.remarks,
        };
        dailyProduction.downtime.push(downtimeEntry);
      }

      const updatedProduction = await dailyProduction.save();
      return res.status(200).json(
        new ApiResponse(200, updatedProduction, `Production ${action}ed successfully for the specified shape.`)
      );
    }
  } catch (error) {
    console.error('Error managing iron production action:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});

const manageIronProductionActions = asyncHandler(async (req, res) => {
  try {
    const { action, job_order, shape_id, object_id } = req.body;
    console.log("shape_id",shape_id);
    console.log("object_id",object_id);

    if (!['start', 'pause', 'resume', 'stop'].includes(action)) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Invalid action. Must be "start", "pause", "resume", or "stop".')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    if (!job_order || !shape_id || !object_id) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, object_id.')
      );
    }

    const jobOrder = await ironJobOrder.findById(job_order).populate('work_order', 'work_order_number');
    if (!jobOrder) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Job order not found.')
      );
    }
    console.log("jobOrder.products",jobOrder.products);

    const jobOrderProduct = jobOrder.products.find((product) =>
      product.shape.equals(shape_id) && product._id.equals(object_id)
    );
    if (!jobOrderProduct) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Shape ID or object_id not found in job order.')
      );
    }

    let dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id,
    });

    if (action === 'start') {
      if (dailyProduction) {
        if (dailyProduction.started_at) {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production already started for this job order and shape.')
          );
        }
        dailyProduction.started_at = new Date();
        dailyProduction.submitted_by = req.user._id;
        dailyProduction.updated_by = req.user._id;
        dailyProduction.status = 'In Progress';
        dailyProduction.production_logs.push({
          action: 'Start',
          timestamp: new Date(),
          user: req.user._id,
          description: 'Production started',
        });
        const updatedProduction = await dailyProduction.save();
        return res.status(200).json(
          new ApiResponse(200, updatedProduction, 'Production started successfully for the specified shape.')
        );
      } else {
        const schemaProducts = jobOrder.products
          .filter((product) => product.shape.equals(shape_id) && product._id.equals(object_id))
          .map((product) => ({
            object_id: product._id,
            shape_id: product.shape,
            planned_quantity: product.planned_quantity,
            machines: product.selected_machines || [],
            achieved_quantity: 0,
            rejected_quantity: 0,
            recycled_quantity: 0,
          }));

        if (schemaProducts.length === 0) {
          return res.status(400).json(
            new ApiResponse(400, null, 'No matching shape and object_id found to start production.')
          );
        }

        const newProduction = new ironDailyProduction({
          work_order: jobOrder.work_order._id,
          job_order,
          products: schemaProducts,
          submitted_by: req.user._id,
          started_at: new Date(),
          created_by: req.user._id,
          updated_by: req.user._id,
          status: 'In Progress',
          production_logs: [
            {
              action: 'Start',
              timestamp: new Date(),
              user: req.user._id,
              description: 'Production started',
            },
          ],
        });

        const savedProduction = await newProduction.save();
        return res.status(201).json(
          new ApiResponse(201, savedProduction, 'Production started successfully.')
        );
      }
    } else {
      if (!dailyProduction) {
        return res.status(404).json(
          new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
        );
      }
      if (!dailyProduction.started_at) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Production has not started for this job order and shape.')
        );
      }
      if (dailyProduction.stopped_at && action !== 'resume') {
        return res.status(400).json(
          new ApiResponse(400, null, 'Production already stopped for this job order and shape.')
        );
      }

      const productIndex = dailyProduction.products.findIndex((p) => p.object_id.equals(object_id));
      if (productIndex === -1) {
        return res.status(404).json(
          new ApiResponse(404, 'object_id not found in the products array.')
        );
      }

      if (action === 'pause') {
        if (dailyProduction.status === 'Paused') {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production is already paused.')
          );
        }
        dailyProduction.status = 'Paused';
        dailyProduction.updated_by = req.user._id;
        dailyProduction.production_logs.push({
          action: 'Pause',
          timestamp: new Date(),
          user: req.user._id,
          description: req.body.pause_description || 'Production paused',
        });
      } else if (action === 'resume') {
        if (dailyProduction.status !== 'Paused') {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production is not paused.')
          );
        }
        if (!dailyProduction.stopped_at) {
          dailyProduction.status = 'In Progress';
          dailyProduction.updated_by = req.user._id;
          dailyProduction.production_logs.push({
            action: 'Resume',
            timestamp: new Date(),
            user: req.user._id,
            description: 'Production resumed',
          });
        } else {
          return res.status(400).json(
            new ApiResponse(400, null, 'Cannot resume a stopped production.')
          );
        }
      } else if (action === 'stop') {
        if (dailyProduction.status === 'Pending QC') {
          return res.status(400).json(
            new ApiResponse(400, null, 'Production is already stopped and pending QC.')
          );
        }
        dailyProduction.stopped_at = new Date();
        dailyProduction.updated_by = req.user._id;
        dailyProduction.status = 'Pending QC';
        dailyProduction.production_logs.push({
          action: 'Stop',
          timestamp: new Date(),
          user: req.user._id,
          description: 'Production stopped',
        });
      }

      if (req.body.downtime && req.body.downtime.description && req.body.downtime.minutes !== undefined) {
        const downtimeEntry = {
          description: req.body.downtime.description,
          minutes: Number(req.body.downtime.minutes),
          remarks: req.body.downtime.remarks,
        };
        dailyProduction.downtime.push(downtimeEntry);
      }

      const updatedProduction = await dailyProduction.save();
      return res.status(200).json(
        new ApiResponse(200, updatedProduction, `Production ${action}ed successfully for the specified shape.`)
      );
    }
  } catch (error) {
    console.error('Error managing iron production action:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});


// const updateIronProductionQuantities = asyncHandler(async (req, res) => {
//   try {
//     const { job_order, shape_id, _id, achieved_quantity } = req.body;

//     // Validate required fields
//     if (!job_order || !shape_id || !_id) {
//       return res.status(400).json(
//         new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, _id.')
//       );
//     }

//     if (!req.user || !req.user._id) {
//       return res.status(401).json(
//         new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
//       );
//     }

//     // Fetch the JobOrder to validate shape_id and _id and get planned_quantity
//     const jobOrder = await ironJobOrder.findById(job_order).populate('work_order', 'work_order_number');
//     if (!jobOrder) {
//       return res.status(404).json(
//         new ApiResponse(404, null, 'Job order not found.')
//       );
//     }
//     // console.log("shape_id",shape_id);
//     // console.log("products",jobOrder.products);

//     const jobOrderShape = jobOrder.products.find((product) =>
//       product.shape.equals(shape_id)
//     );
//     if (!jobOrderShape) {
//       return res.status(400).json(
//         new ApiResponse(400, null, 'Shape ID and _id combination not found in job order.')
//       );
//     }

//     const plannedQuantity = jobOrderShape.planned_quantity;

//     // Fetch the DailyProduction document
//     const dailyProduction = await ironDailyProduction.findOne({
//       job_order,
//       'products.shape_id': shape_id,
//       'products._id':_id
//     });
//     console.log("dailyProduction",dailyProduction);

//     if (!dailyProduction) {
//       return res.status(404).json(
//         new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
//       );
//     }

//     // Find the specific product in the products array using _id
//     const productIndex = dailyProduction.products.findIndex((p) => p._id.equals(_id));
//     if (productIndex === -1) {
//       return res.status(404).json(
//         new ApiResponse(404, null, '_id not found in the products array.')
//       );
//     }

//     // Validate and update achieved_quantity
//     if (achieved_quantity !== undefined) {
//       if (isNaN(achieved_quantity) || achieved_quantity < 0) {
//         return res.status(400).json(
//           new ApiResponse(400, null, 'Achieved quantity must be a non-negative number.')
//         );
//       }
//       if (achieved_quantity > plannedQuantity) {
//         return res.status(400).json(
//           new ApiResponse(400, null, 'Achieved quantity cannot exceed planned quantity.')
//         );
//       }
//       dailyProduction.products[productIndex].achieved_quantity = achieved_quantity;
//     } else {
//       return res.status(400).json(
//         new ApiResponse(400, null, 'Achieved quantity is required for update.')
//       );
//     }

//     dailyProduction.updated_by = req.user._id;
//     const updatedProduction = await dailyProduction.save();

//     return res.status(200).json(
//       new ApiResponse(200, updatedProduction, 'Production quantities updated successfully.')
//     );
//   } catch (error) {
//     console.error('Error updating iron production quantities:', error);
//     return res.status(500).json(
//       new ApiResponse(500, null, 'Internal Server Error', error.message)
//     );
//   }
// });


const updateIronProductionQuantities1 = asyncHandler(async (req, res) => {
  try {
    const { job_order, shape_id, _id, achieved_quantity ,remarks} = req.body;

    // Validate required fields
    if (!job_order || !shape_id || !_id) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, _id.')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    // Fetch the JobOrder to validate shape_id and get planned_quantity
    const jobOrder = await ironJobOrder.findById(job_order).populate('work_order', 'work_order_number');
    if (!jobOrder) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Job order not found.')
      );
    }

    const jobOrderShape = jobOrder.products.find((product) =>
      product.shape.equals(shape_id)
    );
    if (!jobOrderShape) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Shape ID not found in job order.')
      );
    }

    const plannedQuantity = jobOrderShape.planned_quantity;

    // Fetch the DailyProduction document
    const dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products._id': _id
    });
    // console.log("dailyProduction", dailyProduction);

    if (!dailyProduction) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
      );
    }

    // Check if production has started
    if (!dailyProduction.started_at) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Cannot update quantity. Production has not started.')
      );
    }

    // Find the specific product in the products array using _id
    const productIndex = dailyProduction.products.findIndex((p) => p._id.equals(_id));
    if (productIndex === -1) {
      return res.status(404).json(
        new ApiResponse(404, null, '_id not found in the products array.')
      );
    }

    // Validate and update achieved_quantity (add to existing value)
    if (achieved_quantity !== undefined) {
      if (isNaN(achieved_quantity) || achieved_quantity < 0) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Achieved quantity must be a non-negative number.')
        );
      }
      const currentAchievedQuantity = dailyProduction.products[productIndex].achieved_quantity || 0;
      const newAchievedQuantity = currentAchievedQuantity + achieved_quantity;
      if (newAchievedQuantity > plannedQuantity) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Achieved quantity cannot exceed planned quantity.')
        );
      }
      dailyProduction.products[productIndex].achieved_quantity = newAchievedQuantity;
      // Add to production_logs
      dailyProduction.production_logs.push({
        action: 'UpdateQuantity',
        user: req.user._id,
        achieved_quantity: achieved_quantity,
        description:remarks
      });
    } else {
      return res.status(400).json(
        new ApiResponse(400, null, 'Achieved quantity is required for update.')
      );
    }

    dailyProduction.updated_by = req.user._id;
    const updatedProduction = await dailyProduction.save();

    return res.status(200).json(
      new ApiResponse(200, updatedProduction, 'Production quantities updated successfully.')
    );
  } catch (error) {
    console.error('Error updating iron production quantities:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});


const updateIronProductionQuantities = asyncHandler(async (req, res) => {
  try {
    const { job_order, shape_id, object_id, achieved_quantity, remarks } = req.body;

    if (!job_order || !shape_id || !object_id) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, object_id.')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    const jobOrder = await ironJobOrder.findById(job_order).populate('work_order', 'work_order_number');
    if (!jobOrder) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Job order not found.')
      );
    }

    const jobOrderShape = jobOrder.products.find((product) =>
      product.shape.equals(shape_id) && product._id.equals(object_id)
    );
    if (!jobOrderShape) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Shape ID or object_id not found in job order.')
      );
    }

    const plannedQuantity = jobOrderShape.planned_quantity;

    const dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id,
    });

    if (!dailyProduction) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
      );
    }

    if (!dailyProduction.started_at) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Cannot update quantity. Production has not started.')
      );
    }

    const productIndex = dailyProduction.products.findIndex((p) => p.object_id.equals(object_id));
    if (productIndex === -1) {
      return res.status(404).json(
        new ApiResponse(404, null, 'object_id not found in the products array.')
      );
    }

    if (achieved_quantity !== undefined) {
      if (isNaN(achieved_quantity) || achieved_quantity < 0) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Achieved quantity must be a non-negative number.')
        );
      }
      const currentAchievedQuantity = dailyProduction.products[productIndex].achieved_quantity || 0;
      const newAchievedQuantity = currentAchievedQuantity + achieved_quantity;
      if (newAchievedQuantity > plannedQuantity) {
        return res.status(400).json(
          new ApiResponse(400, null, 'Achieved quantity cannot exceed planned quantity.')
        );
      }
      dailyProduction.products[productIndex].achieved_quantity = newAchievedQuantity;
      dailyProduction.production_logs.push({
        action: 'UpdateQuantity',
        user: req.user._id,
        achieved_quantity: achieved_quantity,
        description: remarks,
      });
    } else {
      return res.status(400).json(
        new ApiResponse(400, null, 'Achieved quantity is required for update.')
      );
    }

    dailyProduction.updated_by = req.user._id;
    const updatedProduction = await dailyProduction.save();

    return res.status(200).json(
      new ApiResponse(200, updatedProduction, 'Production quantities updated successfully.')
    );
  } catch (error) {
    console.error('Error updating iron production quantities:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});

const addIronDowntime1 = async (req, res, next) => {
  try {
    const { job_order, shape_id, _id, description, minutes, remarks, downtime_start_time } = req.body;

    // Validate required fields
    if (!job_order || !shape_id || !_id || !description || minutes === undefined) {
      return next(
        new ApiError(400, 'Missing required fields: job_order, shape_id, _id, description, minutes')
      );
    }

    // Validate minutes is a non-negative number
    if (isNaN(minutes) || minutes < 0) {
      return next(new ApiError(400, 'Minutes must be a non-negative number'));
    }

    // Validate and parse downtime_start_time if provided
    let parsedDowntimeStartTime;
    if (downtime_start_time) {
      try {
        // Set base date to today at 00:00:00 IST
        const today = new Date(2025, 6, 29); // July 29, 2025 (month is 0-indexed)
        console.log('Base date:', today); // Debug base date
        // Try parsing as "HH:mm" (e.g., "14:30")
        parsedDowntimeStartTime = parse(
          downtime_start_time,
          'HH:mm',
          today
        );
        console.log('Parsed HH:mm:', parsedDowntimeStartTime); // Debug parsed result

        // If parsing fails, try the old format "h:mm a" (e.g., "2:30 PM")
        if (isNaN(parsedDowntimeStartTime.getTime())) {
          parsedDowntimeStartTime = parse(
            downtime_start_time,
            'h:mm a',
            today
          );
          console.log('Parsed h:mm a:', parsedDowntimeStartTime); // Debug fallback
        }

        // If both parsing attempts fail, return an error
        if (isNaN(parsedDowntimeStartTime.getTime())) {
          return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "14:30" or "2:30 PM"'));
        }
      } catch (error) {
        console.error('Error parsing downtime_start_time:', error);
        return next(new ApiError(400, 'Invalid downtime_start_time format'));
      }
    }

    // Find the DailyProduction document
    const dailyProduction = await ironDailyProduction.findOne({
      job_order: job_order,
      'products.shape_id': shape_id,
      'products._id': _id,
    });

    if (!dailyProduction) {
      return next(
        new ApiError(404, 'DailyProduction document not found for the specified job order, shape, and _id')
      );
    }

    // Create new downtime entry
    const downtimeEntry = {
      downtime_start_time: parsedDowntimeStartTime || undefined,
      description,
      minutes: Number(minutes),
      remarks,
    };

    // Add downtime to the array and update updated_by
    dailyProduction.downtime.push(downtimeEntry);
    dailyProduction.updated_by = req.user?._id || null;

    // Save the updated document
    const updatedProduction = await dailyProduction.save();

    return res.status(200).json({
      success: true,
      message: 'Downtime added successfully',
      data: updatedProduction,
    });
  } catch (error) {
    console.error('Error adding downtime:', error);
    next(new ApiError(500, 'Internal Server Error', error.message));
  }
};

const addIronDowntime = async (req, res, next) => {
  try {
    const { job_order, shape_id, object_id, description, minutes, remarks, downtime_start_time } = req.body;

    if (!job_order || !shape_id || !object_id || !description || minutes === undefined) {
      return next(
        new ApiError(400, 'Missing required fields: job_order, shape_id, object_id, description, minutes')
      );
    }

    if (isNaN(minutes) || minutes < 0) {
      return next(new ApiError(400, 'Minutes must be a non-negative number'));
    }

    let parsedDowntimeStartTime;
    if (downtime_start_time) {
      try {
        const today = new Date(2025, 7, 1); // August 01, 2025 (month is 0-indexed)
        console.log('Base date:', today);
        parsedDowntimeStartTime = parse(
          downtime_start_time,
          'HH:mm',
          today
        );
        if (isNaN(parsedDowntimeStartTime.getTime())) {
          parsedDowntimeStartTime = parse(
            downtime_start_time,
            'h:mm a',
            today
          );
        }
        if (isNaN(parsedDowntimeStartTime.getTime())) {
          return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "14:30" or "2:30 PM"'));
        }
      } catch (error) {
        console.error('Error parsing downtime_start_time:', error);
        return next(new ApiError(400, 'Invalid downtime_start_time format'));
      }
    }

    const dailyProduction = await ironDailyProduction.findOne({
      job_order: job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id,
    });

    if (!dailyProduction) {
      return next(
        new ApiError(404, 'DailyProduction document not found for the specified job order, shape, and object_id')
      );
    }

    const downtimeEntry = {
      downtime_start_time: parsedDowntimeStartTime || undefined,
      description,
      minutes: Number(minutes),
      remarks,
    };

    dailyProduction.downtime.push(downtimeEntry);
    dailyProduction.updated_by = req.user?._id || null;

    const updatedProduction = await dailyProduction.save();

    return res.status(200).json({
      success: true,
      message: 'Downtime added successfully',
      data: updatedProduction,
    });
  } catch (error) {
    console.error('Error adding downtime:', error);
    next(new ApiError(500, 'Internal Server Error', error.message));
  }
};

const getIronDowntime1 = async (req, res, next) => {
  try {
    const { shape_id, _id, job_order } = req.query;

    // Validate shape_id, _id, and job_order
    if (!shape_id || !mongoose.isValidObjectId(shape_id)) {
      return res.status(400).json({ success: false, message: 'Valid shape_id is required' });
    }
    if (!_id || !mongoose.isValidObjectId(_id)) {
      return res.status(400).json({ success: false, message: 'Valid _id is required' });
    }
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // Fetch DailyProduction document for the shape_id, _id, and job_order
    const dailyProduction = await ironDailyProduction.findOne({
      job_order: job_order,
      'products.shape_id': shape_id,
      'products._id': _id,
    }).lean();

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No downtime records found for the specified shape, _id, and job order',
        data: [],
      });
    }

    // Prepare the response with only downtime entries
    const downtimeRecords = dailyProduction.downtime && dailyProduction.downtime.length > 0
      ? dailyProduction.downtime.map((downtime) => {
        // Calculate end_time if downtime_start_time and minutes are available
        const start_time = downtime.downtime_start_time || null;
        const end_time =
          start_time && downtime.minutes != null
            ? addMinutes(new Date(start_time), downtime.minutes)
            : null;

        return {
          start_time,
          end_time,
          reason: downtime.description || 'N/A',
          total_duration: downtime.minutes != null ? downtime.minutes : null,
          remarks: downtime.remarks || null,
          _id: downtime._id,
        };
      })
      : [];

    return res.status(200).json({
      success: true,
      message: 'Downtime records fetched successfully',
      data: downtimeRecords,
    });
  } catch (error) {
    console.error('Error fetching downtime records:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getIronDowntime = async (req, res, next) => {
  try {
    const { shape_id, object_id, job_order } = req.query;

    // Validate shape_id, object_id, and job_order
    if (!shape_id || !mongoose.isValidObjectId(shape_id)) {
      return res.status(400).json({ success: false, message: 'Valid shape_id is required' });
    }
    if (!object_id || !mongoose.isValidObjectId(object_id)) {
      return res.status(400).json({ success: false, message: 'Valid object_id is required' });
    }
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // Fetch DailyProduction document for the shape_id, object_id, and job_order
    const dailyProduction = await ironDailyProduction.findOne({
      job_order: job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id, // Use object_id instead of _id
    }).lean();

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No downtime records found for the specified shape, object_id, and job order',
        data: [],
        object_id: object_id, // Include object_id in response
      });
    }

    // Prepare the response with only downtime entries
    const downtimeRecords = dailyProduction.downtime && dailyProduction.downtime.length > 0
      ? dailyProduction.downtime.map((downtime) => {
        const start_time = downtime.downtime_start_time || null;
        const end_time =
          start_time && downtime.minutes != null
            ? addMinutes(new Date(start_time), downtime.minutes)
            : null;

        return {
          start_time,
          end_time,
          reason: downtime.description || 'N/A',
          total_duration: downtime.minutes != null ? downtime.minutes : null,
          remarks: downtime.remarks || null,
          _id: downtime._id,
        };
      })
      : [];

    return res.status(200).json({
      success: true,
      message: 'Downtime records fetched successfully',
      data: downtimeRecords,
      object_id: object_id, // Include object_id in response
    });
  } catch (error) {
    console.error('Error fetching downtime records:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getProductionLog1 = async (req, res, next) => {
  try {
    const { job_order, shape_id, _id } = req.query;

    // Validate query parameters
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }
    if (!shape_id || !mongoose.isValidObjectId(shape_id)) {
      return res.status(400).json({ success: false, message: 'Valid shape_id is required' });
    }
    if (!_id || !mongoose.isValidObjectId(_id)) {
      return res.status(400).json({ success: false, message: 'Valid _id is required' });
    }

    // Fetch the DailyProduction document for the specified job_order, shape_id, and _id
    const dailyProduction = await ironDailyProduction.findOne({
      job_order: job_order,
      'products.shape_id': shape_id,
      'products._id': _id,
    }).populate({
      path: 'production_logs.user',
      model: 'User',
      select: 'username' // Only fetch the username field
    }).lean();

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No production log records found for the specified job order, shape, and _id',
        data: [],
      });
    }

    // Prepare the response with production log entries
    const productionLogRecords = dailyProduction.production_logs && dailyProduction.production_logs.length > 0
      ? dailyProduction.production_logs.map((log) => ({
          action: log.action,
          timestamp: log.timestamp,
          user: log.user._id,
          username: log.user.username, // Include the username
          description: log.description || 'N/A',
          achieved_quantity: log.achieved_quantity || null, // Only present for UpdateQuantity actions
        }))
      : [];

    return res.status(200).json({
      success: true,
      message: 'Production log records fetched successfully',
      data: productionLogRecords,
    });
  } catch (error) {
    console.error('Error fetching production log records:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getProductionLog = async (req, res, next) => {
  try {
    const { job_order, shape_id, object_id } = req.query;
    console.log("job_order",job_order);
    console.log("shape_id",shape_id);
    console.log("object_id",object_id);

    // Validate query parameters
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }
    if (!shape_id || !mongoose.isValidObjectId(shape_id)) {
      return res.status(400).json({ success: false, message: 'Valid shape_id is required' });
    }
    if (!object_id || !mongoose.isValidObjectId(object_id)) {
      return res.status(400).json({ success: false, message: 'Valid object_id is required' });
    }

    // Fetch the DailyProduction document for the specified job_order, shape_id, and object_id
    const dailyProduction = await ironDailyProduction.findOne({
      job_order: job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id, // Use object_id instead of _id
    }).populate({
      path: 'production_logs.user',
      model: 'User',
      select: 'username',
    }).lean();

    
    console.log("dailyProduction",dailyProduction);

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No production log records found for the specified job order, shape, and object_id',
        data: [],
        object_id: object_id, // Include object_id in response
      });
    }

    // Prepare the response with production log entries
    const productionLogRecords = dailyProduction.production_logs && dailyProduction.production_logs.length > 0
      ? dailyProduction.production_logs.map((log) => ({
          action: log.action,
          timestamp: log.timestamp,
          user: log.user._id,
          username: log.user.username,
          description: log.description || 'N/A',
          achieved_quantity: log.achieved_quantity || null,
        }))
      : [];

    return res.status(200).json({
      success: true,
      message: 'Production log records fetched successfully',
      data: productionLogRecords,
      object_id: object_id, // Include object_id in response
    });
  } catch (error) {
    console.error('Error fetching production log records:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const addQcCheck1 = asyncHandler(async (req, res) => {
  try {
    const { job_order, shape_id, _id, rejected_quantity, remarks } = req.body;

    // Validate required fields
    if (!job_order || !shape_id || !_id || rejected_quantity === undefined) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, _id, rejected_quantity.')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    // Validate rejected_quantity
    if (isNaN(rejected_quantity) || rejected_quantity < 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Rejected quantity must be a non-negative number.')
      );
    }

    // Fetch the DailyProduction document
    const dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products._id': _id,
    });

    if (!dailyProduction) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
      );
    }

    // Find the specific product in the products array using _id
    const productIndex = dailyProduction.products.findIndex((p) => p._id.equals(_id));
    if (productIndex === -1) {
      return res.status(404).json(
        new ApiResponse(404, null, '_id not found in the products array.')
      );
    }

    // Update rejected_quantity in the production record
    const currentRejectedQuantity = dailyProduction.products[productIndex].rejected_quantity || 0;
    const newRejectedQuantity = currentRejectedQuantity + rejected_quantity;
    dailyProduction.products[productIndex].rejected_quantity = newRejectedQuantity;

    // Update qc_checked_by
    dailyProduction.qc_checked_by = req.user._id;

    // Add to production_logs
    dailyProduction.production_logs.push({
      action: 'QCCheck',
      user: req.user._id,
      description: remarks || 'N/A',
      rejected_quantity: newRejectedQuantity, // Track the updated rejected quantity
    });

    dailyProduction.updated_by = req.user._id;
    const updatedProduction = await dailyProduction.save();

    // Create QC check record
    const qcCheckData = {
      work_order: dailyProduction.work_order,
      job_order: dailyProduction.job_order,
      shape_id: shape_id,
      rejected_quantity: rejected_quantity,
      recycled_quantity: 0, // Default to 0 if not provided
      remarks: remarks,
      created_by: req.user._id,
    };

    const newQcCheck = new ironQCCheck(qcCheckData);
    await newQcCheck.save();

    return res.status(200).json(
      new ApiResponse(200, {
        production: updatedProduction,
        qcCheck: newQcCheck,
      }, 'QC check added and production record updated successfully.')
    );
  } catch (error) {
    console.error('Error adding QC check:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});

const addQcCheck2 = asyncHandler(async (req, res) => {
  try {
    const { job_order, shape_id, object_id, rejected_quantity, remarks } = req.body;

    if (!job_order || !shape_id || !object_id || rejected_quantity === undefined) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, object_id, rejected_quantity.')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    if (isNaN(rejected_quantity) || rejected_quantity < 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Rejected quantity must be a non-negative number.')
      );
    }

    const dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id,
    });

    if (!dailyProduction) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
      );
    }

    const productIndex = dailyProduction.products.findIndex((p) => p.object_id.equals(object_id));
    if (productIndex === -1) {
      return res.status(404).json(
        new ApiResponse(404, null, 'object_id not found in the products array.')
      );
    }

    const currentRejectedQuantity = dailyProduction.products[productIndex].rejected_quantity || 0;
    const newRejectedQuantity = currentRejectedQuantity + rejected_quantity;
    dailyProduction.products[productIndex].rejected_quantity = newRejectedQuantity;

    dailyProduction.qc_checked_by = req.user._id;
    dailyProduction.production_logs.push({
      action: 'QCCheck',
      user: req.user._id,
      description: remarks || 'N/A',
      rejected_quantity: newRejectedQuantity,
    });

    dailyProduction.updated_by = req.user._id;
    const updatedProduction = await dailyProduction.save();

    const qcCheckData = {
      work_order: dailyProduction.work_order,
      job_order: dailyProduction.job_order,
      shape_id: shape_id,
      object_id: object_id,
      rejected_quantity: rejected_quantity,
      recycled_quantity: 0,
      remarks: remarks,
      created_by: req.user._id,
    };

    const newQcCheck = new ironQCCheck(qcCheckData);
    await newQcCheck.save();

    return res.status(200).json(
      new ApiResponse(200, {
        production: updatedProduction,
        qcCheck: newQcCheck,
      }, 'QC check added and production record updated successfully.')
    );
  } catch (error) {
    console.error('Error adding QC check:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});

const addQcCheck_06_08_2025 = asyncHandler(async (req, res) => {
  try {
    const { job_order, shape_id, object_id, rejected_quantity, remarks } = req.body;

    if (!job_order || !shape_id || !object_id || rejected_quantity === undefined) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, object_id, rejected_quantity.')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    if (isNaN(rejected_quantity) || rejected_quantity < 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Rejected quantity must be a non-negative number.')
      );
    }

    const dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id,
    });

    if (!dailyProduction) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
      );
    }

    const productIndex = dailyProduction.products.findIndex((p) => p.object_id.equals(object_id));
    if (productIndex === -1) {
      return res.status(404).json(
        new ApiResponse(404, null, 'object_id not found in the products array.')
      );
    }

    const currentRejectedQuantity = dailyProduction.products[productIndex].rejected_quantity || 0;
    const newRejectedQuantity = currentRejectedQuantity + rejected_quantity;
    dailyProduction.products[productIndex].rejected_quantity = newRejectedQuantity;
    dailyProduction.products[productIndex].achieved_quantity -= rejected_quantity; // Deduct rejected quantity from achieved quantity
    dailyProduction.qc_checked_by = req.user._id;
    dailyProduction.production_logs.push({
      action: 'QCCheck',
      user: req.user._id,
      description: remarks || 'N/A',
      rejected_quantity: newRejectedQuantity,
    });

    dailyProduction.updated_by = req.user._id;
    const updatedProduction = await dailyProduction.save();

    const qcCheckData = {
      work_order: dailyProduction.work_order,
      job_order: dailyProduction.job_order,
      shape_id: shape_id,
      object_id: object_id,
      rejected_quantity: rejected_quantity,
      recycled_quantity: 0,
      remarks: remarks,
      created_by: req.user._id,
    };

    const newQcCheck = new ironQCCheck(qcCheckData);
    await newQcCheck.save();

    return res.status(200).json(
      new ApiResponse(200, {
        production: updatedProduction,
        qcCheck: newQcCheck,
      }, 'QC check added and production record updated successfully.')
    );
  } catch (error) {
    console.error('Error adding QC check:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});

const addQcCheck = asyncHandler(async (req, res) => {
  try {
    const { job_order, shape_id, object_id, rejected_quantity, remarks } = req.body;

    if (!job_order || !shape_id || !object_id || rejected_quantity === undefined) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Missing required fields: job_order, shape_id, object_id, rejected_quantity.')
      );
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json(
        new ApiResponse(401, null, 'Unauthorized: User not authenticated.')
      );
    }

    if (isNaN(rejected_quantity) || rejected_quantity < 0) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Rejected quantity must be a non-negative number.')
      );
    }

    const dailyProduction = await ironDailyProduction.findOne({
      job_order,
      'products.shape_id': shape_id,
      'products.object_id': object_id,
    });

    if (!dailyProduction) {
      return res.status(404).json(
        new ApiResponse(404, null, 'Daily production document not found for this job order and shape.')
      );
    }

    const productIndex = dailyProduction.products.findIndex((p) => p.object_id.equals(object_id));
    if (productIndex === -1) {
      return res.status(404).json(
        new ApiResponse(404, null, 'object_id not found in the products array.')
      );
    }

    const currentAchievedQuantity = dailyProduction.products[productIndex].achieved_quantity || 0;
    const currentRejectedQuantity = dailyProduction.products[productIndex].rejected_quantity || 0;
    const newRejectedQuantity = currentRejectedQuantity + rejected_quantity;

    // Validate that rejected_quantity does not exceed achieved_quantity
    if (newRejectedQuantity > currentAchievedQuantity) {
      return res.status(400).json(
        new ApiResponse(
          400,
          null,
          `Rejected quantity (${newRejectedQuantity}) cannot exceed achieved quantity (${currentAchievedQuantity}) for this product.`
        )
      );
    }

    // Update quantities
    dailyProduction.products[productIndex].rejected_quantity = newRejectedQuantity;
    dailyProduction.products[productIndex].achieved_quantity = currentAchievedQuantity - rejected_quantity;
    dailyProduction.qc_checked_by = req.user._id;
    dailyProduction.production_logs.push({
      action: 'QCCheck',
      user: req.user._id,
      description: remarks || 'N/A',
      rejected_quantity: newRejectedQuantity,
    });

    dailyProduction.updated_by = req.user._id;
    const updatedProduction = await dailyProduction.save();

    const qcCheckData = {
      work_order: dailyProduction.work_order,
      job_order: dailyProduction.job_order,
      shape_id: shape_id,
      object_id: object_id,
      rejected_quantity: rejected_quantity,
      recycled_quantity: 0,
      remarks: remarks,
      created_by: req.user._id,
    };

    const newQcCheck = new ironQCCheck(qcCheckData);
    await newQcCheck.save();

    return res.status(200).json(
      new ApiResponse(200, {
        production: updatedProduction,
        qcCheck: newQcCheck,
      }, 'QC check added and production record updated successfully.')
    );
  } catch (error) {
    console.error('Error adding QC check:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'Internal Server Error', error.message)
    );
  }
});

const addMachineToProduction = asyncHandler(async (req, res) => {
  try {
    const { productionId, machineId } = req.body;

    if (!productionId || !machineId) {
      return res
        .status(400)
        .json({ message: "productionId and machineId are required" });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(productionId) ||
      !mongoose.Types.ObjectId.isValid(machineId)
    ) {
      return res.status(400).json({ message: "Invalid ObjectId(s)" });
    }

    // Update the only product's machines array
    const production = await ironDailyProduction.findOneAndUpdate(
      { _id: productionId },
      { $addToSet: { "products.0.machines": machineId } }, // directly access first (only) product
      { new: true }
    ).populate("products.machines");

    if (!production) {
      return res
        .status(404)
        .json({ message: "Production not found" });
    }

    res.status(200).json({
      message: "Machine successfully added to production",
      production,
    });
  } catch (error) {
    console.error("Error adding machine:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});




export {getProductionData,manageIronProductionActions,updateIronProductionQuantities, addIronDowntime, getIronDowntime, getProductionLog, addQcCheck, addMachineToProduction};