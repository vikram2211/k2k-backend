import { JobOrder } from "../../models/konkreteKlinkers/jobOrders.model.js";
import { DailyProduction } from "../../models/konkreteKlinkers/dailyProductionPlanning.js";
import mongoose from "mongoose";
import { Inventory } from '../../models/konkreteKlinkers/inventory.model.js';
import { updateWorkOrderStatus } from './workOrder.js';
import { updateJobOrderStatus } from './jobOrderController.js';

import { parse, addMinutes } from 'date-fns';
import { ApiError } from '../../utils/ApiError.js';

//WORKING CODE -

// export const getJobOrdersByDate = async (req, res) => {
//     try {
//         // Normalize today's date (UTC at 00:00)
//         const today = new Date();
//         const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

//         // Fetch job orders with populated work_order and project_id
//         const jobOrders = await JobOrder.find()
//             .populate({
//                 path: 'work_order',
//                 select: 'project_id work_order_number',
//                 populate: {
//                     path: 'project_id',
//                     select: 'name'
//                 }
//             });

//         const categorizedOrders = {
//             pastDPR: [],
//             todayDPR: [],
//             futureDPR: []
//         };

//         jobOrders.forEach(order => {
//             const orderObj = order.toObject();
//             const transformedOrder = {
//                 ...orderObj,
//                 project_name: orderObj.work_order?.project_id?.name || 'N/A',
//                 work_order_number: orderObj.work_order?.work_order_number || 'N/A'
//             };

//             const scheduledDates = order.products.map(product =>
//                 new Date(Date.UTC(
//                     new Date(product.scheduled_date).getUTCFullYear(),
//                     new Date(product.scheduled_date).getUTCMonth(),
//                     new Date(product.scheduled_date).getUTCDate()
//                 ))
//             );

//             const earliestDate = new Date(Math.min(...scheduledDates));

//             // Compare dates only (normalized to 00:00 UTC)
//             if (earliestDate.getTime() === todayUTC.getTime()) {
//                 categorizedOrders.todayDPR.push(transformedOrder);
//             } else if (earliestDate < todayUTC) {
//                 categorizedOrders.pastDPR.push(transformedOrder);
//             } else {
//                 categorizedOrders.futureDPR.push(transformedOrder);
//             }
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Job Order data fetched successfully",
//             data: categorizedOrders
//         });
//     } catch (error) {
//         console.error("Error getting JobOrder:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//             error: error.message
//         });
//     }
// };


// const mongoose = require('mongoose');

///////////////////////////////////////////////======================================/////////////////////////////////////////////////



export const getJobOrdersByDate1 = async (req, res) => {
  try {
    // Normalize today's date (UTC at 00:00)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // Query parameters
    const { date, startDate, endDate } = req.query;
    const query = {};

    // Validate and process single date filter
    if (date) {
      const inputDate = new Date(date);
      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
        });
      }
      // Normalize input date to UTC midnight
      const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
      // Match products.scheduled_date with the same date (ignoring time)
      query['products.scheduled_date'] = {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000), // Next day
      };
    } else if (startDate && endDate) {
      // Existing range filter
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid startDate or endDate format. Use YYYY-MM-DD',
        });
      }
      end.setUTCHours(23, 59, 59, 999); // Include entire end date
      query['products.scheduled_date'] = {
        $gte: start,
        $lte: end,
      };
    }

    // Fetch job orders with populated work_order and project_id
    const jobOrders = await JobOrder.find(query)
      .populate({
        path: 'work_order',
        select: 'project_id work_order_number',
        populate: {
          path: 'project_id',
          select: 'name',
        },
      })
      .lean();

    // Fetch all DailyProduction documents for the job orders
    const jobOrderIds = jobOrders.map((jo) => jo._id);
    const dailyProductions = await DailyProduction.find({
      job_order: { $in: jobOrderIds },
    }).lean();

    // Categorize job orders
    const categorizedOrders = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };

    jobOrders.forEach((jobOrder) => {
      // Create a separate entry for each product
      jobOrder.products.forEach((product) => {
        // Only include products matching the date filter (if provided)
        if (date) {
          const scheduledDate = new Date(Date.UTC(
            new Date(product.scheduled_date).getUTCFullYear(),
            new Date(product.scheduled_date).getUTCMonth(),
            new Date(product.scheduled_date).getUTCDate()
          ));
          const inputDate = new Date(Date.UTC(
            new Date(date).getUTCFullYear(),
            new Date(date).getUTCMonth(),
            new Date(date).getUTCDate()
          ));
          if (scheduledDate.getTime() !== inputDate.getTime()) {
            return; // Skip products not matching the exact date
          }
        }

        // Find the corresponding DailyProduction document for this product
        const dailyProduction = dailyProductions.find(
          (dp) =>
            dp.job_order.toString() === jobOrder._id.toString() &&
            dp.products.some((dpProd) => dpProd.product_id.toString() === product.product.toString())
        );

        // Get the matching product from DailyProduction
        const dpProduct = dailyProduction?.products.find(
          (dpProd) => dpProd.product_id.toString() === product.product.toString()
        );

        // Transform job order for response
        const transformedOrder = {
          _id: jobOrder._id,
          work_order: {
            _id: jobOrder.work_order?._id,
            work_order_number: jobOrder.work_order?.work_order_number || 'N/A',
            project_name: jobOrder.work_order?.project_id?.name || 'N/A',
          },
          sales_order_number: jobOrder.sales_order_number,
          batch_number: jobOrder.batch_number,
          date: jobOrder.date,
          status: jobOrder.status,
          created_by: jobOrder.created_by,
          updated_by: jobOrder.updated_by,
          createdAt: jobOrder.createdAt,
          updatedAt: jobOrder.updatedAt,
          product: {
            job_order: jobOrder._id,
            product_id: product.product,
            machine_name: product.machine_name,
            planned_quantity: product.planned_quantity,
            scheduled_date: product.scheduled_date,
            achieved_quantity: dpProduct?.achieved_quantity || 0,
            rejected_quantity: dpProduct?.rejected_quantity || 0,
            recycled_quantity: dpProduct?.recycled_quantity || 0,
            started_at: dpProduct?.started_at || null,
            stopped_at: dpProduct?.stopped_at || null,
            submitted_by: dpProduct?.submitted_by || null,
            daily_production: dailyProduction
              ? {
                _id: dailyProduction._id,
                status: dailyProduction.status,
                date: dailyProduction.date,
                qc_checked_by: dailyProduction.qc_checked_by,
                downtime: dailyProduction.downtime,
                created_by: dailyProduction.created_by,
                updated_by: dailyProduction.updated_by,
                createdAt: dailyProduction.createdAt,
                updatedAt: dailyProduction.updatedAt,
              }
              : null,
          },
        };

        // Categorize based on scheduled_date
        const scheduledDate = new Date(Date.UTC(
          new Date(product.scheduled_date).getUTCFullYear(),
          new Date(product.scheduled_date).getUTCMonth(),
          new Date(product.scheduled_date).getUTCDate()
        ));

        // Categorize job order
        if (scheduledDate.getTime() === todayUTC.getTime()) {
          categorizedOrders.todayDPR.push(transformedOrder);
        } else if (scheduledDate < todayUTC) {
          categorizedOrders.pastDPR.push(transformedOrder);
        } else {
          categorizedOrders.futureDPR.push(transformedOrder);
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully',
      data: categorizedOrders,
    });
  } catch (error) {
    console.error('Error getting production data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};



export const getJobOrdersByDate2 = async (req, res) => {
  try {
    // Normalize today's date (UTC at 00:00)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // Query parameters
    const { date, startDate, endDate, status } = req.query;
    const query = {};

    // Validate and process single date filter
    if (date) {
      const inputDate = new Date(date);
      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
        });
      }
      // Normalize input date to UTC midnight
      const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
      // Match products.scheduled_date with the same date (ignoring time)
      query['products.scheduled_date'] = {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000), // Next day
      };
    } else if (startDate && endDate) {
      // Existing range filter
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid startDate or endDate format. Use YYYY-MM-DD',
        });
      }
      end.setUTCHours(23, 59, 59, 999); // Include entire end date
      query['products.scheduled_date'] = {
        $gte: start,
        $lte: end,
      };
    }


    query.status = "Pending";

    // Fetch job orders with populated work_order and project_id
    const jobOrders = await JobOrder.find(query)
      .populate({
        path: 'work_order',
        select: 'project_id work_order_number',
        populate: {
          path: 'project_id',
          select: 'name',
        },
      })
      .lean();

    // Fetch all DailyProduction documents for the job orders
    const jobOrderIds = jobOrders.map((jo) => jo._id);
    const dailyProductions = await DailyProduction.find({
      job_order: { $in: jobOrderIds },
    }).lean();

    // Categorize job orders
    const categorizedOrders = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };

    jobOrders.forEach((jobOrder) => {
      // Create a separate entry for each product
      jobOrder.products.forEach((product) => {
        // Only include products matching the date filter (if provided)
        if (date) {
          const scheduledDate = new Date(Date.UTC(
            new Date(product.scheduled_date).getUTCFullYear(),
            new Date(product.scheduled_date).getUTCMonth(),
            new Date(product.scheduled_date).getUTCDate()
          ));
          const inputDate = new Date(Date.UTC(
            new Date(date).getUTCFullYear(),
            new Date(date).getUTCMonth(),
            new Date(date).getUTCDate()
          ));
          if (scheduledDate.getTime() !== inputDate.getTime()) {
            return; // Skip products not matching the exact date
          }
        }

        // Find the corresponding DailyProduction document for this product
        const dailyProduction = dailyProductions.find(
          (dp) =>
            dp.job_order.toString() === jobOrder._id.toString() &&
            dp.products.some((dpProd) => dpProd.product_id.toString() === product.product.toString())
        );

        // Get the matching product from DailyProduction
        const dpProduct = dailyProduction?.products.find(
          (dpProd) => dpProd.product_id.toString() === product.product.toString()
        );

        // Transform job order for response
        const transformedOrder = {
          _id: jobOrder._id,
          work_order: {
            _id: jobOrder.work_order?._id,
            work_order_number: jobOrder.work_order?.work_order_number || 'N/A',
            project_name: jobOrder.work_order?.project_id?.name || 'N/A',
          },
          sales_order_number: jobOrder.sales_order_number,
          batch_number: jobOrder.batch_number,
          date: jobOrder.date,
          status: jobOrder.status,
          created_by: jobOrder.created_by,
          updated_by: jobOrder.updated_by,
          createdAt: jobOrder.createdAt,
          updatedAt: jobOrder.updatedAt,
          product: {
            job_order: jobOrder._id,
            product_id: product.product,
            machine_name: product.machine_name,
            planned_quantity: product.planned_quantity,
            scheduled_date: product.scheduled_date,
            achieved_quantity: dpProduct?.achieved_quantity || 0,
            rejected_quantity: dpProduct?.rejected_quantity || 0,
            recycled_quantity: dpProduct?.recycled_quantity || 0,
            started_at: dpProduct?.started_at || null,
            stopped_at: dpProduct?.stopped_at || null,
            submitted_by: dpProduct?.submitted_by || null,
            daily_production: dailyProduction
              ? {
                _id: dailyProduction._id,
                status: dailyProduction.status,
                date: dailyProduction.date,
                qc_checked_by: dailyProduction.qc_checked_by,
                downtime: dailyProduction.downtime,
                created_by: dailyProduction.created_by,
                updated_by: dailyProduction.updated_by,
                createdAt: dailyProduction.createdAt,
                updatedAt: dailyProduction.updatedAt,
              }
              : null,
          },
        };

        // Categorize based on scheduled_date
        const scheduledDate = new Date(Date.UTC(
          new Date(product.scheduled_date).getUTCFullYear(),
          new Date(product.scheduled_date).getUTCMonth(),
          new Date(product.scheduled_date).getUTCDate()
        ));

        // Categorize job order
        if (scheduledDate.getTime() === todayUTC.getTime()) {
          categorizedOrders.todayDPR.push(transformedOrder);
        } else if (scheduledDate < todayUTC) {
          categorizedOrders.pastDPR.push(transformedOrder);
        } else {
          categorizedOrders.futureDPR.push(transformedOrder);
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully',
      data: categorizedOrders,
    });
  } catch (error) {
    console.error('Error getting production data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////


//////Working fine, but using final getJobOrdersByDate api in bottom, so commenting this one -****&&&^^^%%%$$#######








export const getJobOrdersByDate_13_08_2025 = async (req, res) => {
  try {
    console.log("came here in by dateeeee");
    // Normalize today's date (UTC at 00:00)
    const today = new Date();
    // console.log("today", today);
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // Tomorrow's date for future DPR categorization
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

    // Query parameters
    const { date } = req.query;
    // console.log("date", date);
    let query = {};
    // console.log("query", query);

    // If a specific date is provided, filter by that date
    if (date) {
      // console.log("date provided");
      const inputDate = new Date(date);
      console.log("inputDate", inputDate);

      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
        });
      }
      // Normalize input date to UTC midnight
      const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
      console.log("normalizedDate", normalizedDate);
      // Match DailyProduction date with the same date (ignoring time)
      query.date = {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000), // Next day
      };
      console.log("inside query", query);
    }
    // console.log("date not provided");
    console.log("outside query", query);


    // Fetch daily productions with populated fields
    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              {
                path: 'project_id',
                select: 'name',
              },
              {
                path: 'client_id',
                select: 'name',
              },
            ],
          },
          {
            path: 'products.machine_name',
            select: 'name',
          },
        ],
      })
      .populate({
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: {
          path: 'plant',
          select: 'plant_name',
        },
      })
      .lean();
    console.log("dailyProductions", dailyProductions);

    // Group by JobOrder to avoid duplicates
    const jobOrderMap = new Map();

    dailyProductions.forEach((dailyProduction) => {
      const jobOrder = dailyProduction.job_order;
      const jobOrderId = jobOrder?._id?.toString() || dailyProduction._id.toString();

      // Skip if this JobOrder has already been processed
      if (jobOrderMap.has(jobOrderId)) {
        return;
      }

      // Select the first product for this JobOrder
      const dpProduct = dailyProduction.products[0]; // Pick the first product
      if (!dpProduct) {
        return; // Skip if no products exist
      }

      const productId = dpProduct.product_id._id.toString();

      // Find the corresponding product in the job order's products array
      const jobOrderProduct = jobOrder?.products?.find(
        (prod) => prod.product.toString() === productId
      );

      // Find the corresponding product in the work order's products array to get po_quantity
      const workOrderProduct = jobOrder?.work_order?.products?.find(
        (prod) => prod.product_id.toString() === productId
      );
      let started_at = null;
      let stopped_at = null;

      if (dailyProduction.production_logs && dailyProduction.production_logs.length > 0) {
        const startLog = dailyProduction.production_logs
          .filter((log) => log.action === 'Start')
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Start
        const stopLog = dailyProduction.production_logs
          .filter((log) => log.action === 'Stop')
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Stop

        started_at = startLog ? startLog.timestamp : null;
        stopped_at = stopLog ? stopLog.timestamp : null;
      }

      // Create the entry for this JobOrder with the first product
      const entry = {
        _id: jobOrder?._id || dailyProduction._id,
        work_order: {
          _id: jobOrder?.work_order?._id || null,
          work_order_number: jobOrder?.work_order?.work_order_number || 'N/A',
          project_name: jobOrder?.work_order?.project_id?.name || 'N/A',
          client_name: jobOrder?.work_order?.client_id?.name || 'N/A',
        },
        sales_order_number: jobOrder?.sales_order_number || 'N/A',
        batch_number: jobOrder?.batch_number || 'N/A',
        date: jobOrder?.date || { from: null, to: null },
        status: jobOrder?.status || dailyProduction.status,
        created_by: jobOrder?.created_by || dailyProduction.created_by,
        updated_by: jobOrder?.updated_by || dailyProduction.updated_by,
        createdAt: jobOrder?.createdAt || dailyProduction.createdAt,
        updatedAt: jobOrder?.updatedAt || dailyProduction.updatedAt,
        job_order: jobOrder?._id || dailyProduction._id,
        job_order_id: jobOrder?.job_order_id,
        product_id: dpProduct.product_id._id,
        plant_name: dpProduct.product_id?.plant?.plant_name || 'N/A',
        machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
        material_code: dpProduct.product_id?.material_code || 'N/A',
        description: dpProduct.product_id?.description || 'N/A',
        po_quantity: workOrderProduct?.po_quantity || 0,
        planned_quantity: jobOrderProduct?.planned_quantity || 0,
        scheduled_date: jobOrderProduct?.scheduled_date || dailyProduction.date,
        achieved_quantity: dpProduct.achieved_quantity || 0,
        rejected_quantity: dpProduct.rejected_quantity || 0,
        recycled_quantity: dpProduct.recycled_quantity || 0,
        started_at,
        stopped_at,
        submitted_by: dpProduct.submitted_by || null,
        daily_production: {
          _id: dailyProduction._id,
          status: dailyProduction.status,
          date: dailyProduction.date,
          qc_checked_by: dailyProduction.qc_checked_by,
          downtime: dailyProduction.downtime,
          created_by: dailyProduction.created_by,
          updated_by: dailyProduction.updated_by,
          createdAt: dailyProduction.createdAt,
          updatedAt: dailyProduction.updatedAt,
        },
        latestDate: dailyProduction.date, // Track the DailyProduction date for categorization
      };

      jobOrderMap.set(jobOrderId, entry);
    });

    // Categorize the consolidated entries
    const categorizedOrders = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };

    jobOrderMap.forEach((entry) => {
      // Categorize based on the DailyProduction date
      const dpDate = new Date(Date.UTC(
        new Date(entry.latestDate).getUTCFullYear(),
        new Date(entry.latestDate).getUTCMonth(),
        new Date(entry.latestDate).getUTCDate()
      ));

      if (date) {
        categorizedOrders.todayDPR.push(entry);
        // console.log("today DPR",categorizedOrders.todayDPR);
      } else {
        if (dpDate.getTime() === todayUTC.getTime()) {
          categorizedOrders.todayDPR.push(entry);
          // console.log("today DPR*",categorizedOrders.todayDPR);
        } else if (dpDate < todayUTC) {
          categorizedOrders.pastDPR.push(entry);
        } else if (dpDate >= tomorrowUTC) {
          categorizedOrders.futureDPR.push(entry);
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully',
      data: categorizedOrders,
    });
  } catch (error) {
    console.error('Error getting production data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};




export const getJobOrdersByDate_19_08_2025 = async (req, res) => {
  try {
    // Normalize today's date (UTC at 00:00)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // Tomorrow's date for future DPR categorization
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

    // Query parameters
    const { date } = req.query;
    let query = {};

    // If a specific date is provided, filter by that date
    if (date) {
      const inputDate = new Date(date);
      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
        });
      }
      // Normalize input date to UTC midnight
      const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
      query.date = {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000), // Next day
      };
    }

    // Fetch daily productions with populated fields
    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              {
                path: 'project_id',
                select: 'name',
              },
              {
                path: 'client_id',
                select: 'name',
              },
            ],
          },
          {
            path: 'products.machine_name',
            select: 'name',
          },
        ],
      })
      .populate({
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: {
          path: 'plant',
          select: 'plant_name',
        },
      })
      .lean();
    // console.log("dailyProductions",dailyProductions);
    dailyProductions.map((dailyPr) => console.log("dailyPr", dailyPr))

    // Group by JobOrder and Product to include all products
    const jobOrderProductMap = new Map();

    dailyProductions.forEach((dailyProduction) => {
      const jobOrder = dailyProduction.job_order;
      const jobOrderId = jobOrder?._id?.toString() || dailyProduction._id.toString();

      // Process each product in the DailyProduction
      dailyProduction.products.forEach((dpProduct) => {
        const productId = dpProduct.product_id._id.toString();
        // Create a unique key for JobOrder and Product combination
        const uniqueKey = `${jobOrderId}-${productId}`;

        // Skip if this JobOrder-Product combination has already been processed
        if (jobOrderProductMap.has(uniqueKey)) {
          return;
        }

        // Find the corresponding product in the job order's products array
        const jobOrderProduct = jobOrder?.products?.find(
          (prod) => prod.product.toString() === productId
        );

        // Find the corresponding product in the work order's products array to get po_quantity
        const workOrderProduct = jobOrder?.work_order?.products?.find(
          (prod) => prod.product_id.toString() === productId
        );
        console.log("workOrderProduct", workOrderProduct);

        // Get latest start and stop times from production logs
        let started_at = null;
        let stopped_at = null;
        if (dailyProduction.production_logs && dailyProduction.production_logs.length > 0) {
          const startLog = dailyProduction.production_logs
            .filter((log) => log.action === 'Start')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Start
          const stopLog = dailyProduction.production_logs
            .filter((log) => log.action === 'Stop')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Stop

          started_at = startLog ? startLog.timestamp : null;
          stopped_at = stopLog ? stopLog.timestamp : null;
        }

        // Create the entry for this JobOrder-Product combination
        const entry = {
          _id: jobOrder?._id || dailyProduction._id,
          work_order: {
            _id: jobOrder?.work_order?._id || null,
            work_order_number: jobOrder?.work_order?.work_order_number || 'N/A',
            project_name: jobOrder?.work_order?.project_id?.name || 'N/A',
            client_name: jobOrder?.work_order?.client_id?.name || 'N/A',
          },
          sales_order_number: jobOrder?.sales_order_number || 'N/A',
          batch_number: jobOrder?.batch_number || 'N/A',
          date: jobOrder?.date || { from: null, to: null },
          status: jobOrder?.status || dailyProduction.status,
          created_by: jobOrder?.created_by || dailyProduction.created_by,
          updated_by: jobOrder?.updated_by || dailyProduction.updated_by,
          createdAt: jobOrder?.createdAt || dailyProduction.createdAt,
          updatedAt: jobOrder?.updatedAt || dailyProduction.updatedAt,
          job_order: jobOrder?._id || dailyProduction._id,
          job_order_id: jobOrder?.job_order_id,
          product_id: dpProduct.product_id._id,
          plant_name: dpProduct.product_id?.plant?.plant_name || 'N/A',
          machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
          material_code: dpProduct.product_id?.material_code || 'N/A',
          description: dpProduct.product_id?.description || 'N/A',
          po_quantity: workOrderProduct?.po_quantity || 0,
          qty_in_nos: workOrderProduct?.qty_in_nos || 0,
          planned_quantity: jobOrderProduct?.planned_quantity || 0,
          scheduled_date: jobOrderProduct?.scheduled_date || dailyProduction.date,
          achieved_quantity: dpProduct.achieved_quantity || 0,
          rejected_quantity: dpProduct.rejected_quantity || 0,
          recycled_quantity: dpProduct.recycled_quantity || 0,
          started_at,
          stopped_at,
          submitted_by: dpProduct.submitted_by || null,
          daily_production: {
            _id: dailyProduction._id,
            status: dailyProduction.status,
            date: dailyProduction.date,
            qc_checked_by: dailyProduction.qc_checked_by,
            downtime: dailyProduction.downtime,
            created_by: dailyProduction.created_by,
            updated_by: dailyProduction.updated_by,
            createdAt: dailyProduction.createdAt,
            updatedAt: dailyProduction.updatedAt,
          },
          latestDate: dailyProduction.date, // Track the DailyProduction date for categorization
        };

        jobOrderProductMap.set(uniqueKey, entry);
      });
    });

    // Categorize the consolidated entries
    const categorizedOrders = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };

    jobOrderProductMap.forEach((entry) => {
      // Categorize based on the DailyProduction date
      const dpDate = new Date(Date.UTC(
        new Date(entry.latestDate).getUTCFullYear(),
        new Date(entry.latestDate).getUTCMonth(),
        new Date(entry.latestDate).getUTCDate()
      ));

      if (date) {
        categorizedOrders.todayDPR.push(entry);
      } else {
        if (dpDate.getTime() === todayUTC.getTime()) {
          categorizedOrders.todayDPR.push(entry);
        } else if (dpDate < todayUTC) {
          categorizedOrders.pastDPR.push(entry);
        } else if (dpDate >= tomorrowUTC) {
          categorizedOrders.futureDPR.push(entry);
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully',
      data: categorizedOrders,
    });
  } catch (error) {
    console.error('Error getting production data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
export const getJobOrdersByDate_21_08_2025 = async (req, res) => {
  try {
    // Normalize today's date (UTC at 00:00)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // Tomorrow's date for future DPR categorization
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

    // Query parameters
    const { date } = req.query;
    let query = {};

    // If a specific date is provided, filter by that date
    if (date) {
      const inputDate = new Date(date);
      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
        });
      }
      // Normalize input date to UTC midnight
      const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
      query.date = {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000), // Next day
      };
    }

    // Fetch daily productions with populated fields
    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              {
                path: 'project_id',
                select: 'name',
              },
              {
                path: 'client_id',
                select: 'name',
              },
            ],
          },
          {
            path: 'products.machine_name',
            select: 'name',
          },
        ],
      })
      .populate({
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: {
          path: 'plant',
          select: 'plant_name',
        },
      })
      .lean();

    // Group by DailyProduction to include all records
    const jobOrderProductMap = new Map();

    dailyProductions.forEach((dailyProduction) => {
      const jobOrder = dailyProduction.job_order;
      console.log("jobOrder", jobOrder);
      const jobOrderId = jobOrder?._id?.toString() || dailyProduction._id.toString();

      // Process each product in the DailyProduction
      dailyProduction.products.forEach((dpProduct) => {
        const productId = dpProduct.product_id._id.toString();
        // Create a unique key including DailyProduction _id for uniqueness
        const uniqueKey = `${jobOrderId}-${productId}-${dailyProduction._id.toString()}`;

        // Find the corresponding product in the job order's products array
        const jobOrderProduct = jobOrder?.products?.find(
          (prod) => prod.product.toString() === productId
        );



        // const jobOrderProduct = jobOrder?.products?.find(
        //   (prod) =>
        //     prod.product.toString() === productId &&
        //     new Date(prod.scheduled_date).getTime() === new Date(dailyProduction.date).getTime()
        // );
        console.log("jobOrderProduct", jobOrderProduct);

        // Find the corresponding product in the work order's products array to get po_quantity
        const workOrderProduct = jobOrder?.work_order?.products?.find(
          (prod) => prod.product_id.toString() === productId
        );

        // Get latest start and stop times from production logs
        let started_at = null;
        let stopped_at = null;
        if (dailyProduction.production_logs && dailyProduction.production_logs.length > 0) {
          const startLog = dailyProduction.production_logs
            .filter((log) => log.action === 'Start')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Start
          const stopLog = dailyProduction.production_logs
            .filter((log) => log.action === 'Stop')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Stop

          started_at = startLog ? startLog.timestamp : null;
          stopped_at = stopLog ? stopLog.timestamp : null;
        }

        // Create the entry for this DailyProduction-Product combination
        const entry = {
          _id: jobOrder?._id || dailyProduction._id,
          work_order: {
            _id: jobOrder?.work_order?._id || null,
            work_order_number: jobOrder?.work_order?.work_order_number || 'N/A',
            project_name: jobOrder?.work_order?.project_id?.name || 'N/A',
            client_name: jobOrder?.work_order?.client_id?.name || 'N/A',
          },
          sales_order_number: jobOrder?.sales_order_number || 'N/A',
          batch_number: jobOrder?.batch_number || 'N/A',
          date: jobOrder?.date || { from: null, to: null },
          status: jobOrder?.status || dailyProduction.status,
          created_by: jobOrder?.created_by || dailyProduction.created_by,
          updated_by: jobOrder?.updated_by || dailyProduction.updated_by,
          createdAt: jobOrder?.createdAt || dailyProduction.createdAt,
          updatedAt: jobOrder?.updatedAt || dailyProduction.updatedAt,
          job_order: jobOrder?._id || dailyProduction._id,
          job_order_id: jobOrder?.job_order_id,
          product_id: dpProduct.product_id._id,
          plant_name: dpProduct.product_id?.plant?.plant_name || 'N/A',
          machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
          material_code: dpProduct.product_id?.material_code || 'N/A',
          description: dpProduct.product_id?.description || 'N/A',
          po_quantity: workOrderProduct?.po_quantity || 0,
          qty_in_nos: workOrderProduct?.qty_in_nos || 0,
          planned_quantity: jobOrderProduct?.planned_quantity || 0,
          scheduled_date: jobOrderProduct?.scheduled_date || dailyProduction.date,
          achieved_quantity: dpProduct.achieved_quantity || 0,
          rejected_quantity: dpProduct.rejected_quantity || 0,
          recycled_quantity: dpProduct.recycled_quantity || 0,
          prodId: dailyProduction._id,
          started_at,
          stopped_at,
          submitted_by: dpProduct.submitted_by || null,
          daily_production: {
            _id: dailyProduction._id, // Production ID for uniqueness
            status: dailyProduction.status,
            date: dailyProduction.date,
            qc_checked_by: dailyProduction.qc_checked_by,
            downtime: dailyProduction.downtime,
            created_by: dailyProduction.created_by,
            updated_by: dailyProduction.updated_by,
            createdAt: dailyProduction.createdAt,
            updatedAt: dailyProduction.updatedAt,
          },
          latestDate: dailyProduction.date,
        };

        jobOrderProductMap.set(uniqueKey, entry);
      });
    });

    // Categorize the consolidated entries
    const categorizedOrders = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };

    jobOrderProductMap.forEach((entry) => {
      // Categorize based on the DailyProduction date
      const dpDate = new Date(Date.UTC(
        new Date(entry.latestDate).getUTCFullYear(),
        new Date(entry.latestDate).getUTCMonth(),
        new Date(entry.latestDate).getUTCDate()
      ));

      if (date) {
        categorizedOrders.todayDPR.push(entry);
      } else {
        if (dpDate.getTime() === todayUTC.getTime()) {
          categorizedOrders.todayDPR.push(entry);
        } else if (dpDate < todayUTC) {
          categorizedOrders.pastDPR.push(entry);
        } else if (dpDate >= tomorrowUTC) {
          categorizedOrders.futureDPR.push(entry);
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully',
      data: categorizedOrders,
    });
  } catch (error) {
    console.error('Error getting production data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};


export const getJobOrdersByDate = async (req, res) => {
  try {
    // Normalize today's date (UTC at 00:00)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    // Tomorrow's date for future DPR categorization
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

    // Query parameters
    const { date } = req.query;
    let query = {};

    // If a specific date is provided, filter by that date
    if (date) {
      const inputDate = new Date(date);
      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
        });
      }
      // Normalize input date to UTC midnight
      const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
      query.date = {
        $gte: normalizedDate,
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000), // Next day
      };
    }

    // Fetch daily productions with populated fields
    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              {
                path: 'project_id',
                select: 'name',
              },
              {
                path: 'client_id',
                select: 'name',
              },
            ],
          },
          {
            path: 'products.machine_name',
            select: 'name',
          },
        ],
      })
      .populate({
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: {
          path: 'plant',
          select: 'plant_name',
        },
      })
      .lean();

    // Group by DailyProduction to include all records
    const jobOrderProductMap = new Map();

    // Track which job order product rows have been used (to handle duplicates correctly)
    const usedJobOrderProducts = new Map(); // key: jobOrderId-productId-scheduledDate, value: array of used indices

    dailyProductions.forEach((dailyProduction) => {
      const jobOrder = dailyProduction.job_order;
      const jobOrderId = jobOrder?._id?.toString() || dailyProduction._id.toString();

      // Process each product in the DailyProduction
      dailyProduction.products.forEach((dpProduct) => {
        const productId = dpProduct.product_id._id.toString();
        const scheduledDate = dailyProduction.date;

        // Find all jobOrderProducts for this product and scheduled date
        const matchingJobOrderProducts = jobOrder?.products?.filter(
          (prod) =>
            prod.product.toString() === productId &&
            new Date(prod.scheduled_date).getTime() === new Date(scheduledDate).getTime()
        );

        // Determine which matching product to use based on DailyProduction creation order
        const matchKey = `${jobOrderId}-${productId}-${new Date(scheduledDate).getTime()}`;
        if (!usedJobOrderProducts.has(matchKey)) {
          usedJobOrderProducts.set(matchKey, []);
        }
        const usedIndices = usedJobOrderProducts.get(matchKey);
        
        // Find the next unused job order product
        let jobOrderProductIndex = 0;
        for (let i = 0; i < matchingJobOrderProducts.length; i++) {
          if (!usedIndices.includes(i)) {
            jobOrderProductIndex = i;
            usedIndices.push(i);
            break;
          }
        }

        const matchedJobOrderProduct = matchingJobOrderProducts?.[jobOrderProductIndex];

        // Find the corresponding product in the work order's products array to get po_quantity
        const workOrderProduct = jobOrder?.work_order?.products?.find(
          (prod) => prod.product_id.toString() === productId
        );

        // Get latest start and stop times from production logs
        let started_at = null;
        let stopped_at = null;
        if (dailyProduction.production_logs && dailyProduction.production_logs.length > 0) {
          const startLog = dailyProduction.production_logs
            .filter((log) => log.action === 'Start')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Start
          const stopLog = dailyProduction.production_logs
            .filter((log) => log.action === 'Stop')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Latest Stop
          started_at = startLog ? startLog.timestamp : null;
          stopped_at = stopLog ? stopLog.timestamp : null;
        }

        // Create the entry for this DailyProduction-Product combination
        const entry = {
          _id: jobOrder?._id || dailyProduction._id,
          work_order: {
            _id: jobOrder?.work_order?._id || null,
            work_order_number: jobOrder?.work_order?.work_order_number || 'N/A',
            project_name: jobOrder?.work_order?.project_id?.name || 'N/A',
            client_name: jobOrder?.work_order?.client_id?.name || 'N/A',
          },
          sales_order_number: jobOrder?.sales_order_number || 'N/A',
          batch_number: jobOrder?.batch_number || 'N/A',
          date: jobOrder?.date || { from: null, to: null },
          status: jobOrder?.status || dailyProduction.status,
          created_by: jobOrder?.created_by || dailyProduction.created_by,
          updated_by: jobOrder?.updated_by || dailyProduction.updated_by,
          createdAt: jobOrder?.createdAt || dailyProduction.createdAt,
          updatedAt: jobOrder?.updatedAt || dailyProduction.updatedAt,
          job_order: jobOrder?._id || dailyProduction._id,
          job_order_id: jobOrder?.job_order_id,
          product_id: dpProduct.product_id._id,
          plant_name: dpProduct.product_id?.plant?.plant_name || 'N/A',
          machine_name: matchedJobOrderProduct?.machine_name?.name || 'N/A',
          material_code: dpProduct.product_id?.material_code || 'N/A',
          description: dpProduct.product_id?.description || 'N/A',
          po_quantity: workOrderProduct?.po_quantity || 0,
          qty_in_nos: workOrderProduct?.qty_in_nos || 0,
          planned_quantity: matchedJobOrderProduct?.planned_quantity || 0,
          scheduled_date: matchedJobOrderProduct?.scheduled_date || dailyProduction.date,
          achieved_quantity: dpProduct.achieved_quantity || 0,
          rejected_quantity: dpProduct.rejected_quantity || 0,
          recycled_quantity: dpProduct.recycled_quantity || 0,
          prodId: dailyProduction._id,
          started_at,
          stopped_at,
          submitted_by: dpProduct.submitted_by || null,
          daily_production: {
            _id: dailyProduction._id, // Production ID for uniqueness
            status: dailyProduction.status,
            date: dailyProduction.date,
            qc_checked_by: dailyProduction.qc_checked_by,
            downtime: dailyProduction.downtime,
            created_by: dailyProduction.created_by,
            updated_by: dailyProduction.updated_by,
            createdAt: dailyProduction.createdAt,
            updatedAt: dailyProduction.updatedAt,
          },
          latestDate: dailyProduction.date,
        };

        // Use prodId to ensure uniqueness
        jobOrderProductMap.set(`${jobOrderId}-${productId}-${dailyProduction._id.toString()}`, entry);
      });
    });

    // Categorize the consolidated entries
    const categorizedOrders = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };

    jobOrderProductMap.forEach((entry) => {
      // Categorize based on the DailyProduction date
      const dpDate = new Date(Date.UTC(
        new Date(entry.latestDate).getUTCFullYear(),
        new Date(entry.latestDate).getUTCMonth(),
        new Date(entry.latestDate).getUTCDate()
      ));

      if (date) {
        categorizedOrders.todayDPR.push(entry);
      } else {
        if (dpDate.getTime() === todayUTC.getTime()) {
          categorizedOrders.todayDPR.push(entry);
        } else if (dpDate < todayUTC) {
          categorizedOrders.pastDPR.push(entry);
        } else if (dpDate >= tomorrowUTC) {
          categorizedOrders.futureDPR.push(entry);
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully',
      data: categorizedOrders,
    });
  } catch (error) {
    console.error('Error getting production data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};





export const getJobOrdersByDate_18_08_2025 = async (req, res) => {
  try {
    const { date } = req.query;
    const dailyProductions = await DailyProduction.find({ date }).populate('job_order');
    const reports = dailyProductions.map(dp => ({
      _id: dp._id,
      work_order: {
        _id: dp.job_order._id,
        work_order_number: dp.job_order.work_order_number,
        project_name: dp.job_order.project_name,
        client_name: dp.job_order.client_name,
      },
      sales_order_number: dp.job_order.sales_order_number,
      batch_number: dp.batch_number,
      date: {
        from: dp.job_order.date_from,
        to: dp.job_order.date_to,
      },
      status: dp.status,
      created_by: dp.created_by,
      updated_by: dp.updated_by,
      createdAt: dp.createdAt,
      updatedAt: dp.updatedAt,
      job_order: dp.job_order._id,
      job_order_id: dp.job_order.job_order_id,
      objId: dp.products[0]?.objId || dp.job_order.products[0]?._id, // Use objId
      plant_name: dp.plant_name,
      machine_name: dp.machine_name,
      material_code: dp.material_code,
      description: dp.description,
      po_quantity: dp.po_quantity,
      planned_quantity: dp.planned_quantity,
      scheduled_date: dp.scheduled_date,
      achieved_quantity: dp.products[0]?.achieved_quantity || 0,
      rejected_quantity: dp.products[0]?.rejected_quantity || 0,
      recycled_quantity: dp.products[0]?.recycled_quantity || 0,
      started_at: dp.started_at,
      stopped_at: dp.stopped_at,
      submitted_by: dp.submitted_by,
      daily_production: {
        _id: dp._id,
        status: dp.status,
        date: dp.date,
        downtime: dp.downtime,
        created_by: dp.created_by,
        updated_by: dp.updated_by,
        createdAt: dp.createdAt,
        updatedAt: dp.updatedAt,
      },
      latestDate: dp.date,
    }));
    return res.status(200).json({ success: true, todayDPR: reports });
  } catch (error) {
    console.error('Error fetching job orders:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};





//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// const activeProductions = new Map();
// // Simulate fake API with incremental count
// const simulateProductionCount = async (job_order, product_id) => {
//     try {
//       console.log("Came in simulated count api");
//         // Find the DailyProduction document
//         const dailyProduction = await DailyProduction.findOne({ job_order });
//         console.log("dailyProduction.....",dailyProduction);
//         if (!dailyProduction) {
//             console.error(`DailyProduction not found for job_order: ${job_order}`);
//             return;
//         }

//         // Increment achieved_quantity for the specific product
//         dailyProduction.products = dailyProduction.products.map(p =>
//             p.product_id.equals(product_id)
//                 ? { ...p.toObject(), achieved_quantity: p.achieved_quantity + 1 }
//                 : p
//         );

//         await dailyProduction.save();
//         console.log(`Updated achieved_quantity for job_order: ${job_order}, product_id: ${product_id}`);
//         const inventory = await Inventory.findOne({
//           work_order: dailyProduction.work_order,
//           product: product_id,
//         });

//         if (inventory) {
//           const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//           inventory.produced_quantity = product.achieved_quantity;
//           inventory.updated_by = dailyProduction.updated_by;
//           await inventory.save({  });
//         }
//     } catch (error) {
//         console.error(`Error updating achieved_quantity: ${error.message}`);
//     }
// };

// export const handleDailyProductionAction = async (req, res) => {
//   console.log("came in production stage");
//   try {
//     const { action, job_order, product_id } = req.body;

//     if (!['start', 'stop'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid action. Must be "start" or "stop".',
//       });
//     }

//     if (!req.user || !req.user._id) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized: User not authenticated.',
//       });
//     }

//     if (!job_order || !product_id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: job_order, product_id.',
//       });
//     }

//     const jobOrder = await JobOrder.findById(job_order).populate(
//       'work_order',
//       'work_order_number'
//     );
//     // console.log("jobOrder", jobOrder);

//     if (!jobOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Job order not found.',
//       });
//     }

//     const productExists = jobOrder.products.some((product) =>
//       product.product.equals(product_id)
//     );
//     if (!productExists) {
//       return res.status(400).json({
//         success: false,
//         message: 'Product ID not found in job order.',
//       });
//     }

//     if (action === 'start') {
//       console.log("came here start");
//       let dailyProduction = await DailyProduction.findOne({ job_order });

//       if (dailyProduction) {
//         if (dailyProduction.started_at) {
//           return res.status(400).json({
//             success: false,
//             message: 'Production already started for this job order.',
//           });
//         }

//         dailyProduction.started_at = new Date();
//         dailyProduction.submitted_by = req.user._id;
//         dailyProduction.updated_by = req.user._id;
//         dailyProduction.status = 'In Progress';

//         const updatedProduction = await dailyProduction.save();
//         console.log("updatedProduction", updatedProduction);

//         // Start production counters for all products
//         for (const product of dailyProduction.products) {
//           const productionKey = `${job_order}_${product.product_id}`;
//           if (!activeProductions.has(productionKey)) {
//             const intervalId = setInterval(
//               () => simulateProductionCount(job_order, product.product_id),
//               5000
//             );
//             activeProductions.set(productionKey, intervalId);
//           }
//         }

//         return res.status(200).json({
//           success: true,
//           message: 'Production started successfully for job order.',
//           data: updatedProduction,
//         });
//       } else {
//         console.log("came in else as it is first daily production");
//         const schemaProducts = jobOrder.products.map((product) => ({
//           product_id: product.product,
//           achieved_quantity: 0,
//           rejected_quantity: 0,
//           recycled_quantity: 0,
//         }));

//         const newProduction = new DailyProduction({
//           work_order: jobOrder.work_order._id,
//           job_order,
//           products: schemaProducts,
//           submitted_by: req.user._id,
//           started_at: new Date(),
//           created_by: req.user._id,
//           updated_by: req.user._id,
//           status: 'In Progress',
//         });

//         const savedProduction = await newProduction.save();
//         console.log("savedProduction", savedProduction);

//         // Start production counters for all products
//         for (const product of newProduction.products) {
//           const productionKey = `${job_order}_${product.product_id}`;
//           const intervalId = setInterval(
//             () => simulateProductionCount(job_order, product.product_id),
//             10000
//           );
//           activeProductions.set(productionKey, intervalId);
//         }

//         return res.status(201).json({
//           success: true,
//           message: 'Production started successfully.',
//           data: savedProduction,
//         });
//       }
//     } else if (action === 'stop') {
//       const dailyProduction = await DailyProduction.findOne({ job_order });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order.',
//         });
//       }

//       // Set stopped_at at the document level
//       dailyProduction.stopped_at = new Date();
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.status = 'Pending QC';

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       // Update Inventory for all products
//       for (const product of dailyProduction.products) {
//         const inventory = await Inventory.findOne({
//           work_order: dailyProduction.work_order,
//           product: product.product_id,
//         });
//         if (inventory) {
//           inventory.produced_quantity = product.achieved_quantity;
//           inventory.updated_by = req.user._id;
//           await inventory.save();
//         }
//       }

//       // Stop production counters for all products
//       for (const product of dailyProduction.products) {
//         const productionKey = `${job_order}_${product.product_id}`;
//         const intervalId = activeProductions.get(productionKey);
//         if (intervalId) {
//           clearInterval(intervalId);
//           activeProductions.delete(productionKey);
//         }
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production stopped successfully for job order.',
//         data: updatedProduction,
//       });
//     }
//   } catch (error) {
//     console.error('Error handling daily production action:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };


///////////////////////////////////////////////======================================/////////////////////////////////////////////////



/////NEW SIMULATED API - 
// const simulateProductionCount2 = async (job_order, product_id) => {
//   const session = await mongoose.startSession();
//   try {
//     session.startTransaction();
//     console.log("came in simulated api");


//     const dailyProduction = await DailyProduction.findOne({ job_order }).session(session);
//     if (!dailyProduction) {
//       console.error(`DailyProduction not found for job_order: ${job_order}`);
//       return;
//     }

//     dailyProduction.products = dailyProduction.products.map((p) =>
//       p.product_id.equals(product_id)
//         ? { ...p.toObject(), achieved_quantity: p.achieved_quantity + 1 }
//         : p
//     );

//     await dailyProduction.save({ session });
//     console.log("came in simulated api 222");

//     // Update Inventory
//     const inventory = await Inventory.findOne({
//       work_order: dailyProduction.work_order,
//       product: product_id,
//     }).session(session);
//     if (inventory) {
//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       inventory.produced_quantity = product.achieved_quantity;
//       inventory.updated_by = dailyProduction.updated_by;
//       await inventory.save({ session });
//     }

//     await session.commitTransaction();
//     console.log(`Updated achieved_quantity and inventory for job_order: ${job_order}, product_id: ${product_id}`);
//   } catch (error) {
//     await session.abortTransaction();
//     console.error(`Error updating achieved_quantity: ${error.message}`);
//   } finally {
//     session.endSession();
//   }
// };






// export const handleDailyProductionAction = async (req, res) => {
//     try {
//         const { action, job_order, product_id } = req.body;

//         // Validate action
//         if (!['start', 'stop'].includes(action)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid action. Must be "start" or "stop".'
//             });
//         }

//         // Ensure req.user._id exists (from auth middleware)
//         if (!req.user || !req.user._id) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Unauthorized: User not authenticated.'
//             });
//         }

//         // Validate required fields
//         if (!job_order || !product_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing required fields: job_order, product_id.'
//             });
//         }

//         // Validate job_order exists
//         const jobOrder = await JobOrder.findById(job_order).populate('work_order', 'work_order_number');
//         if (!jobOrder) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Job order not found.'
//             });
//         }

//         // Validate product_id exists in job_order.products
//         const productExists = jobOrder.products.some(product => product.product.equals(product_id));
//         if (!productExists) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Product ID not found in job order.'
//             });
//         }

//         if (action === 'start') {
//             // Find existing DailyProduction for the job_order
//             let dailyProduction = await DailyProduction.findOne({ job_order });

//             if (dailyProduction) {
//                 // Check if the product already has started_at set
//                 const product = dailyProduction.products.find(p => p.product_id.equals(product_id));
//                 if (product && product.started_at) {
//                     return res.status(400).json({
//                         success: false,
//                         message: 'Production already started for this product.'
//                     });
//                 }

//                 // Update the specific product in the products array
//                 dailyProduction.products = dailyProduction.products.map(p =>
//                     p.product_id.equals(product_id)
//                         ? { ...p.toObject(), submitted_by: req.user._id, started_at: new Date() }
//                         : p
//                 );
//                 dailyProduction.updated_by = req.user._id;
//                 dailyProduction.status = 'In Progress';

//                 const updatedProduction = await dailyProduction.save();






//                 return res.status(200).json({
//                     success: true,
//                     message: 'Production started successfully for product.',
//                     data: updatedProduction
//                 });
//             } else {
//                 // Create new DailyProduction document
//                 const schemaProducts = jobOrder.products.map(product => ({
//                     product_id: product.product,
//                     achieved_quantity: 0,
//                     rejected_quantity: 0,
//                     recycled_quantity: 0,
//                     submitted_by: product.product.equals(product_id) ? req.user._id : undefined,
//                     started_at: product.product.equals(product_id) ? new Date() : undefined
//                 }));

//                 const newProduction = new DailyProduction({
//                     work_order: jobOrder.work_order._id,
//                     job_order,
//                     products: schemaProducts,
//                     created_by: req.user._id,
//                     updated_by: req.user._id,
//                     status: 'In Progress'
//                 });

//                 const savedProduction = await newProduction.save();
//                 return res.status(201).json({
//                     success: true,
//                     message: 'Production started successfully.',
//                     data: savedProduction
//                 });
//             }
//         } else if (action === 'stop') {
//             // Find existing DailyProduction for the job_order
//             const dailyProduction = await DailyProduction.findOne({ job_order });
//             if (!dailyProduction) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Daily production document not found for this job order.'
//                 });
//             }

//             // Check if the product exists and has started_at
//             const product = dailyProduction.products.find(p => p.product_id.equals(product_id));
//             if (!product) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Product ID not found in daily production.'
//                 });
//             }
//             if (!product.started_at) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Production has not started for this product.'
//                 });
//             }
//             if (product.stopped_at) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Production already stopped for this product.'
//                 });
//             }

//             // Update the specific product in the products array
//             dailyProduction.products = dailyProduction.products.map(p =>
//                 p.product_id.equals(product_id)
//                     ? { ...p.toObject(), stopped_at: new Date() }
//                     : p
//             );
//             dailyProduction.updated_by = req.user._id;

//             // Update status to Pending QC if all products have stopped_at
//             const allStopped = dailyProduction.products.every(p => p.stopped_at || !p.started_at);
//             if (allStopped) {
//                 dailyProduction.status = 'Pending QC';
//             }

//             const updatedProduction = await dailyProduction.save();
//             return res.status(200).json({
//                 success: true,
//                 message: 'Production stopped successfully for product.',
//                 data: updatedProduction
//             });
//         }
//     } catch (error) {
//         console.error('Error handling daily production action:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal Server Error',
//             error: error.message
//         });
//     }
// };


//// HANDLE API FOR HANDLEING INVENTORY --14-05-25

// export const handleDailyProductionAction = async (req, res) => {
//   console.log("came in production stage");
//   // const session = await mongoose.startSession();
//   try {
//     // session.startTransaction();

//     const { action, job_order, product_id } = req.body;

//     if (!['start', 'stop'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid action. Must be "start" or "stop".',
//       });
//     }

//     if (!req.user || !req.user._id) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized: User not authenticated.',
//       });
//     }

//     if (!job_order || !product_id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: job_order, product_id.',
//       });
//     }

//     const jobOrder = await JobOrder.findById(job_order)
//       .populate('work_order', 'work_order_number');
//       // .session(session);
//       console.log("jobOrder",jobOrder);

//     if (!jobOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Job order not found.',
//       });
//     }

//     const productExists = jobOrder.products.some((product) => product.product.equals(product_id));
//     if (!productExists) {
//       return res.status(400).json({
//         success: false,
//         message: 'Product ID not found in job order.',
//       });
//     }

//     if (action === 'start') {
//       console.log("came here start");
//       let dailyProduction = await DailyProduction.findOne({ job_order });
//       // .session(session);

//       if (dailyProduction) {
//         const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//         if (product && product.started_at) {
//           return res.status(400).json({
//             success: false,
//             message: 'Production already started for this product.',
//           });
//         }

//         dailyProduction.products = dailyProduction.products.map((p) =>
//           p.product_id.equals(product_id)
//             ? { ...p.toObject(), submitted_by: req.user._id, started_at: new Date() }
//             : p
//         );
//         dailyProduction.updated_by = req.user._id;
//         dailyProduction.status = 'In Progress';

//         const updatedProduction = await dailyProduction.save({  }); //session

//         const productionKey = `${job_order}_${product_id}`;
//         if (!activeProductions.has(productionKey)) {
//           const intervalId = setInterval(() => simulateProductionCount(job_order, product_id), 5000);
//           activeProductions.set(productionKey, intervalId);
//         }

//         // await session.commitTransaction();
//         return res.status(200).json({
//           success: true,
//           message: 'Production started successfully for product.',
//           data: updatedProduction,
//         });
//       } else {
//         const schemaProducts = jobOrder.products.map((product) => ({
//           product_id: product.product,
//           achieved_quantity: 0,
//           rejected_quantity: 0,
//           recycled_quantity: 0,
//           submitted_by: product.product.equals(product_id) ? req.user._id : undefined,
//           started_at: product.product.equals(product_id) ? new Date() : undefined,
//         }));

//         const newProduction = new DailyProduction({
//           work_order: jobOrder.work_order._id,
//           job_order,
//           products: schemaProducts,
//           created_by: req.user._id,
//           updated_by: req.user._id,
//           status: 'In Progress',
//         });

//         const savedProduction = await newProduction.save({  }); //session

//         const productionKey = `${job_order}_${product_id}`;
//         const intervalId = setInterval(() => simulateProductionCount(job_order, product_id), 10000);
//         activeProductions.set(productionKey, intervalId);

//         // await session.commitTransaction();
//         return res.status(201).json({
//           success: true,
//           message: 'Production started successfully.',
//           data: savedProduction,
//         });
//       }
//     } else if (action === 'stop') {
//       const dailyProduction = await DailyProduction.findOne({ job_order });
//       // .session(session);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order.',
//         });
//       }

//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       if (!product) {
//         return res.status(400).json({
//           success: false,
//           message: 'Product ID not found in daily production.',
//         });
//       }
//       if (!product.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this product.',
//         });
//       }
//       if (product.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this product.',
//         });
//       }

//       dailyProduction.products = dailyProduction.products.map((p) =>
//         p.product_id.equals(product_id)
//           ? { ...p.toObject(), stopped_at: new Date() }
//           : p
//       );
//       dailyProduction.updated_by = req.user._id;

//       const allStopped = dailyProduction.products.every((p) => p.stopped_at || !p.started_at);
//       if (allStopped) {
//         dailyProduction.status = 'Pending QC';
//       }

//       const updatedProduction = await dailyProduction.save({  }); //session

//       // Update Inventory
//       const inventory = await Inventory.findOne({
//         work_order: dailyProduction.work_order,
//         product: product_id,
//       });
//       // .session(session);
//       if (inventory) {
//         inventory.produced_quantity = product.achieved_quantity;
//         inventory.updated_by = req.user._id;
//         await inventory.save({  }); //session
//       }

//       const productionKey = `${job_order}_${product_id}`;
//       const intervalId = activeProductions.get(productionKey);
//       if (intervalId) {
//         clearInterval(intervalId);
//         activeProductions.delete(productionKey);
//       }

//       // await session.commitTransaction();
//       return res.status(200).json({
//         success: true,
//         message: 'Production stopped successfully for product.',
//         data: updatedProduction,
//       });
//     }
//   } catch (error) {
//     // await session.abortTransaction();
//     console.error('Error handling daily production action:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   } 
//   // finally {
//   //   session.endSession();
//   // }
// };








///working well - but not starting production for correct product ============================>
////////////////*************************** *//////////////////////////////////??????????????????????????*************

const activeProductions = new Map();

// const simulateProductionCount1 = async (job_order, product_id) => {
//   try {
//     console.log("Came in simulated count api");
//     const dailyProduction = await DailyProduction.findOne({ job_order });
//     console.log("dailyProduction.....", dailyProduction);
//     if (!dailyProduction) {
//       console.error(`DailyProduction not found for job_order: ${job_order}`);
//       return;
//     }

//     if (dailyProduction.status === 'Paused') {
//       console.log(`Production is paused for job_order: ${job_order}`);
//       return;
//     }

//     dailyProduction.products = dailyProduction.products.map((p) =>
//       p.product_id.equals(product_id)
//         ? { ...p.toObject(), achieved_quantity: p.achieved_quantity + 1 }
//         : p
//     );

//     await dailyProduction.save();
//     console.log(`Updated achieved_quantity for job_order: ${job_order}, product_id: ${product_id}`);

//     const inventory = await Inventory.findOne({
//       work_order: dailyProduction.work_order,
//       product: product_id,
//     });

//     if (inventory) {
//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       inventory.produced_quantity = product.achieved_quantity;
//       inventory.updated_by = dailyProduction.updated_by;
//       await inventory.save();
//     }
//   } catch (error) {
//     console.error(`Error updating achieved_quantity: ${error.message}`);
//   }
// };



// export const handleDailyProductionAction1 = async (req, res) => {
//   console.log("came in production stage");
//   try {
//     const { action, job_order, product_id, pause_description } = req.body;
//     console.log("req.body", req.body);

//     if (!['start', 'stop', 'pause', 'resume'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid action. Must be "start", "stop", "pause", or "resume".',
//       });
//     }

//     if (!req.user || !req.user._id) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized: User not authenticated.',
//       });
//     }

//     if (!job_order || !product_id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: job_order, product_id.',
//       });
//     }

//     const jobOrder = await JobOrder.findById(job_order).populate(
//       'work_order',
//       'work_order_number'
//     );
//     console.log("jobOrder", jobOrder);

//     if (!jobOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Job order not found.',
//       });
//     }

//     const productExists = jobOrder.products.some((product) =>
//       product.product.equals(product_id)
//     );
//     if (!productExists) {
//       return res.status(400).json({
//         success: false,
//         message: 'Product ID not found in job order.',
//       });
//     }

//     if (action === 'start') {
//       console.log("came here start");
//       let dailyProduction = await DailyProduction.findOne({ job_order });

//       if (dailyProduction) {
//         if (dailyProduction.started_at) {
//           return res.status(400).json({
//             success: false,
//             message: 'Production already started for this job order.',
//           });
//         }

//         dailyProduction.started_at = new Date();
//         dailyProduction.submitted_by = req.user._id;
//         dailyProduction.updated_by = req.user._id;
//         dailyProduction.status = 'In Progress';
//         dailyProduction.production_logs.push({
//           action: 'Start',
//           timestamp: new Date(),
//           user: req.user._id,
//           description: 'Production started',
//         });

//         const updatedProduction = await dailyProduction.save();
//         console.log("updatedProduction", updatedProduction);

//         for (const product of dailyProduction.products) {
//           const productionKey = `${job_order}_${product.product_id}`;
//           if (!activeProductions.has(productionKey)) {
//             const intervalId = setInterval(
//               () => simulateProductionCount(job_order, product.product_id),
//               5000
//             );
//             activeProductions.set(productionKey, intervalId);
//           }
//         }

//         return res.status(200).json({
//           success: true,
//           message: 'Production started successfully for job order.',
//           data: updatedProduction,
//         });
//       } else {
//         console.log("came in else as it is first daily production");
//         const schemaProducts = jobOrder.products.map((product) => ({
//           product_id: product.product,
//           achieved_quantity: 0,
//           rejected_quantity: 0,
//           recycled_quantity: 0,
//         }));

//         const newProduction = new DailyProduction({
//           work_order: jobOrder.work_order._id,
//           job_order,
//           products: schemaProducts,
//           submitted_by: req.user._id,
//           started_at: new Date(),
//           created_by: req.user._id,
//           updated_by: req.user._id,
//           status: 'In Progress',
//           production_logs: [
//             {
//               action: 'Start',
//               timestamp: new Date(),
//               user: req.user._id,
//               description: 'Production started',
//             },
//           ],
//         });

//         const savedProduction = await newProduction.save();
//         console.log("savedProduction", savedProduction);

//         for (const product of newProduction.products) {
//           const productionKey = `${job_order}_${product.product_id}`;
//           const intervalId = setInterval(
//             () => simulateProductionCount(job_order, product.product_id),
//             5000
//           );
//           activeProductions.set(productionKey, intervalId);
//         }

//         return res.status(201).json({
//           success: true,
//           message: 'Production started successfully.',
//           data: savedProduction,
//         });
//       }
//     } else if (action === 'pause') {
//       const dailyProduction = await DailyProduction.findOne({ job_order });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order.',
//         });
//       }
//       if (dailyProduction.status === 'Paused') {
//         return res.status(400).json({
//           success: false,
//           message: 'Production is already paused.',
//         });
//       }

//       dailyProduction.status = 'Paused';
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.production_logs.push({
//         action: 'Pause',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: pause_description || 'Production paused',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       for (const product of dailyProduction.products) {
//         const productionKey = `${job_order}_${product.product_id}`;
//         const intervalId = activeProductions.get(productionKey);
//         if (intervalId) {
//           clearInterval(intervalId);
//           activeProductions.delete(productionKey);
//         }
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production paused successfully for job order.',
//         data: updatedProduction,
//       });
//     } else if (action === 'resume') {
//       const dailyProduction = await DailyProduction.findOne({ job_order });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order.',
//         });
//       }
//       if (dailyProduction.status !== 'Paused') {
//         return res.status(400).json({
//           success: false,
//           message: 'Production is not paused.',
//         });
//       }

//       dailyProduction.status = 'In Progress';
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.production_logs.push({
//         action: 'Resume',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: 'Production resumed',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       for (const product of dailyProduction.products) {
//         const productionKey = `${job_order}_${product.product_id}`;
//         if (!activeProductions.has(productionKey)) {
//           const intervalId = setInterval(
//             () => simulateProductionCount(job_order, product.product_id),
//             5000
//           );
//           activeProductions.set(productionKey, intervalId);
//         }
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production resumed successfully for job order.',
//         data: updatedProduction,
//       });
//     } else if (action === 'stop') {
//       const dailyProduction = await DailyProduction.findOne({ job_order });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order.',
//         });
//       }

//       dailyProduction.stopped_at = new Date();
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.status = 'Pending QC';
//       dailyProduction.production_logs.push({
//         action: 'Stop',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: 'Production stopped',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       for (const product of dailyProduction.products) {
//         const inventory = await Inventory.findOne({
//           work_order: dailyProduction.work_order,
//           product: product.product_id,
//         });
//         if (inventory) {
//           inventory.produced_quantity = product.achieved_quantity;
//           inventory.updated_by = req.user._id;
//           await inventory.save();
//         }
//       }

//       for (const product of dailyProduction.products) {
//         const productionKey = `${job_order}_${product.product_id}`;
//         const intervalId = activeProductions.get(productionKey);
//         if (intervalId) {
//           clearInterval(intervalId);
//           activeProductions.delete(productionKey);
//         }
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production stopped successfully for job order.',
//         data: updatedProduction,
//       });
//     }
//   } catch (error) {
//     console.error('Error handling daily production action:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };

// const simulateProductionCount22 = async (job_order, product_id) => {
//   try {
//     console.log("Came in simulated count api");
//     // Find the DailyProduction document that matches both job_order and product_id
//     const dailyProduction = await DailyProduction.findOne({
//       job_order,
//       'products.product_id': product_id,
//     });
//     console.log("dailyProduction.....", dailyProduction);
//     if (!dailyProduction) {
//       console.error(`DailyProduction not found for job_order: ${job_order}, product_id: ${product_id}`);
//       return;
//     }

//     if (dailyProduction.status === 'Paused') {
//       console.log(`Production is paused for job_order: ${job_order}, product_id: ${product_id}`);
//       return;
//     }

//     dailyProduction.products = dailyProduction.products.map((p) =>
//       p.product_id.equals(product_id)
//         ? { ...p.toObject(), achieved_quantity: p.achieved_quantity + 1 }
//         : p
//     );

//     await dailyProduction.save();
//     console.log(`Updated achieved_quantity for job_order: ${job_order}, product_id: ${product_id}`);

//     const inventory = await Inventory.findOne({
//       work_order: dailyProduction.work_order,
//       product: product_id,
//     });

//     if (inventory) {
//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       inventory.produced_quantity = product.achieved_quantity;
//       inventory.updated_by = dailyProduction.updated_by;
//       await inventory.save();
//     }
//   } catch (error) {
//     console.error(`Error updating achieved_quantity: ${error.message}`);
//   }
// };

// export const handleDailyProductionAction22 = async (req, res) => {
//   console.log("came in production stage");
//   try {
//     const { action, job_order, product_id, pause_description } = req.body;
//     console.log("req.body", req.body);

//     if (!['start', 'stop', 'pause', 'resume'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid action. Must be "start", "stop", "pause", or "resume".',
//       });
//     }

//     if (!req.user || !req.user._id) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized: User not authenticated.',
//       });
//     }

//     if (!job_order || !product_id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: job_order, product_id.',
//       });
//     }

//     const jobOrder = await JobOrder.findById(job_order).populate(
//       'work_order',
//       'work_order_number'
//     );
//     console.log("jobOrder", jobOrder);

//     if (!jobOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Job order not found.',
//       });
//     }

//     const productExists = jobOrder.products.some((product) =>
//       product.product.equals(product_id)
//     );
//     if (!productExists) {
//       return res.status(400).json({
//         success: false,
//         message: 'Product ID not found in job order.',
//       });
//     }

//     if (action === 'start') {
//       console.log("came here start");
//       // Find the DailyProduction document for the specific job_order and product_id
//       let dailyProduction = await DailyProduction.findOne({
//         job_order,
//         'products.product_id': product_id,
//       });

//       if (dailyProduction) {
//         if (dailyProduction.started_at) {
//           return res.status(400).json({
//             success: false,
//             message: 'Production already started for this job order and product.',
//           });
//         }

//         dailyProduction.started_at = new Date();
//         dailyProduction.submitted_by = req.user._id;
//         dailyProduction.updated_by = req.user._id;
//         dailyProduction.status = 'In Progress';
//         dailyProduction.production_logs.push({
//           action: 'Start',
//           timestamp: new Date(),
//           user: req.user._id,
//           description: 'Production started',
//         });

//         const updatedProduction = await dailyProduction.save();
//         console.log("updatedProduction", updatedProduction);

//         // Start production simulation only for the requested product
//         const productionKey = `${job_order}_${product_id}`;
//         if (!activeProductions.has(productionKey)) {
//           const intervalId = setInterval(
//             () => simulateProductionCount(job_order, product_id),
//             10000
//           );
//           activeProductions.set(productionKey, intervalId);
//         }

//         return res.status(200).json({
//           success: true,
//           message: 'Production started successfully for the specified product.',
//           data: updatedProduction,
//         });
//       } else {
//         console.log("came in else as it is first daily production");
//         const schemaProducts = jobOrder.products
//           .filter((product) => product.product.equals(product_id))
//           .map((product) => ({
//             product_id: product.product,
//             achieved_quantity: 0,
//             rejected_quantity: 0,
//             recycled_quantity: 0,
//           }));

//         if (schemaProducts.length === 0) {
//           return res.status(400).json({
//             success: false,
//             message: 'No matching product found to start production.',
//           });
//         }

//         const newProduction = new DailyProduction({
//           work_order: jobOrder.work_order._id,
//           job_order,
//           products: schemaProducts,
//           submitted_by: req.user._id,
//           started_at: new Date(),
//           created_by: req.user._id,
//           updated_by: req.user._id,
//           status: 'In Progress',
//           production_logs: [
//             {
//               action: 'Start',
//               timestamp: new Date(),
//               user: req.user._id,
//               description: 'Production started',
//             },
//           ],
//         });

//         const savedProduction = await newProduction.save();
//         console.log("savedProduction", savedProduction);

//         // Start production simulation only for the requested product
//         const productionKey = `${job_order}_${product_id}`;
//         const intervalId = setInterval(
//           () => simulateProductionCount(job_order, product_id),
//           10000
//         );
//         activeProductions.set(productionKey, intervalId);

//         return res.status(201).json({
//           success: true,
//           message: 'Production started successfully.',
//           data: savedProduction,
//         });
//       }
//     } else if (action === 'pause') {
//       const dailyProduction = await DailyProduction.findOne({
//         job_order,
//         'products.product_id': product_id,
//       });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order and product.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order and product.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order and product.',
//         });
//       }
//       if (dailyProduction.status === 'Paused') {
//         return res.status(400).json({
//           success: false,
//           message: 'Production is already paused.',
//         });
//       }

//       dailyProduction.status = 'Paused';
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.production_logs.push({
//         action: 'Pause',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: pause_description || 'Production paused',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       const productionKey = `${job_order}_${product_id}`;
//       const intervalId = activeProductions.get(productionKey);
//       if (intervalId) {
//         clearInterval(intervalId);
//         activeProductions.delete(productionKey);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production paused successfully for the specified product.',
//         data: updatedProduction,
//       });
//     } else if (action === 'resume') {
//       const dailyProduction = await DailyProduction.findOne({
//         job_order,
//         'products.product_id': product_id,
//       });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order and product.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order and product.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order and product.',
//         });
//       }
//       if (dailyProduction.status !== 'Paused') {
//         return res.status(400).json({
//           success: false,
//           message: 'Production is not paused.',
//         });
//       }

//       dailyProduction.status = 'In Progress';
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.production_logs.push({
//         action: 'Resume',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: 'Production resumed',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       const productionKey = `${job_order}_${product_id}`;
//       if (!activeProductions.has(productionKey)) {
//         const intervalId = setInterval(
//           () => simulateProductionCount(job_order, product_id),
//           10000
//         );
//         activeProductions.set(productionKey, intervalId);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production resumed successfully for the specified product.',
//         data: updatedProduction,
//       });
//     } else if (action === 'stop') {
//       const dailyProduction = await DailyProduction.findOne({
//         job_order,
//         'products.product_id': product_id,
//       });
//       console.log("dailyProduction", dailyProduction);
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order and product.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order and product.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order and product.',
//         });
//       }

//       dailyProduction.stopped_at = new Date();
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.status = 'Pending QC';
//       dailyProduction.production_logs.push({
//         action: 'Stop',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: 'Production stopped',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       const inventory = await Inventory.findOne({
//         work_order: dailyProduction.work_order,
//         product: product_id,
//       });
//       if (inventory) {
//         inventory.produced_quantity = product.achieved_quantity;
//         inventory.updated_by = req.user._id;
//         await inventory.save();
//       }

//       const productionKey = `${job_order}_${product_id}`;
//       const intervalId = activeProductions.get(productionKey);
//       if (intervalId) {
//         clearInterval(intervalId);
//         activeProductions.delete(productionKey);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production stopped successfully for the specified product.',
//         data: updatedProduction,
//       });
//     }
//   } catch (error) {
//     console.error('Error handling daily production action:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };

//22-05-25
//SEMIFINAL =>

// const simulateProductionCount = async (job_order, product_id) => {
//   try {
//     console.log("Came in simulated count api**");

//     // Find the DailyProduction document that matches both job_order and product_id
//     const dailyProduction = await DailyProduction.findOne({
//       job_order,
//       'products.product_id': product_id,
//     });
//     console.log("dailyProduction.....", dailyProduction);

//     if (!dailyProduction) {
//       console.error(`DailyProduction not found for job_order: ${job_order}, product_id: ${product_id}`);
//       return;
//     }

//     if (dailyProduction.status === 'Paused') {
//       console.log(`Production is paused for job_order: ${job_order}, product_id: ${product_id}`);
//       return;
//     }

//     if (dailyProduction.status === 'Pending QC') {
//       console.log(`Production already stopped for job_order: ${job_order}, product_id: ${product_id}`);
//       return;
//     }

//     // Find the JobOrder to get the planned_quantity
//     const jobOrder = await JobOrder.findById(job_order);
//     if (!jobOrder) {
//       console.error(`JobOrder not found for job_order: ${job_order}`);
//       return;
//     }

//     const jobOrderProduct = jobOrder.products.find((product) =>
//       product.product.equals(product_id)
//     );
//     if (!jobOrderProduct) {
//       console.error(`Product ${product_id} not found in JobOrder ${job_order}`);
//       return;
//     }

//     const plannedQuantity = jobOrderProduct.planned_quantity;

//     // Find the product in DailyProduction to get the current achieved_quantity
//     const dailyProduct = dailyProduction.products.find((p) =>
//       p.product_id.equals(product_id)
//     );
//     if (!dailyProduct) {
//       console.error(`Product ${product_id} not found in DailyProduction ${dailyProduction._id}`);
//       return;
//     }

//     const currentAchievedQuantity = dailyProduct.achieved_quantity;
//     const newAchievedQuantity = currentAchievedQuantity + 1;

//     // Check if the new achieved_quantity would exceed the planned_quantity
//     if (newAchievedQuantity > plannedQuantity) {
//       console.log(`Planned quantity reached for job_order: ${job_order}, product_id: ${product_id}. Stopping production.`);

//       // Stop production
//       dailyProduction.status = 'Pending QC';
//       dailyProduction.stopped_at = new Date();
//       dailyProduction.production_logs.push({
//         action: 'Stop',
//         timestamp: new Date(),
//         user: dailyProduction.updated_by, // Use the user who last updated the document
//         description: 'Production stopped automatically: Planned quantity reached',
//       });

//       await dailyProduction.save();
//       console.log(`Production stopped for job_order: ${job_order}, product_id: ${product_id}`);

//       // Update inventory
//       const inventory = await Inventory.findOne({
//         work_order: dailyProduction.work_order,
//         product: product_id,
//       });
//       if (inventory) {
//         inventory.produced_quantity = dailyProduct.achieved_quantity; // Use current, not incremented value
//         inventory.updated_by = dailyProduction.updated_by;
//         await inventory.save();
//       }

//       // Clear the production interval
//       const productionKey = `${job_order}_${product_id}`;
//       const intervalId = activeProductions.get(productionKey);
//       if (intervalId) {
//         clearInterval(intervalId);
//         activeProductions.delete(productionKey);
//       }

//       return;
//     }

//     // If planned quantity not exceeded, proceed with incrementing achieved_quantity
//     dailyProduction.products = dailyProduction.products.map((p) =>
//       p.product_id.equals(product_id)
//         ? { ...p.toObject(), achieved_quantity: newAchievedQuantity }
//         : p
//     );

//     await dailyProduction.save();
//     console.log(`Updated achieved_quantity for job_order: ${job_order}, product_id: ${product_id}`);

//     // Update inventory
//     const inventory = await Inventory.findOne({
//       work_order: dailyProduction.work_order,
//       product: product_id,
//     });
//     if (inventory) {
//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       inventory.produced_quantity = product.achieved_quantity;
//       inventory.updated_by = dailyProduction.updated_by;
//       await inventory.save();
//     }
//   } catch (error) {
//     console.error(`Error updating achieved_quantity: ${error.message}`);
//   }
// };


// export const handleDailyProductionAction = async (req, res) => {
//   console.log("came in production stage");
//   try {
//     const { action, job_order, product_id, pause_description } = req.body;
//     console.log("req.body", req.body);

//     if (!['start', 'stop', 'pause', 'resume'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid action. Must be "start", "stop", "pause", or "resume".',
//       });
//     }

//     if (!req.user || !req.user._id) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized: User not authenticated.',
//       });
//     }

//     if (!job_order || !product_id) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: job_order, product_id.',
//       });
//     }

//     const jobOrder = await JobOrder.findById(job_order).populate(
//       'work_order',
//       'work_order_number'
//     );
//     console.log("jobOrder", jobOrder);

//     if (!jobOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Job order not found.',
//       });
//     }

//     const jobOrderProduct = jobOrder.products.find((product) =>
//       product.product.equals(product_id)
//     );
//     if (!jobOrderProduct) {
//       return res.status(400).json({
//         success: false,
//         message: 'Product ID not found in job order.',
//       });
//     }

//     const plannedQuantity = jobOrderProduct.planned_quantity;

//     // Check achieved_quantity before starting or resuming production
//     let dailyProduction = await DailyProduction.findOne({
//       job_order,
//       'products.product_id': product_id,
//     });

//     if (dailyProduction) {
//       const dailyProduct = dailyProduction.products.find((p) =>
//         p.product_id.equals(product_id)
//       );
//       if (dailyProduct && dailyProduct.achieved_quantity >= plannedQuantity) {
//         return res.status(400).json({
//           success: false,
//           message: 'Cannot start or resume production: Planned quantity already reached.',
//         });
//       }
//     }

//     if (action === 'start') {
//       console.log("came here start");

//       if (dailyProduction) {
//         if (dailyProduction.started_at) {
//           return res.status(400).json({
//             success: false,
//             message: 'Production already started for this job order and product.',
//           });
//         }

//         dailyProduction.started_at = new Date();
//         dailyProduction.submitted_by = req.user._id;
//         dailyProduction.updated_by = req.user._id;
//         dailyProduction.status = 'In Progress';
//         dailyProduction.production_logs.push({
//           action: 'Start',
//           timestamp: new Date(),
//           user: req.user._id,
//           description: 'Production started',
//         });

//         const updatedProduction = await dailyProduction.save();
//         console.log("updatedProduction", updatedProduction);

//         // Start production simulation only for the requested product
//         const productionKey = `${job_order}_${product_id}`;
//         if (!activeProductions.has(productionKey)) {
//           const intervalId = setInterval(
//             () => simulateProductionCount(job_order, product_id),
//             10000
//           );
//           activeProductions.set(productionKey, intervalId);
//         }

//         return res.status(200).json({
//           success: true,
//           message: 'Production started successfully for the specified product.',
//           data: updatedProduction,
//         });
//       } else {
//         console.log("came in else as it is first daily production");
//         const schemaProducts = jobOrder.products
//           .filter((product) => product.product.equals(product_id))
//           .map((product) => ({
//             product_id: product.product,
//             achieved_quantity: 0,
//             rejected_quantity: 0,
//             recycled_quantity: 0,
//           }));

//         if (schemaProducts.length === 0) {
//           return res.status(400).json({
//             success: false,
//             message: 'No matching product found to start production.',
//           });
//         }

//         const newProduction = new DailyProduction({
//           work_order: jobOrder.work_order._id,
//           job_order,
//           products: schemaProducts,
//           submitted_by: req.user._id,
//           started_at: new Date(),
//           created_by: req.user._id,
//           updated_by: req.user._id,
//           status: 'In Progress',
//           production_logs: [
//             {
//               action: 'Start',
//               timestamp: new Date(),
//               user: req.user._id,
//               description: 'Production started',
//             },
//           ],
//         });

//         const savedProduction = await newProduction.save();
//         console.log("savedProduction", savedProduction);

//         // Start production simulation only for the requested product
//         const productionKey = `${job_order}_${product_id}`;
//         const intervalId = setInterval(
//           () => simulateProductionCount(job_order, product_id),
//           10000
//         );
//         activeProductions.set(productionKey, intervalId);

//         return res.status(201).json({
//           success: true,
//           message: 'Production started successfully.',
//           data: savedProduction,
//         });
//       }
//     } else if (action === 'pause') {
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order and product.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order and product.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order and product.',
//         });
//       }
//       if (dailyProduction.status === 'Paused') {
//         return res.status(400).json({
//           success: false,
//           message: 'Production is already paused.',
//         });
//       }

//       dailyProduction.status = 'Paused';
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.production_logs.push({
//         action: 'Pause',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: pause_description || 'Production paused',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       const productionKey = `${job_order}_${product_id}`;
//       const intervalId = activeProductions.get(productionKey);
//       if (intervalId) {
//         clearInterval(intervalId);
//         activeProductions.delete(productionKey);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production paused successfully for the specified product.',
//         data: updatedProduction,
//       });
//     } else if (action === 'resume') {
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order and product.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order and product.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order and product.',
//         });
//       }
//       if (dailyProduction.status !== 'Paused') {
//         return res.status(400).json({
//           success: false,
//           message: 'Production is not paused.',
//         });
//       }

//       dailyProduction.status = 'In Progress';
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.production_logs.push({
//         action: 'Resume',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: 'Production resumed',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       const productionKey = `${job_order}_${product_id}`;
//       if (!activeProductions.has(productionKey)) {
//         const intervalId = setInterval(
//           () => simulateProductionCount(job_order, product_id),
//           10000
//         );
//         activeProductions.set(productionKey, intervalId);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production resumed successfully for the specified product.',
//         data: updatedProduction,
//       });
//     } else if (action === 'stop') {
//       if (!dailyProduction) {
//         return res.status(404).json({
//           success: false,
//           message: 'Daily production document not found for this job order and product.',
//         });
//       }

//       if (!dailyProduction.started_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production has not started for this job order and product.',
//         });
//       }
//       if (dailyProduction.stopped_at) {
//         return res.status(400).json({
//           success: false,
//           message: 'Production already stopped for this job order and product.',
//         });
//       }

//       dailyProduction.stopped_at = new Date();
//       dailyProduction.updated_by = req.user._id;
//       dailyProduction.status = 'Pending QC';
//       dailyProduction.production_logs.push({
//         action: 'Stop',
//         timestamp: new Date(),
//         user: req.user._id,
//         description: 'Production stopped',
//       });

//       const updatedProduction = await dailyProduction.save();
//       console.log("updatedProduction", updatedProduction);

//       const product = dailyProduction.products.find((p) => p.product_id.equals(product_id));
//       const inventory = await Inventory.findOne({
//         work_order: dailyProduction.work_order,
//         product: product_id,
//       });
//       if (inventory) {
//         inventory.produced_quantity = product.achieved_quantity;
//         inventory.updated_by = req.user._id;
//         await inventory.save();
//       }

//       const productionKey = `${job_order}_${product_id}`;
//       const intervalId = activeProductions.get(productionKey);
//       if (intervalId) {
//         clearInterval(intervalId);
//         activeProductions.delete(productionKey);
//       }

//       return res.status(200).json({
//         success: true,
//         message: 'Production stopped successfully for the specified product.',
//         data: updatedProduction,
//       });
//     }
//   } catch (error) {
//     console.error('Error handling daily production action:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };

///FINAL WAS WORKING BUT CHANGES MADE FOR HABNDELING UNIQUE PRODUCTION=>

const simulateProductionCounts_19_08_2025 = async (job_order, product_id) => {
  try {
    // console.log("Came in simulated count api###");

    // Find the DailyProduction document that matches both job_order and product_id
    const dailyProduction = await DailyProduction.findOne({
      job_order,
      'products.product_id': product_id,
    });
    // console.log("dailyProduction.....", dailyProduction);

    if (!dailyProduction) {
      console.error(`DailyProduction not found for job_order: ${job_order}, product_id: ${product_id}`);
      return;
    }

    if (dailyProduction.status === 'Paused') {
      console.log(`Production is paused for job_order: ${job_order}, product_id: ${product_id}`);
      return;
    }

    if (dailyProduction.status === 'Pending QC') {
      console.log(`Production already stopped for job_order: ${job_order}, product_id: ${product_id}`);
      return;
    }

    // Find the JobOrder to get the planned_quantity
    const jobOrder = await JobOrder.findById(job_order);
    if (!jobOrder) {
      console.error(`JobOrder not found for job_order: ${job_order}`);
      return;
    }

    const jobOrderProduct = jobOrder.products.find((product) =>
      product.product.equals(product_id)
    );
    if (!jobOrderProduct) {
      console.error(`Product ${product_id} not found in JobOrder ${job_order}`);
      return;
    }

    const plannedQuantity = jobOrderProduct.planned_quantity;

    // Find the product in DailyProduction to get the current achieved_quantity
    const dailyProduct = dailyProduction.products.find((p) =>
      p.product_id.equals(product_id)
    );
    if (!dailyProduct) {
      console.error(`Product ${product_id} not found in DailyProduction ${dailyProduction._id}`);
      return;
    }

    const currentAchievedQuantity = dailyProduct.achieved_quantity;
    const newAchievedQuantity = currentAchievedQuantity + 1;

    // Check if the new achieved_quantity would exceed the planned_quantity
    if (newAchievedQuantity > plannedQuantity) {
      console.log(`Planned quantity reached for job_order: ${job_order}, product_id: ${product_id}. Stopping production.`);

      // Stop production
      dailyProduction.status = 'Pending QC';
      dailyProduction.stopped_at = new Date();
      dailyProduction.production_logs.push({
        action: 'Stop',
        timestamp: new Date(),
        user: dailyProduction.updated_by,
        description: 'Production stopped automatically: Planned quantity reached',
      });

      await dailyProduction.save();
      console.log(`Production stopped for job_order: ${job_order}, product_id: ${product_id}`);

      // Update inventory with the total achieved_quantity across all DailyProduction documents
      const allDailyProductions = await DailyProduction.find({
        work_order: dailyProduction.work_order,
        'products.product_id': product_id,
      });

      let totalAchievedQuantity = 0;
      allDailyProductions.forEach((dp) => {
        const product = dp.products.find((p) => p.product_id.equals(product_id));
        if (product) {
          totalAchievedQuantity += product.achieved_quantity;
        }
      });

      const inventory = await Inventory.findOne({
        work_order: dailyProduction.work_order,
        product: product_id,
      });
      if (inventory) {
        inventory.produced_quantity = totalAchievedQuantity;
        inventory.updated_by = dailyProduction.updated_by;
        await inventory.save();
      }

      // Clear the production interval
      const productionKey = `${job_order}_${product_id}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return;
    }

    // If planned quantity not exceeded, proceed with incrementing achieved_quantity
    dailyProduction.products = dailyProduction.products.map((p) =>
      p.product_id.equals(product_id)
        ? { ...p.toObject(), achieved_quantity: newAchievedQuantity }
        : p
    );

    await dailyProduction.save();
    console.log(`Updated achieved_quantity for job_order: ${job_order}, product_id: ${product_id}`);

    // Update inventory with the total achieved_quantity across all DailyProduction documents
    const allDailyProductions = await DailyProduction.find({
      work_order: dailyProduction.work_order,
      'products.product_id': product_id,
    });

    let totalAchievedQuantity = 0;
    allDailyProductions.forEach((dp) => {
      const product = dp.products.find((p) => p.product_id.equals(product_id));
      if (product) {
        totalAchievedQuantity += product.achieved_quantity;
      }
    });

    const inventory = await Inventory.findOne({
      work_order: dailyProduction.work_order,
      product: product_id,
    });
    if (inventory) {
      inventory.produced_quantity = totalAchievedQuantity;
      inventory.updated_by = dailyProduction.updated_by;
      await inventory.save();
    }
  } catch (error) {
    console.error(`Error updating achieved_quantity: ${error.message}`);
  }
};
export const handleDailyProductionActions_19_08_2025 = async (req, res) => {
  console.log("came in production stage");
  try {
    const { action, job_order, product_id, pause_description } = req.body;
    console.log("req.body", req.body);

    if (!['start', 'stop', 'pause', 'resume'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "start", "stop", "pause", or "resume".',
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated.',
      });
    }

    if (!job_order || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: job_order, product_id.',
      });
    }

    const jobOrder = await JobOrder.findById(job_order).populate(
      'work_order',
      'work_order_number'
    );
    console.log("jobOrder", jobOrder);

    if (!jobOrder) {
      return res.status(404).json({
        success: false,
        message: 'Job order not found.',
      });
    }

    const jobOrderProduct = jobOrder.products.find((product) =>
      product.product.equals(product_id)
    );
    if (!jobOrderProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product ID not found in job order.',
      });
    }

    const plannedQuantity = jobOrderProduct.planned_quantity;

    // Check achieved_quantity before starting or resuming production
    let dailyProduction = await DailyProduction.findOne({
      job_order,
      'products.product_id': product_id,
    });

    if (dailyProduction) {
      const dailyProduct = dailyProduction.products.find((p) =>
        p.product_id.equals(product_id)
      );
      if (dailyProduct && dailyProduct.achieved_quantity >= plannedQuantity) {
        return res.status(400).json({
          success: false,
          message: 'Cannot start or resume production: Planned quantity already reached.',
        });
      }
    }

    if (action === 'start') {
      console.log("came here start");

      if (dailyProduction) {
        if (dailyProduction.started_at) {
          return res.status(400).json({
            success: false,
            message: 'Production already started for this job order and product.',
          });
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
        console.log("updatedProduction", updatedProduction);

        // Update work order status based on production status
        try {
          await updateWorkOrderStatus(jobOrder.work_order);
        } catch (error) {
          console.error('Error updating work order status:', error);
        }

        // Update job order status based on production status
        try {
          await updateJobOrderStatus(job_order);
        } catch (error) {
          console.error('Error updating job order status:', error);
        }

        // Start production simulation only for the requested product
        const productionKey = `${job_order}_${product_id}`;
        if (!activeProductions.has(productionKey)) {
          const intervalId = setInterval(
            () => simulateProductionCounts(job_order, product_id),
            10000
          );
          activeProductions.set(productionKey, intervalId);
        }

        return res.status(200).json({
          success: true,
          message: 'Production started successfully for the specified product.',
          data: updatedProduction,
        });
      } else {
        console.log("came in else as it is first daily production");
        const schemaProducts = jobOrder.products
          .filter((product) => product.product.equals(product_id))
          .map((product) => ({
            product_id: product.product,
            achieved_quantity: 0,
            rejected_quantity: 0,
            recycled_quantity: 0,
          }));

        if (schemaProducts.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No matching product found to start production.',
          });
        }

        const newProduction = new DailyProduction({
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
        console.log("savedProduction", savedProduction);

        // Start production simulation only for the requested product
        const productionKey = `${job_order}_${product_id}`;
        const intervalId = setInterval(
          () => simulateProductionCounts(job_order, product_id),
          10000
        );
        activeProductions.set(productionKey, intervalId);

        return res.status(201).json({
          success: true,
          message: 'Production started successfully.',
          data: savedProduction,
        });
      }
    } else if (action === 'pause') {
      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: 'Daily production document not found for this job order and product.',
        });
      }

      if (!dailyProduction.started_at) {
        return res.status(400).json({
          success: false,
          message: 'Production has not started for this job order and product.',
        });
      }
      if (dailyProduction.stopped_at) {
        return res.status(400).json({
          success: false,
          message: 'Production already stopped for this job order and product.',
        });
      }
      if (dailyProduction.status === 'Paused') {
        return res.status(400).json({
          success: false,
          message: 'Production is already paused.',
        });
      }

      dailyProduction.status = 'Paused';
      dailyProduction.updated_by = req.user._id;
      dailyProduction.production_logs.push({
        action: 'Pause',
        timestamp: new Date(),
        user: req.user._id,
        description: pause_description || 'Production paused',
      });

      const updatedProduction = await dailyProduction.save();
      console.log("updatedProduction", updatedProduction);

      const productionKey = `${job_order}_${product_id}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return res.status(200).json({
        success: true,
        message: 'Production paused successfully for the specified product.',
        data: updatedProduction,
      });
    } else if (action === 'resume') {
      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: 'Daily production document not found for this job order and product.',
        });
      }

      if (!dailyProduction.started_at) {
        return res.status(400).json({
          success: false,
          message: 'Production has not started for this job order and product.',
        });
      }
      if (dailyProduction.stopped_at) {
        return res.status(400).json({
          success: false,
          message: 'Production already stopped for this job order and product.',
        });
      }
      if (dailyProduction.status !== 'Paused') {
        return res.status(400).json({
          success: false,
          message: 'Production is not paused.',
        });
      }

      dailyProduction.status = 'In Progress';
      dailyProduction.updated_by = req.user._id;
      dailyProduction.production_logs.push({
        action: 'Resume',
        timestamp: new Date(),
        user: req.user._id,
        description: 'Production resumed',
      });

      const updatedProduction = await dailyProduction.save();
      console.log("updatedProduction", updatedProduction);

      const productionKey = `${job_order}_${product_id}`;
      if (!activeProductions.has(productionKey)) {
        const intervalId = setInterval(
          () => simulateProductionCounts(job_order, product_id),
          10000
        );
        activeProductions.set(productionKey, intervalId);
      }

      return res.status(200).json({
        success: true,
        message: 'Production resumed successfully for the specified product.',
        data: updatedProduction,
      });
    } else if (action === 'stop') {
      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: 'Daily production document not found for this job order and product.',
        });
      }

      if (!dailyProduction.started_at) {
        return res.status(400).json({
          success: false,
          message: 'Production has not started for this job order and product.',
        });
      }
      if (dailyProduction.stopped_at) {
        return res.status(400).json({
          success: false,
          message: 'Production already stopped for this job order and product.',
        });
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

      const updatedProduction = await dailyProduction.save();
      console.log("updatedProduction", updatedProduction);

      // Update inventory with the total achieved_quantity across all DailyProduction documents
      const allDailyProductions = await DailyProduction.find({
        work_order: dailyProduction.work_order,
        'products.product_id': product_id,
      });

      let totalAchievedQuantity = 0;
      allDailyProductions.forEach((dp) => {
        const product = dp.products.find((p) => p.product_id.equals(product_id));
        if (product) {
          totalAchievedQuantity += product.achieved_quantity;
        }
      });

      const inventory = await Inventory.findOne({
        work_order: dailyProduction.work_order,
        product: product_id,
      });
      if (inventory) {
        inventory.produced_quantity = totalAchievedQuantity;
        inventory.updated_by = req.user._id;
        await inventory.save();
      }

      const productionKey = `${job_order}_${product_id}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return res.status(200).json({
        success: true,
        message: 'Production stopped successfully for the specified product.',
        data: updatedProduction,
      });
    }
  } catch (error) {
    console.error('Error handling daily production action:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};









const simulateProductionCounts_18_08_2025 = async (job_order, objId) => {
  try {
    // Find the DailyProduction document that matches both job_order and objId
    const dailyProduction = await DailyProduction.findOne({
      job_order,
      'products.objId': objId,
      status: 'In Progress', // Only simulate for In Progress records
    });

    if (!dailyProduction) {
      console.error(`DailyProduction not found or not In Progress for job_order: ${job_order}, objId: ${objId}`);
      return;
    }

    if (dailyProduction.status === 'Paused') {
      console.log(`Production is paused for job_order: ${job_order}, objId: ${objId}`);
      return;
    }

    if (dailyProduction.status === 'Pending QC') {
      console.log(`Production already stopped for job_order: ${job_order}, objId: ${objId}`);
      return;
    }

    // Find the JobOrder to get the planned_quantity
    const jobOrder = await JobOrder.findById(job_order);
    if (!jobOrder) {
      console.error(`JobOrder not found for job_order: ${job_order}`);
      return;
    }

    const jobOrderProduct = jobOrder.products.find((product) =>
      product._id.equals(objId)
    );
    if (!jobOrderProduct) {
      console.error(`Product subdocument ${objId} not found in JobOrder ${job_order}`);
      return;
    }

    const plannedQuantity = jobOrderProduct.planned_quantity;

    // Find the product in DailyProduction to get the current achieved_quantity
    const dailyProduct = dailyProduction.products.find((p) =>
      p.objId.equals(objId)
    );
    if (!dailyProduct) {
      console.error(`Product subdocument ${objId} not found in DailyProduction ${dailyProduction._id}`);
      return;
    }

    const currentAchievedQuantity = dailyProduct.achieved_quantity;
    const newAchievedQuantity = currentAchievedQuantity + 1;

    // Check if the new achieved_quantity would exceed the planned_quantity
    if (newAchievedQuantity > plannedQuantity) {
      console.log(`Planned quantity reached for job_order: ${job_order}, objId: ${objId}. Stopping production.`);

      // Stop production
      dailyProduction.status = 'Pending QC';
      dailyProduction.stopped_at = new Date();
      dailyProduction.production_logs.push({
        action: 'Stop',
        timestamp: new Date(),
        user: dailyProduction.updated_by,
        description: 'Production stopped automatically: Planned quantity reached',
      });

      await dailyProduction.save();
      console.log(`Production stopped for job_order: ${job_order}, objId: ${objId}`);

      // Update inventory with the total achieved_quantity
      const allDailyProductions = await DailyProduction.find({
        work_order: dailyProduction.work_order,
        'products.objId': objId, // Updated to use objId
      });

      let totalAchievedQuantity = 0;
      allDailyProductions.forEach((dp) => {
        const product = dp.products.find((p) => p.objId.equals(objId));
        if (product) {
          totalAchievedQuantity += product.achieved_quantity;
        }
      });

      const inventory = await Inventory.findOne({
        work_order: dailyProduction.work_order,
        product: dailyProduct.product_id, // Use product_id from DailyProduction
      });
      if (inventory) {
        inventory.produced_quantity = totalAchievedQuantity;
        inventory.updated_by = dailyProduction.updated_by;
        await inventory.save();
      }

      // Clear the production interval
      const productionKey = `${job_order}_${objId}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return;
    }

    // If planned quantity not exceeded, proceed with incrementing achieved_quantity
    dailyProduction.products = dailyProduction.products.map((p) =>
      p.objId.equals(objId)
        ? { ...p.toObject(), achieved_quantity: newAchievedQuantity }
        : p
    );

    await dailyProduction.save();
    console.log(`Updated achieved_quantity for job_order: ${job_order}, objId: ${objId}`);

    // Update inventory with the total achieved_quantity
    const allDailyProductions = await DailyProduction.find({
      work_order: dailyProduction.work_order,
      'products.objId': objId, // Updated to use objId
    });

    let totalAchievedQuantity = 0;
    allDailyProductions.forEach((dp) => {
      const product = dp.products.find((p) => p.objId.equals(objId));
      if (product) {
        totalAchievedQuantity += product.achieved_quantity;
      }
    });

    const inventory = await Inventory.findOne({
      work_order: dailyProduction.work_order,
      product: dailyProduct.product_id, // Use product_id from DailyProduction
    });
    if (inventory) {
      inventory.produced_quantity = totalAchievedQuantity;
      inventory.updated_by = dailyProduction.updated_by;
      await inventory.save();
    }
  } catch (error) {
    console.error(`Error updating achieved_quantity: ${error.message}`);
  }
};

export const handleDailyProductionActions_18_08_2025 = async (req, res) => {
  try {
    const { action, job_order, objId, pause_description } = req.body;
    if (!mongoose.Types.ObjectId.isValid(objId)) {
      return res.status(400).json({ success: false, message: 'Invalid objId' });
    }

    if (!['start', 'stop', 'pause', 'resume'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "start", "stop", "pause", or "resume".',
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated.',
      });
    }

    if (!job_order || !objId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: job_order, objId.',
      });
    }

    const jobOrder = await JobOrder.findById(job_order).populate(
      'work_order',
      'work_order_number'
    );
    if (!jobOrder) {
      return res.status(404).json({
        success: false,
        message: 'Job order not found.',
      });
    }

    const jobOrderProduct = jobOrder.products.find((product) =>
      product._id.equals(objId)
    );
    if (!jobOrderProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product subdocument ID not found in job order.',
      });
    }

    const plannedQuantity = jobOrderProduct.planned_quantity;

    // Find the DailyProduction record for the specific job_order and objId
    let dailyProduction = await DailyProduction.findOne({
      job_order,
      'products.objId': objId,
    });

    if (action === 'start') {
      if (dailyProduction) {
        if (dailyProduction.started_at) {
          return res.status(400).json({
            success: false,
            message: 'Production already started for this job order and product.',
          });
        }

        const dailyProduct = dailyProduction.products.find((p) =>
          p.objId.equals(objId)
        );
        if (dailyProduct && dailyProduct.achieved_quantity >= plannedQuantity) {
          return res.status(400).json({
            success: false,
            message: 'Cannot start production: Planned quantity already reached.',
          });
        }

        // Update only the specific DailyProduction record
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

        // Update work order status based on production status
        try {
          await updateWorkOrderStatus(jobOrder.work_order);
        } catch (error) {
          console.error('Error updating work order status:', error);
        }

        // Update job order status based on production status
        try {
          await updateJobOrderStatus(job_order);
        } catch (error) {
          console.error('Error updating job order status:', error);
        }

        // Start production simulation only for the requested product
        const productionKey = `${job_order}_${objId}`;
        if (!activeProductions.has(productionKey)) {
          const intervalId = setInterval(
            () => simulateProductionCounts(job_order, objId),
            10000
          );
          activeProductions.set(productionKey, intervalId);
        }

        return res.status(200).json({
          success: true,
          message: 'Production started successfully for the specified product.',
          data: updatedProduction,
        });
      } else {
        // Create a new DailyProduction record for the specific product
        const schemaProducts = jobOrder.products
          .filter((product) => product._id.equals(objId))
          .map((product) => ({
            product_id: product.product,
            objId: product._id,
            achieved_quantity: 0,
            rejected_quantity: 0,
            recycled_quantity: 0,
          }));

        if (schemaProducts.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No matching product found to start production.',
          });
        }

        const newProduction = new DailyProduction({
          work_order: jobOrder.work_order._id,
          job_order,
          products: schemaProducts,
          date: jobOrderProduct.scheduled_date,
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

        // Start production simulation only for the requested product
        const productionKey = `${job_order}_${objId}`;
        if (!activeProductions.has(productionKey)) {
          const intervalId = setInterval(
            () => simulateProductionCounts(job_order, objId),
            10000
          );
          activeProductions.set(productionKey, intervalId);
        }

        return res.status(201).json({
          success: true,
          message: 'Production started successfully.',
          data: savedProduction,
        });
      }
    } else if (action === 'pause') {
      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: 'Daily production document not found for this job order and product.',
        });
      }

      if (!dailyProduction.started_at) {
        return res.status(400).json({
          success: false,
          message: 'Production has not started for this job order and product.',
        });
      }
      if (dailyProduction.stopped_at) {
        return res.status(400).json({
          success: false,
          message: 'Production already stopped for this job order and product.',
        });
      }
      if (dailyProduction.status === 'Paused') {
        return res.status(400).json({
          success: false,
          message: 'Production is already paused.',
        });
      }

      dailyProduction.status = 'Paused';
      dailyProduction.updated_by = req.user._id;
      dailyProduction.production_logs.push({
        action: 'Pause',
        timestamp: new Date(),
        user: req.user._id,
        description: pause_description || 'Production paused',
      });

      const updatedProduction = await dailyProduction.save();

      const productionKey = `${job_order}_${objId}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return res.status(200).json({
        success: true,
        message: 'Production paused successfully for the specified product.',
        data: updatedProduction,
      });
    } else if (action === 'resume') {
      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: 'Daily production document not found for this job order and product.',
        });
      }

      if (!dailyProduction.started_at) {
        return res.status(400).json({
          success: false,
          message: 'Production has not started for this job order and product.',
        });
      }
      if (dailyProduction.stopped_at) {
        return res.status(400).json({
          success: false,
          message: 'Production already stopped for this job order and product.',
        });
      }
      if (dailyProduction.status !== 'Paused') {
        return res.status(400).json({
          success: false,
          message: 'Production is not paused.',
        });
      }

      dailyProduction.status = 'In Progress';
      dailyProduction.updated_by = req.user._id;
      dailyProduction.production_logs.push({
        action: 'Resume',
        timestamp: new Date(),
        user: req.user._id,
        description: 'Production resumed',
      });

      const updatedProduction = await dailyProduction.save();

      const productionKey = `${job_order}_${objId}`;
      if (!activeProductions.has(productionKey)) {
        const intervalId = setInterval(
          () => simulateProductionCounts(job_order, objId),
          10000
        );
        activeProductions.set(productionKey, intervalId);
      }

      return res.status(200).json({
        success: true,
        message: 'Production resumed successfully for the specified product.',
        data: updatedProduction,
      });
    } else if (action === 'stop') {
      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: 'Daily production document not found for this job order and product.',
        });
      }

      if (!dailyProduction.started_at) {
        return res.status(400).json({
          success: false,
          message: 'Production has not started for this job order and product.',
        });
      }
      if (dailyProduction.stopped_at) {
        return res.status(400).json({
          success: false,
          message: 'Production already stopped for this job order and product.',
        });
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

      const updatedProduction = await dailyProduction.save();

      // Update inventory with the total achieved_quantity
      const allDailyProductions = await DailyProduction.find({
        work_order: dailyProduction.work_order,
        'products.objId': objId, // Updated to use objId
      });

      let totalAchievedQuantity = 0;
      allDailyProductions.forEach((dp) => {
        const product = dp.products.find((p) => p.objId.equals(objId));
        if (product) {
          totalAchievedQuantity += product.achieved_quantity;
        }
      });

      const inventory = await Inventory.findOne({
        work_order: dailyProduction.work_order,
        product: jobOrderProduct.product,
      });
      if (inventory) {
        inventory.produced_quantity = totalAchievedQuantity;
        inventory.updated_by = req.user._id;
        await inventory.save();
      }

      const productionKey = `${job_order}_${objId}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return res.status(200).json({
        success: true,
        message: 'Production stopped successfully for the specified product.',
        data: updatedProduction,
      });
    }
  } catch (error) {
    console.error('Error handling daily production action:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};











const simulateProductionCounts = async (job_order, product_id, prodId) => {
  try {
    // Find the specific DailyProduction document using prodId
    const dailyProduction = await DailyProduction.findOne({
      _id: prodId,
      job_order,
      'products.product_id': product_id,
    });

    if (!dailyProduction) {
      console.error(`DailyProduction not found for _id: ${prodId}, job_order: ${job_order}, product_id: ${product_id}`);
      return;
    }

    if (dailyProduction.status === 'Paused') {
      console.log(`Production is paused for _id: ${prodId}, job_order: ${job_order}, product_id: ${product_id}`);
      return;
    }

    if (dailyProduction.status === 'Pending QC') {
      console.log(`Production already stopped for _id: ${prodId}, job_order: ${job_order}, product_id: ${product_id}`);
      return;
    }

    // Find the JobOrder to get the planned_quantity
    const jobOrder = await JobOrder.findById(job_order);
    if (!jobOrder) {
      console.error(`JobOrder not found for job_order: ${job_order}`);
      return;
    }

    const jobOrderProduct = jobOrder.products.find((product) =>
      product.product.equals(product_id)
    );
    if (!jobOrderProduct) {
      console.error(`Product ${product_id} not found in JobOrder ${job_order}`);
      return;
    }

    const plannedQuantity = jobOrderProduct.planned_quantity;

    // Find the product in DailyProduction to get the current achieved_quantity
    const dailyProduct = dailyProduction.products.find((p) =>
      p.product_id.equals(product_id)
    );
    if (!dailyProduct) {
      console.error(`Product ${product_id} not found in DailyProduction ${dailyProduction._id}`);
      return;
    }

    const currentAchievedQuantity = dailyProduct.achieved_quantity;
    const newAchievedQuantity = currentAchievedQuantity + 1;

    // Check if the new achieved_quantity would exceed the planned_quantity
    if (newAchievedQuantity > plannedQuantity) {
      console.log(`Planned quantity reached for _id: ${prodId}, job_order: ${job_order}, product_id: ${product_id}. Stopping production.`);

      // Stop production
      dailyProduction.status = 'Pending QC';
      dailyProduction.stopped_at = new Date();
      dailyProduction.production_logs.push({
        action: 'Stop',
        timestamp: new Date(),
        user: dailyProduction.updated_by,
        description: 'Production stopped automatically: Planned quantity reached',
      });

      await dailyProduction.save();
      console.log(`Production stopped for _id: ${prodId}, job_order: ${job_order}, product_id: ${product_id}`);

      // Update inventory
      await updateInventory(dailyProduction.work_order, product_id, dailyProduction.updated_by);

      // Clear the production interval
      const productionKey = `${job_order}_${product_id}_${prodId}`;
      const intervalId = activeProductions.get(productionKey);
      if (intervalId) {
        clearInterval(intervalId);
        activeProductions.delete(productionKey);
      }

      return;
    }

    // Update achieved_quantity
    dailyProduction.products = dailyProduction.products.map((p) =>
      p.product_id.equals(product_id)
        ? { ...p.toObject(), achieved_quantity: newAchievedQuantity }
        : p
    );

    await dailyProduction.save();
    console.log(`Updated achieved_quantity for _id: ${prodId}, job_order: ${job_order}, product_id: ${product_id}`);

    // Update inventory
    await updateInventory(dailyProduction.work_order, product_id, dailyProduction.updated_by);
  } catch (error) {
    console.error(`Error updating achieved_quantity for _id: ${prodId}: ${error.message}`);
  }
};

// Helper function to update inventory
const updateInventory = async (work_order, product_id, updated_by) => {
  const allDailyProductions = await DailyProduction.find({
    work_order,
    'products.product_id': product_id,
  });

  let totalAchievedQuantity = 0;
  allDailyProductions.forEach((dp) => {
    const product = dp.products.find((p) => p.product_id.equals(product_id));
    if (product) {
      totalAchievedQuantity += product.achieved_quantity;
    }
  });

  const inventory = await Inventory.findOne({
    work_order,
    product: product_id,
  });
  if (inventory) {
    inventory.produced_quantity = totalAchievedQuantity;
    inventory.updated_by = updated_by;
    await inventory.save();
  }
};

export const handleDailyProductionActions = async (req, res) => {
  try {
    // const { action, job_order, product_id, pause_description } = req.body;

    const { action, job_order, product_id, prodId, pause_description } = req.body;
    // if (!['start', 'stop', 'pause', 'resume'].includes(action)) {


    if (!['start', 'stop', 'pause', 'resume'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "start", "stop", "pause", or "resume".',
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated.',
      });
    }

    if (!job_order || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: job_order, product_id.',
      });
    }

    const jobOrder = await JobOrder.findById(job_order).populate(
      'work_order',
      'work_order_number'
    );
    if (!jobOrder) {
      return res.status(404).json({
        success: false,
        message: 'Job order not found.',
      });
    }

    let dailyProduction;
    let plannedQuantity;

    if (action === 'start') {
      // For 'start', either use provided prodId or create a new DailyProduction
      if (prodId) {
        dailyProduction = await DailyProduction.findOne({
          _id: prodId,
          job_order,
          'products.product_id': product_id,
        });
        if (!dailyProduction) {
          return res.status(404).json({
            success: false,
            message: `Daily production not found for prodId: ${prodId}.`,
          });
        }

        if (dailyProduction.started_at) {
          return res.status(400).json({
            success: false,
            message: 'Production already started for this daily production.',
          });
        }

        // Find the correct job order product by matching date and product_id
        const dailyProductionDate = new Date(dailyProduction.date).toISOString();
        const jobOrderProduct = jobOrder.products.find((product) =>
          product.product.equals(product_id) &&
          new Date(product.scheduled_date).toISOString() === dailyProductionDate
        );
        
        if (!jobOrderProduct) {
          return res.status(400).json({
            success: false,
            message: 'Matching product not found in job order for this production date.',
          });
        }

        plannedQuantity = jobOrderProduct.planned_quantity;

        // Check achieved_quantity
        const dailyProduct = dailyProduction.products.find((p) =>
          p.product_id.equals(product_id)
        );
        if (dailyProduct && dailyProduct.achieved_quantity >= plannedQuantity) {
          return res.status(400).json({
            success: false,
            message: 'Cannot start production: Planned quantity already reached.',
          });
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

        // Update work order status based on production status
        try {
          await updateWorkOrderStatus(jobOrder.work_order);
        } catch (error) {
          console.error('Error updating work order status:', error);
        }

        // Update job order status based on production status
        try {
          await updateJobOrderStatus(job_order);
        } catch (error) {
          console.error('Error updating job order status:', error);
        }

        // Start production simulation
        const productionKey = `${job_order}_${product_id}_${prodId}`;
        if (!activeProductions.has(productionKey)) {
          const intervalId = setInterval(
            () => simulateProductionCounts(job_order, product_id, prodId),
            1000
          );
          activeProductions.set(productionKey, intervalId);
        }

        return res.status(200).json({
          success: true,
          message: 'Production started successfully.',
          data: updatedProduction,
        });
      } else {
        // Create a new DailyProduction
        const schemaProducts = jobOrder.products
          .filter((product) => product.product.equals(product_id))
          .map((product) => ({
            product_id: product.product,
            achieved_quantity: 0,
            rejected_quantity: 0,
            recycled_quantity: 0,
          }));

        if (schemaProducts.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No matching product found to start production.',
          });
        }

        const newProduction = new DailyProduction({
          work_order: jobOrder.work_order._id,
          job_order,
          products: schemaProducts,
          submitted_by: req.user._id,
          started_at: new Date(),
          created_by: req.user._id,
          updated_by: req.user._id,
          status: 'In Progress',
          date: new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
          )),
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

        // Start production simulation
        const productionKey = `${job_order}_${product_id}_${savedProduction._id}`;
        const intervalId = setInterval(
          () => simulateProductionCounts(job_order, product_id, savedProduction._id),
          10000
        );
        activeProductions.set(productionKey, intervalId);

        return res.status(201).json({
          success: true,
          message: 'Production started successfully.',
          data: savedProduction,
        });
      }
    } else {
      // For pause, resume, stop, prodId is required
      if (!prodId) {
        return res.status(400).json({
          success: false,
          message: 'prodId is required for pause, resume, or stop actions.',
        });
      }

      dailyProduction = await DailyProduction.findOne({
        _id: prodId,
        job_order,
        'products.product_id': product_id,
      });

      if (!dailyProduction) {
        return res.status(404).json({
          success: false,
          message: `Daily production not found for prodId: ${prodId}.`,
        });
      }

      // Find the correct job order product by matching date and product_id
      const dailyProductionDate = new Date(dailyProduction.date).toISOString();
      const jobOrderProduct = jobOrder.products.find((product) =>
        product.product.equals(product_id) &&
        new Date(product.scheduled_date).toISOString() === dailyProductionDate
      );
      
      if (!jobOrderProduct) {
        return res.status(400).json({
          success: false,
          message: 'Matching product not found in job order for this production date.',
        });
      }

      plannedQuantity = jobOrderProduct.planned_quantity;

      // Check achieved_quantity
      const dailyProduct = dailyProduction.products.find((p) =>
        p.product_id.equals(product_id)
      );
      if (dailyProduct && dailyProduct.achieved_quantity >= plannedQuantity && action !== 'stop') {
        return res.status(400).json({
          success: false,
          message: 'Cannot perform action: Planned quantity already reached.',
        });
      }

      if (action === 'pause') {
        if (!dailyProduction.started_at) {
          return res.status(400).json({
            success: false,
            message: 'Production has not started for this daily production.',
          });
        }
        if (dailyProduction.stopped_at) {
          return res.status(400).json({
            success: false,
            message: 'Production already stopped for this daily production.',
          });
        }
        if (dailyProduction.status === 'Paused') {
          return res.status(400).json({
            success: false,
            message: 'Production is already paused.',
          });
        }

        dailyProduction.status = 'Paused';
        dailyProduction.updated_by = req.user._id;
        dailyProduction.production_logs.push({
          action: 'Pause',
          timestamp: new Date(),
          user: req.user._id,
          description: pause_description || 'Production paused',
        });

        const updatedProduction = await dailyProduction.save();

        const productionKey = `${job_order}_${product_id}_${prodId}`;
        const intervalId = activeProductions.get(productionKey);
        if (intervalId) {
          clearInterval(intervalId);
          activeProductions.delete(productionKey);
        }

        return res.status(200).json({
          success: true,
          message: 'Production paused successfully.',
          data: updatedProduction,
        });
      } else if (action === 'resume') {
        if (!dailyProduction.started_at) {
          return res.status(400).json({
            success: false,
            message: 'Production has not started for this daily production.',
          });
        }
        if (dailyProduction.stopped_at) {
          return res.status(400).json({
            success: false,
            message: 'Production already stopped for this daily production.',
          });
        }
        if (dailyProduction.status !== 'Paused') {
          return res.status(400).json({
            success: false,
            message: 'Production is not paused.',
          });
        }

        dailyProduction.status = 'In Progress';
        dailyProduction.updated_by = req.user._id;
        dailyProduction.production_logs.push({
          action: 'Resume',
          timestamp: new Date(),
          user: req.user._id,
          description: 'Production resumed',
        });

        const updatedProduction = await dailyProduction.save();

        const productionKey = `${job_order}_${product_id}_${prodId}`;
        if (!activeProductions.has(productionKey)) {
          const intervalId = setInterval(
            () => simulateProductionCounts(job_order, product_id, prodId),
            10000
          );
          activeProductions.set(productionKey, intervalId);
        }

        return res.status(200).json({
          success: true,
          message: 'Production resumed successfully.',
          data: updatedProduction,
        });
      } else if (action === 'stop') {
        if (!dailyProduction.started_at) {
          return res.status(400).json({
            success: false,
            message: 'Production has not started for this daily production.',
          });
        }
        if (dailyProduction.stopped_at) {
          return res.status(400).json({
            success: false,
            message: 'Production already stopped for this daily production.',
          });
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

        const updatedProduction = await dailyProduction.save();

        // Update inventory
        await updateInventory(dailyProduction.work_order, product_id, req.user._id);

        const productionKey = `${job_order}_${product_id}_${prodId}`;
        const intervalId = activeProductions.get(productionKey);
        if (intervalId) {
          clearInterval(intervalId);
          activeProductions.delete(productionKey);
        }

        return res.status(200).json({
          success: true,
          message: 'Production stopped successfully.',
          data: updatedProduction,
        });
      }
    }
  } catch (error) {
    console.error('Error handling daily production action:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};












///USING BELLOW API BEFORE INVENTORY MANAGMENT - 
// export const handleDailyProductionAction = async (req, res) => {
//     try {
//         const { action, job_order, product_id } = req.body;

//         // Validate action
//         if (!['start', 'stop'].includes(action)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid action. Must be "start" or "stop".'
//             });
//         }

//         // Ensure req.user._id exists (from auth middleware)
//         if (!req.user || !req.user._id) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Unauthorized: User not authenticated.'
//             });
//         }

//         // Validate required fields
//         if (!job_order || !product_id) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing required fields: job_order, product_id.'
//             });
//         }

//         // Validate job_order exists
//         const jobOrder = await JobOrder.findById(job_order).populate('work_order', 'work_order_number');
//         if (!jobOrder) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Job order not found.'
//             });
//         }

//         // Validate product_id exists in job_order.products
//         const productExists = jobOrder.products.some(product => product.product.equals(product_id));
//         if (!productExists) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Product ID not found in job order.'
//             });
//         }

//         if (action === 'start') {
//             // Find existing DailyProduction for the job_order
//             let dailyProduction = await DailyProduction.findOne({ job_order });

//             if (dailyProduction) {
//                 // Check if the product already has started_at set
//                 const product = dailyProduction.products.find(p => p.product_id.equals(product_id));
//                 if (product && product.started_at) {
//                     return res.status(400).json({
//                         success: false,
//                         message: 'Production already started for this product.'
//                     });
//                 }

//                 // Update the specific product in the products array
//                 dailyProduction.products = dailyProduction.products.map(p =>
//                     p.product_id.equals(product_id)
//                         ? { ...p.toObject(), submitted_by: req.user._id, started_at: new Date() }
//                         : p
//                 );
//                 dailyProduction.updated_by = req.user._id;
//                 dailyProduction.status = 'In Progress';

//                 const updatedProduction = await dailyProduction.save();

//                 // Start fake API simulation (increment achieved_quantity every 5 seconds)
//                 const productionKey = `${job_order}_${product_id}`;
//                 if (!activeProductions.has(productionKey)) {
//                     const intervalId = setInterval(() => simulateProductionCount(job_order, product_id), 5000);
//                     activeProductions.set(productionKey, intervalId);
//                 }

//                 return res.status(200).json({
//                     success: true,
//                     message: 'Production started successfully for product.',
//                     data: updatedProduction
//                 });
//             } else {
//                 // Create new DailyProduction document
//                 const schemaProducts = jobOrder.products.map(product => ({
//                     product_id: product.product,
//                     achieved_quantity: 0,
//                     rejected_quantity: 0,
//                     recycled_quantity: 0,
//                     submitted_by: product.product.equals(product_id) ? req.user._id : undefined,
//                     started_at: product.product.equals(product_id) ? new Date() : undefined
//                 }));

//                 const newProduction = new DailyProduction({
//                     work_order: jobOrder.work_order._id,
//                     job_order,
//                     products: schemaProducts,
//                     created_by: req.user._id,
//                     updated_by: req.user._id,
//                     status: 'In Progress'
//                 });

//                 const savedProduction = await newProduction.save();

//                 // Start fake API simulation (increment achieved_quantity every 10 seconds)
//                 const productionKey = `${job_order}_${product_id}`;
//                 const intervalId = setInterval(() => simulateProductionCount(job_order, product_id), 10000);
//                 activeProductions.set(productionKey, intervalId);

//                 return res.status(201).json({
//                     success: true,
//                     message: 'Production started successfully.',
//                     data: savedProduction
//                 });
//             }
//         } else if (action === 'stop') {
//             // Find existing DailyProduction for the job_order
//             const dailyProduction = await DailyProduction.findOne({ job_order });
//             if (!dailyProduction) {
//                 return res.status(404).json({
//                     success: false,
//                     message: 'Daily production document not found for this job order.'
//                 });
//             }

//             // Check if the product exists and has started_at
//             const product = dailyProduction.products.find(p => p.product_id.equals(product_id));
//             if (!product) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Product ID not found in daily production.'
//                 });
//             }
//             if (!product.started_at) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Production has not started for this product.'
//                 });
//             }
//             if (product.stopped_at) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Production already stopped for this product.'
//                 });
//             }

//             // Update the specific product in the products array to add stopped_at
//             dailyProduction.products = dailyProduction.products.map(p =>
//                 p.product_id.equals(product_id)
//                     ? { ...p.toObject(), stopped_at: new Date() }
//                     : p
//             );
//             dailyProduction.updated_by = req.user._id;

//             // Update status to Pending QC if all products have stopped_at or were never started
//             const allStopped = dailyProduction.products.every(p => p.stopped_at || !p.started_at);
//             if (allStopped) {
//                 dailyProduction.status = 'Pending QC';
//             }

//             const updatedProduction = await dailyProduction.save();

//             // Stop fake API simulation
//             const productionKey = `${job_order}_${product_id}`;
//             const intervalId = activeProductions.get(productionKey);
//             if (intervalId) {
//                 clearInterval(intervalId);
//                 activeProductions.delete(productionKey);
//             }

//             return res.status(200).json({
//                 success: true,
//                 message: 'Production stopped successfully for product.',
//                 data: updatedProduction
//             });
//         }
//     } catch (error) {
//         console.error('Error handling daily production action:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal Server Error',
//             error: error.message
//         });
//     }
// };


export const addDowntime_20_08_2025 = async (req, res, next) => {
  try {
    const { job_order, product_id, description, minutes, remarks, downtime_start_time } = req.body;

    // Validate required fields
    if (!job_order || !product_id || !description || minutes === undefined) {
      return next(
        new ApiError(400, 'Missing required fields: job_order, product_id, description, minutes')
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
        // Assume the date is today for simplicity; adjust if needed
        const today = new Date();
        // Try parsing as "HH:mm" (e.g., "20:33") first
        parsedDowntimeStartTime = parse(
          downtime_start_time,
          'HH:mm',
          new Date(today.getFullYear(), today.getMonth(), today.getDate())
        );

        // If parsing fails, try the old format "h:mm a" (e.g., "10:30 AM") for backward compatibility
        if (isNaN(parsedDowntimeStartTime)) {
          parsedDowntimeStartTime = parse(
            downtime_start_time,
            'h:mm a',
            new Date(today.getFullYear(), today.getMonth(), today.getDate())
          );
        }

        // If both parsing attempts fail, return an error
        if (isNaN(parsedDowntimeStartTime)) {
          return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "20:33" or "10:30 AM"'));
        }
      } catch (error) {
        console.error('Error parsing downtime_start_time:', error);
        return next(new ApiError(400, 'Invalid downtime_start_time format'));
      }
    }

    // Find the DailyProduction document
    const dailyProduction = await DailyProduction.findOne({
      job_order: job_order,
      'products.product_id': product_id,
    });

    if (!dailyProduction) {
      return next(
        new ApiError(404, 'DailyProduction document not found for the specified job order and product')
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

// Simple monthly production counts for KK (counts of DPRs that have started)
export const getKKMonthlyProductionCounts = async (req, res) => {
    try {
        const { year } = req.query;
        const targetYear = Number(year) || new Date().getFullYear();

        const startOfYear = new Date(Date.UTC(targetYear, 0, 1));
        const endOfYear = new Date(Date.UTC(targetYear + 1, 0, 1));

        const result = await DailyProduction.aggregate([
            {
                $lookup: {
                    from: 'joborders',
                    localField: 'job_order',
                    foreignField: '_id',
                    as: 'job_order_data'
                }
            },
            {
                $unwind: '$job_order_data'
            },
            {
                $match: {
                    'job_order_data.date.from': { $gte: startOfYear, $lt: endOfYear }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$job_order_data.date.from" } },
                    count: { $sum: 1 }
                }
            },
            { $project: { _id: 0, month: "$_id.month", count: 1 } },
            { $sort: { month: 1 } }
        ]);

        // Normalize to 12 months
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        const map = new Map(result.map(r => [r.month, r.count]));
        const data = months.map(m => ({ month: m, count: map.get(m) || 0 }));

        return res.status(200).json({ success: true, year: targetYear, data });
    } catch (error) {
        console.error("KK monthly counts error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const addDowntime = async (req, res, next) => {
  try {
    const { prodId, job_order, product_id, description, minutes, remarks, downtime_start_time } = req.body;

    // Validate required fields
    if (!prodId || !job_order || !product_id || !description || minutes === undefined) {
      return next(
        new ApiError(400, 'Missing required fields: prodId, job_order, product_id, description, minutes')
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
        const today = new Date();
        parsedDowntimeStartTime = parse(
          downtime_start_time,
          'HH:mm',
          new Date(today.getFullYear(), today.getMonth(), today.getDate())
        );
        if (isNaN(parsedDowntimeStartTime)) {
          parsedDowntimeStartTime = parse(
            downtime_start_time,
            'h:mm a',
            new Date(today.getFullYear(), today.getMonth(), today.getDate())
          );
        }
        if (isNaN(parsedDowntimeStartTime)) {
          return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "20:33" or "10:30 AM"'));
        }
      } catch (error) {
        console.error('Error parsing downtime_start_time:', error);
        return next(new ApiError(400, 'Invalid downtime_start_time format'));
      }
    }

    // Find the DailyProduction document using prodId
    const dailyProduction = await DailyProduction.findOne({
      _id: prodId,
      job_order: job_order,
      'products.product_id': product_id,
    });

    if (!dailyProduction) {
      return next(
        new ApiError(404, 'DailyProduction document not found for the specified prodId, job order, and product')
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

export const updateDowntime_15_09_2025 = async (req, res, next) => {
  try {
    const { prodId, downtimeId } = req.params;
    const { description, minutes, remarks, downtime_start_time } = req.body;

    // Validate required params
    if (!prodId || !downtimeId) {
      return next(new ApiError(400, 'prodId and downtimeId are required'));
    }

    const minutesNumber = minutes !== undefined ? Number(minutes) : undefined;
    if (minutesNumber !== undefined && (isNaN(minutesNumber) || minutesNumber < 0)) {
      return next(new ApiError(400, 'Minutes must be a non-negative number'));
    }
    if (minutesNumber !== undefined) downtimeEntry.minutes = minutesNumber;

    // Validate minutes if provided
    if (minutes !== undefined && (isNaN(minutes) || minutes < 0)) {
      return next(new ApiError(400, 'Minutes must be a non-negative number'));
    }

    // Parse downtime_start_time if provided
    let parsedDowntimeStartTime;
    if (downtime_start_time) {
      const today = new Date();
      parsedDowntimeStartTime = parse(
        downtime_start_time,
        'HH:mm',
        new Date(today.getFullYear(), today.getMonth(), today.getDate())
      );
      if (isNaN(parsedDowntimeStartTime)) {
        parsedDowntimeStartTime = parse(
          downtime_start_time,
          'h:mm a',
          new Date(today.getFullYear(), today.getMonth(), today.getDate())
        );
      }
      if (isNaN(parsedDowntimeStartTime)) {
        return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "20:33" or "10:30 AM"'));
      }
    }

    // Find the DailyProduction document
    const dailyProduction = await DailyProduction.findById(prodId);
    if (!dailyProduction) {
      return next(new ApiError(404, 'DailyProduction document not found'));
    }

    // Find the downtime entry
    const downtimeEntry = dailyProduction.downtime.id(downtimeId);
    if (!downtimeEntry) {
      return next(new ApiError(404, 'Downtime entry not found'));
    }

    // Update fields if provided
    if (description !== undefined) downtimeEntry.description = description;
    if (minutes !== undefined) downtimeEntry.minutes = minutes;
    if (remarks !== undefined) downtimeEntry.remarks = remarks;
    if (downtime_start_time !== undefined) downtimeEntry.downtime_start_time = parsedDowntimeStartTime;

    // Update user and save
    dailyProduction.updated_by = req.user?._id || null;
    const updatedProduction = await dailyProduction.save();

    return res.status(200).json({
      success: true,
      message: 'Downtime updated successfully',
      data: updatedProduction,
    });
  } catch (error) {
    console.error('Error updating downtime:', error);
    next(new ApiError(500, 'Internal Server Error', error.message));
  }
};




export const updateDowntime = async (req, res, next) => {
  try {
    const { prodId, downtimeId } = req.params; // or req.query if using query params
    const { description, minutes, remarks, downtime_start_time } = req.body;

    // Validate required params
    if (!prodId || !downtimeId) {
      return next(new ApiError(400, 'prodId and downtimeId are required'));
    }

    // Validate minutes if provided
    const minutesNumber = minutes !== undefined ? Number(minutes) : undefined;
    if (minutesNumber !== undefined && (isNaN(minutesNumber) || minutesNumber < 0)) {
      return next(new ApiError(400, 'Minutes must be a non-negative number'));
    }

    // Parse downtime_start_time if provided
    let parsedDowntimeStartTime;
    if (downtime_start_time) {
      const today = new Date();
      parsedDowntimeStartTime = parse(
        downtime_start_time,
        'HH:mm',
        new Date(today.getFullYear(), today.getMonth(), today.getDate())
      );
      if (isNaN(parsedDowntimeStartTime)) {
        parsedDowntimeStartTime = parse(
          downtime_start_time,
          'h:mm a',
          new Date(today.getFullYear(), today.getMonth(), today.getDate())
        );
      }
      if (isNaN(parsedDowntimeStartTime)) {
        return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "20:33" or "10:30 AM"'));
      }
    }

    // Find the DailyProduction document
    const dailyProduction = await DailyProduction.findById(prodId);
    if (!dailyProduction) {
      return next(new ApiError(404, 'DailyProduction document not found'));
    }

    // Find the downtime entry
    const downtimeEntry = dailyProduction.downtime.id(downtimeId);
    if (!downtimeEntry) {
      return next(new ApiError(404, 'Downtime entry not found'));
    }

    // Update fields if provided
    if (description !== undefined) downtimeEntry.description = description;
    if (minutesNumber !== undefined) downtimeEntry.minutes = minutesNumber;
    if (remarks !== undefined) downtimeEntry.remarks = remarks;
    if (downtime_start_time !== undefined) downtimeEntry.downtime_start_time = parsedDowntimeStartTime;

    // Update user and save
    dailyProduction.updated_by = req.user?._id || null;
    const updatedProduction = await dailyProduction.save();

    return res.status(200).json({
      success: true,
      message: 'Downtime updated successfully',
      data: updatedProduction,
    });
  } catch (error) {
    console.error('Error updating downtime:', error);
    next(new ApiError(500, 'Internal Server Error', error.message));
  }
};








// import { parse } from 'date-fns';

export const addDowntime_26_08_2025 = async (req, res, next) => {
  try {
    const { prodId, job_order, product_id, description, minutes, remarks, downtime_start_time } = req.body;

    // Validate required fields
    if (!prodId || !job_order || !product_id || !description || minutes === undefined) {
      return next(
        new ApiError(400, 'Missing required fields: prodId, job_order, product_id, description, minutes')
      );
    }

    // Validate minutes is a non-negative number
    if (isNaN(minutes) || minutes < 0) {
      return next(new ApiError(400, 'Minutes must be a non-negative number'));
    }

    // Validate and parse downtime_start_time in UTC
    let parsedDowntimeStartTime;
    if (downtime_start_time) {
      try {
        const today = new Date(); // Current date in server's time zone
        // Parse time as HH:mm or h:mm a and set to UTC
        parsedDowntimeStartTime = parse(downtime_start_time, 'HH:mm', new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
        if (isNaN(parsedDowntimeStartTime.getTime())) {
          parsedDowntimeStartTime = parse(downtime_start_time, 'h:mm a', new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
        }
        if (isNaN(parsedDowntimeStartTime.getTime())) {
          return next(new ApiError(400, 'Invalid downtime_start_time format. Use e.g., "20:33" or "10:30 AM"'));
        }
        // Convert to UTC by setting hours, minutes, and keeping date
        parsedDowntimeStartTime.setUTCHours(parsedDowntimeStartTime.getHours());
        parsedDowntimeStartTime.setUTCMinutes(parsedDowntimeStartTime.getMinutes());
      } catch (error) {
        console.error('Error parsing downtime_start_time:', error);
        return next(new ApiError(400, 'Invalid downtime_start_time format'));
      }
    }

    // Find the DailyProduction document
    const dailyProduction = await DailyProduction.findOne({
      _id: prodId,
      job_order: job_order,
      'products.product_id': product_id,
    });

    if (!dailyProduction) {
      return next(
        new ApiError(404, 'DailyProduction document not found for the specified prodId, job order, and product')
      );
    }

    // Create new downtime entry
    const downtimeEntry = {
      downtime_start_time: parsedDowntimeStartTime || undefined,
      description,
      minutes: Number(minutes),
      remarks,
    };

    // Add downtime and update
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







export const getDowntimeByProduct_20_08_2025 = async (req, res, next) => {
  try {
    const { product_id, job_order } = req.query;

    // Validate product_id and job_order
    if (!product_id || !mongoose.isValidObjectId(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid product_id is required' });
    }
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // Fetch DailyProduction document for the product_id and job_order
    const dailyProduction = await DailyProduction.findOne({
      job_order: job_order,
      'products.product_id': product_id,
    }).lean();

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No downtime records found for the specified product and job order',
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

import { formatInTimeZone } from 'date-fns-tz';


export const getDowntimeByProduct_26_08_2025 = async (req, res, next) => {
  try {
    const { prodId, product_id, job_order } = req.query;

    // Validate required fields
    if (!prodId || !product_id || !mongoose.isValidObjectId(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid prodId and product_id are required' });
    }
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // Fetch DailyProduction document using prodId
    const dailyProduction = await DailyProduction.findOne({
      _id: prodId,
      job_order: job_order,
      'products.product_id': product_id,
    }).lean();

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No downtime records found for the specified prodId, product, and job order',
        data: [],
      });
    }
    dailyProduction.downtime.map((downtime) => console.log(downtime.downtime_start_time));

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
    });
  } catch (error) {
    console.error('Error fetching downtime records:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};



// const convertToIST = (date) => {
//   if (!date) return null;
//   return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
// };

const convertToIST = (date) => {
  if (!date) return null;
  const d = new Date(date);

  // Shift the UTC date back to IST without double converting
  const istOffset = 5.5 * 60; // IST offset in minutes
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  console.log("date", new Date(utc + istOffset * 60000).toLocaleString('en-IN'));
  return new Date(utc + istOffset * 60000).toLocaleString('en-IN');
};

export const getDowntimeByProduct = async (req, res, next) => {
  try {
    const { prodId, product_id, job_order } = req.query;

    // Validate required fields
    if (!prodId || !product_id || !mongoose.isValidObjectId(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid prodId and product_id are required' });
    }
    if (!job_order || !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // Fetch DailyProduction document using prodId
    const dailyProduction = await DailyProduction.findOne({
      _id: prodId,
      job_order: job_order,
      'products.product_id': product_id,
    }).lean();

    // If no DailyProduction document found
    if (!dailyProduction) {
      return res.status(200).json({
        success: true,
        message: 'No downtime records found for the specified prodId, product, and job order',
        data: [],
      });
    }

    // Prepare the response with only downtime entries
    const downtimeRecords =
      dailyProduction.downtime && dailyProduction.downtime.length > 0
        ? dailyProduction.downtime.map((downtime) => {
          const start_time_raw = downtime.downtime_start_time || null;
          console.log("start-time", start_time_raw);
          const end_time_raw =
            start_time_raw && downtime.minutes != null
              ? addMinutes(new Date(start_time_raw), downtime.minutes)
              : null;
          console.log("end-time", end_time_raw);


          // Format start_time and end_time to 12-hour format
          const formatDateTime = (date) => {
            if (!date) return null;
            const d = new Date(date);
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // Convert 0 to 12 for 12-hour format
            const formattedTime = `${hours}:${minutes} ${ampm}`;
            const formattedDate = d.toISOString().split('T')[0];
            return `${formattedDate} ${formattedTime}`;
          };


          return {
            start_time: formatDateTime(start_time_raw), // ✅ IST conversion convertToIST(
            end_time: formatDateTime(end_time_raw),     // ✅ IST conversion convertToIST(
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



export const getProductionLogByProduct1 = async (req, res) => {
  try {
    const { product_id, job_order } = req.query;

    // Validate product_id
    if (!product_id || !mongoose.isValidObjectId(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid product_id is required' });
    }

    // Validate job_order if provided
    if (job_order && !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // Build query
    const query = { 'products.product_id': product_id };
    if (job_order) {
      query.job_order = job_order;
    }

    // Fetch DailyProduction documents
    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'sales_order_number batch_number date',
      })
      .populate({
        path: 'work_order',
        select: 'work_order_number project_id',
        populate: {
          path: 'project_id',
          select: 'name',
        },
      })
      .lean();

    // If no DailyProduction documents found
    if (!dailyProductions.length) {
      return res.status(200).json({
        success: true,
        message: 'No production records found for the specified product' + (job_order ? ' and job order' : ''),
        data: {
          total_achieved_quantity: 0,
          production_logs: [],
        },
      });
    }

    // Extract production log information
    let total_achieved_quantity = 0;
    const production_logs = dailyProductions.map((dp) => {
      // Find the product in the products array
      const product = dp.products.find((p) => p.product_id.toString() === product_id);
      total_achieved_quantity += product.achieved_quantity || 0;

      return {
        product_id: product_id, // Add product_id to the log entry
        job_order: {
          _id: dp.job_order?._id,
          sales_order_number: dp.job_order?.sales_order_number || 'N/A',
          batch_number: dp.job_order?.batch_number || 'N/A',
          date: dp.job_order?.date || {},
        },
        work_order: {
          _id: dp.work_order?._id,
          work_order_number: dp.work_order?.work_order_number || 'N/A',
          project_name: dp.work_order?.project_id?.name || 'N/A',
        },
        production_date: dp.date,
        achieved_quantity: product.achieved_quantity || 0,
        created_at: dp.createdAt,
        updated_at: dp.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Production logs fetched successfully',
      data: {
        total_achieved_quantity,
        production_logs,
      },
    });
  } catch (error) {
    console.error('Error fetching production logs:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


//   export const getDowntimeByProduct = async (req, res, next) => {
//     try {
//       const { product_id, job_order } = req.query;

//       // Validate product_id and job_order
//       if (!product_id || !mongoose.isValidObjectId(product_id)) {
//         // return next(new ApiError(400, 'Valid product_id is required'));
//         return res.status(400).json({success:false,message:"Valid product_id is required"})

//       }
//       if (!job_order || !mongoose.isValidObjectId(job_order)) {
//         // return next(new ApiError(400, 'Valid job_order is required'));
//         return res.status(400).json({success:false,message:"Valid job_order is required"})
//       }

//       // Fetch DailyProduction document for the product_id and job_order
//       const dailyProduction = await DailyProduction.findOne({
//         job_order: job_order,
//         'products.product_id': product_id,
//       })
//         .populate({
//           path: 'job_order',
//           select: 'sales_order_number batch_number date',
//         })
//         .populate({
//           path: 'work_order',
//           select: 'work_order_number project_id',
//           populate: {
//             path: 'project_id',
//             select: 'name',
//           },
//         })
//         .lean();

//       // If no DailyProduction document found
//       if (!dailyProduction) {
//         return res.status(200).json({
//           success: true,
//           message: 'No downtime records found for the specified product and job order',
//           data: [],
//         });
//       }

//       // Extract downtime information
//       const downtimeRecords = dailyProduction.downtime && dailyProduction.downtime.length > 0
//         ? dailyProduction.downtime.map((downtime) => ({
//             product_id: dailyProduction.products[0].product_id, // Single product per DailyProduction
//             job_order: {
//               _id: dailyProduction.job_order?._id,
//               sales_order_number: dailyProduction.job_order?.sales_order_number || 'N/A',
//               batch_number: dailyProduction.job_order?.batch_number || 'N/A',
//               date: dailyProduction.job_order?.date || {},
//             },
//             work_order: {
//               _id: dailyProduction.work_order?._id,
//               work_order_number: dailyProduction.work_order?.work_order_number || 'N/A',
//               project_name: dailyProduction.work_order?.project_id?.name || 'N/A',
//             },
//             production_date: dailyProduction.date,
//             downtime: {
//               description: downtime.description,
//               minutes: downtime.minutes,
//               remarks: downtime.remarks,
//               _id: downtime._id,
//             },
//             created_at: dailyProduction.createdAt,
//             updated_at: dailyProduction.updatedAt,
//           }))
//         : [];

//       return res.status(200).json({
//         success: true,
//         message: 'Downtime records fetched successfully',
//         data: downtimeRecords,
//       });
//     } catch (error) {
//       console.error('Error fetching downtime records:', error);
//     //   next(new ApiError(500, 'Internal Server Error', error.message));
//       return res.status(500).json({success:false,message:"Internal Server Error"})

//     }
//   };





//WORKING ---------===============================>>>>>>>>>>>
export const getProductionLogByProduct2 = async (req, res) => {
  try {
    console.log("came here.......123");
    const { product_id, job_order } = req.query;

    if (!product_id || !mongoose.isValidObjectId(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid product_id is required' });
    }

    if (job_order && !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    const query = { 'products.product_id': product_id };
    if (job_order) {
      query.job_order = job_order;
    }

    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'sales_order_number batch_number date',
      })
      .populate({
        path: 'work_order',
        select: 'work_order_number project_id',
        populate: {
          path: 'project_id',
          select: 'name',
        },
      })
      .populate({
        path: 'production_logs.user',
        select: 'name email',
      })
      .lean();

    if (!dailyProductions.length) {
      return res.status(200).json({
        success: true,
        message: 'No production records found for the specified product' + (job_order ? ' and job order' : ''),
        data: {
          total_achieved_quantity: 0,
          production_logs: [],
        },
      });
    }

    let total_achieved_quantity = 0;
    const production_logs = dailyProductions.map((dp) => {
      const product = dp.products.find((p) => p.product_id.toString() === product_id);
      total_achieved_quantity += product.achieved_quantity || 0;

      const logEvents = dp.production_logs.map((log) => ({
        action: log.action,
        timestamp: log.timestamp,
        user: log.user ? { _id: log.user._id, name: log.user.name, email: log.user.email } : null,
        description: log.description || 'N/A',
      }));

      return {
        product_id: product_id,
        job_order: {
          _id: dp.job_order?._id,
          sales_order_number: dp.job_order?.sales_order_number || 'N/A',
          batch_number: dp.job_order?.batch_number || 'N/A',
          date: dp.job_order?.date || {},
        },
        work_order: {
          _id: dp.work_order?._id,
          work_order_number: dp.work_order?.work_order_number || 'N/A',
          project_name: dp.work_order?.project_id?.name || 'N/A',
        },
        production_date: dp.date,
        achieved_quantity: product.achieved_quantity || 0,
        created_at: dp.createdAt,
        updated_at: dp.updatedAt,
        production_log_events: logEvents,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Production logs fetched successfully',
      data: {
        total_achieved_quantity,
        production_logs,
      },
    });
  } catch (error) {
    console.error('Error fetching production logs:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getProductionLogByProduct = async (req, res) => {
  try {
    console.log("came here.......123");
    const { product_id, job_order, prodId } = req.query;

    // Validate input
    if (!product_id || !mongoose.isValidObjectId(product_id)) {
      return res.status(400).json({ success: false, message: 'Valid product_id is required' });
    }

    if (job_order && !mongoose.isValidObjectId(job_order)) {
      return res.status(400).json({ success: false, message: 'Valid job_order is required' });
    }

    // If prodId is provided, query directly by DailyProduction _id (most specific)
    const query = {};
    if (prodId && mongoose.isValidObjectId(prodId)) {
      query._id = prodId;
      query['products.product_id'] = product_id;
    } else {
      // Fallback to old behavior for backward compatibility
      query['products.product_id'] = product_id;
      if (job_order) {
        query.job_order = job_order;
      }
    }

    // Fetch daily production records
    const dailyProductions = await DailyProduction.find(query)
      .populate({
        path: 'job_order',
        select: 'sales_order_number batch_number date',
      })
      .populate({
        path: 'work_order',
        select: 'work_order_number project_id',
        populate: {
          path: 'project_id',
          select: 'name',
        },
      })
      .populate({
        path: 'products.product_id',
        select: 'description', // Assuming 'description' is the product name field
      })
      .populate({
        path: 'production_logs.user',
        select: 'name email',
      })
      .lean();

    if (!dailyProductions.length) {
      return res.status(200).json({
        success: true,
        message: 'No production records found for the specified product' + (job_order ? ' and job order' : ''),
        data: {
          total_achieved_quantity: 0,
          production_logs: [],
        },
      });
    }

    // Since we're filtering by job_order, there should be at most one DailyProduction record
    const dailyProduction = dailyProductions[0]; // Take the first record
    const product = dailyProduction.products.find((p) => p.product_id._id.toString() === product_id);
    const productName = product.product_id.description || 'Unknown Product'; // Get product name
    const totalAchievedQuantity = product.achieved_quantity || 0;

    // Check if production has started
    if (!dailyProduction.started_at) {
      return res.status(400).json({
        success: false,
        message: 'Production has not started for this job order.',
      });
    }

    const startedAt = new Date(dailyProduction.started_at);
    const currentTime = new Date(); // Current time (May 21, 2025, 12:14 PM IST)
    const stoppedAt = dailyProduction.stopped_at ? new Date(dailyProduction.stopped_at) : null;
    const endTime = stoppedAt && stoppedAt < currentTime ? stoppedAt : currentTime;

    // Calculate elapsed time since start (in milliseconds)
    const elapsedTimeMs = endTime - startedAt;
    const elapsedHours = elapsedTimeMs / (1000 * 60 * 60); // Convert to hours

    // If less than 1 hour has passed, return a message
    if (elapsedHours < 1) {
      const startTimeString = startedAt.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return res.status(200).json({
        success: true,
        message: `The production has started @ ${startTimeString}`,
        data: {
          total_achieved_quantity: totalAchievedQuantity,
          production_logs: [],
        },
      });
    }

    // Calculate production rate (items per hour)
    const productionRate = elapsedHours > 0 ? totalAchievedQuantity / elapsedHours : 0;

    // Generate hourly timestamps from started_at to endTime
    const hourlyLogs = [];
    let currentHour = new Date(startedAt);
    currentHour.setMinutes(0, 0, 0); // Align to the start of the hour
    currentHour.setHours(currentHour.getHours() + 1); // Move to the next hour

    while (currentHour <= endTime) {
      const hoursSinceStart = (currentHour - startedAt) / (1000 * 60 * 60); // Hours since production started
      const estimatedQuantity = Math.round(productionRate * hoursSinceStart); // Estimate quantity at this hour
      const cappedQuantity = Math.min(estimatedQuantity, totalAchievedQuantity); // Cap at total achieved quantity

      const timestampString = currentHour.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      hourlyLogs.push({
        timestamp: timestampString,
        product_name: productName,
        achieved_quantity: cappedQuantity,
      });

      currentHour.setHours(currentHour.getHours() + 1); // Move to the next hour
    }

    // Include the existing production logs (e.g., Start, Pause, Resume, Stop)
    const logEvents = dailyProduction.production_logs.map((log) => ({
      action: log.action,
      timestamp: log.timestamp,
      user: log.user ? { _id: log.user._id, name: log.user.name, email: log.user.email } : null,
      description: log.description || 'N/A',
    }));

    const productionLog = {
      product_id: product_id,
      job_order: {
        _id: dailyProduction.job_order?._id,
        sales_order_number: dailyProduction.job_order?.sales_order_number || 'N/A',
        batch_number: dailyProduction.job_order?.batch_number || 'N/A',
        date: dailyProduction.job_order?.date || {},
      },
      work_order: {
        _id: dailyProduction.work_order?._id,
        work_order_number: dailyProduction.work_order?.work_order_number || 'N/A',
        project_name: dailyProduction.work_order?.project_id?.name || 'N/A',
      },
      production_date: dailyProduction.date,
      achieved_quantity: totalAchievedQuantity,
      created_at: dailyProduction.createdAt,
      updated_at: dailyProduction.updatedAt,
      production_log_events: logEvents,
      hourly_production_logs: hourlyLogs,
    };

    return res.status(200).json({
      success: true,
      message: 'Production logs fetched successfully',
      data: {
        total_achieved_quantity: totalAchievedQuantity,
        product_id: product_id,
        // production_logs: [productionLog],
        production_logs: hourlyLogs,
      },
    });
  } catch (error) {
    console.error('Error fetching production logs:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


export const getUpdatedProductProduction1 = async (req, res) => {
  try {
    // Extract job_order and product_id from request body or query parameters
    const { job_order, product_id } = req.query;
    console.log("job_order", job_order, "product_id", product_id);

    // Validate required fields
    if (!job_order || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: job_order and product_id are required.',
      });
    }

    // Validate that job_order and product_id are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(job_order) || !mongoose.Types.ObjectId.isValid(product_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job_order or product_id format. Must be a valid ObjectId.',
      });
    }

    // Find the DailyProduction document for the given job_order and product_id
    const dailyProduction = await DailyProduction.findOne({
      job_order: job_order,
      'products.product_id': product_id,
    })
      .populate('work_order', 'work_order_number') // Populate work_order details  
      .populate('submitted_by', 'name email') // Populate user who submitted
      .populate('created_by', 'name email') // Populate user who created
      .populate('updated_by', 'name email') // Populate user who updated
      .populate('products.product_id', 'material_code description') // Populate product details
      .lean();

    // Check if DailyProduction document exists
    if (!dailyProduction) {
      return res.status(404).json({
        success: false,
        message: `No production data found for job_order: ${job_order} and product_id: ${product_id}.`,
      });
    }

    // Extract the specific product from the products array
    const productData = dailyProduction.products.find((p) =>
      p.product_id._id.equals(product_id)
    );

    if (!productData) {
      return res.status(404).json({
        success: false,
        message: `Product with product_id: ${product_id} not found in DailyProduction for job_order: ${job_order}.`,
      });
    }

    // Prepare the response data
    const responseData = {
      job_order: dailyProduction.job_order,
      work_order: dailyProduction.work_order,
      product: {
        product_id: productData.product_id._id,
        material_code: productData.product_id.material_code,
        description: productData.product_id.description,
        achieved_quantity: productData.achieved_quantity,
        rejected_quantity: productData.rejected_quantity,
        recycled_quantity: productData.recycled_quantity,
      },
      date: dailyProduction.date,
      status: dailyProduction.status,
      started_at: dailyProduction.started_at,
      stopped_at: dailyProduction.stopped_at,
      submitted_by: dailyProduction.submitted_by,
      created_by: dailyProduction.created_by,
      updated_by: dailyProduction.updated_by,
      createdAt: dailyProduction.createdAt,
      updatedAt: dailyProduction.updatedAt,
      production_logs: dailyProduction.production_logs,
      downtime: dailyProduction.downtime,
    };

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully.',
      data: responseData,
    });

  } catch (error) {
    console.error('Error fetching production logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

// ────────────────────────────────────────────────────────────────

export const getUpdatedProductProduction_20_08_2025 = async (req, res) => {
  try {
    const { job_order, product_id } = req.query;               // 1️⃣ validate IDs
    if (!job_order || !product_id) {
      return res.status(400).json({ success: false, message: 'Missing job_order or product_id' });
    }
    if (!mongoose.Types.ObjectId.isValid(job_order) || !mongoose.Types.ObjectId.isValid(product_id)) {
      return res.status(400).json({ success: false, message: 'Invalid ObjectId' });
    }

    // 2️⃣ Pull the one DailyProduction doc **with exactly the same populates**
    //    used inside getJobOrdersByDate
    const dp = await DailyProduction.findOne({
      job_order,
      'products.product_id': product_id,
    })
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products work_order',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              { path: 'project_id', select: 'name' },
              { path: 'client_id', select: 'name' },
            ],
          },
          {
            // machine name for every product inside JobOrder.products
            path: 'products.machine_name',
            select: 'name',
          },
        ],
      })
      .populate({
        // details for the **DailyProduction** products array
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: { path: 'plant', select: 'plant_name' },
      })
      .lean();

    if (!dp) {
      return res.status(404).json({
        success: false,
        message: `No production data for job_order:${job_order} & product_id:${product_id}`,
      });
    }

    // 3️⃣ Grab the first (and only) matching product in DailyProduction.products
    const dpProduct = dp.products.find(p => p.product_id._id.toString() === product_id);
    if (!dpProduct) {
      return res.status(404).json({ success: false, message: 'Product not found in DailyProduction' });
    }

    const jobOrder = dp.job_order;
    const workOrder = jobOrder?.work_order ?? null;

    // locate the **same product entry** inside JobOrder.products + WorkOrder.products
    const jobOrderProduct = jobOrder?.products?.find(p => p.product.toString() === product_id) || {};
    const workOrderProduct = workOrder?.products?.find(p => p.product_id.toString() === product_id) || {};

    // latest start/stop times (same logic you used before)
    let started_at = null, stopped_at = null;
    if (dp.production_logs?.length) {
      const startLog = dp.production_logs.filter(l => l.action === 'Start')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const stopLog = dp.production_logs.filter(l => l.action === 'Stop')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      started_at = startLog?.timestamp ?? null;
      stopped_at = stopLog?.timestamp ?? null;
    }

    // 4️⃣ Build the exact same object shape you already emit elsewhere
    const responseObj = {
      _id: jobOrder?._id || dp._id,
      work_order: {
        _id: workOrder?._id || null,
        work_order_number: workOrder?.work_order_number || 'N/A',
        project_name: workOrder?.project_id?.name || 'N/A',
        client_name: workOrder?.client_id?.name || 'N/A',
      },
      sales_order_number: jobOrder?.sales_order_number || 'N/A',
      batch_number: jobOrder?.batch_number || 'N/A',
      date: jobOrder?.date || { from: null, to: null },
      status: jobOrder?.status || dp.status,
      created_by: jobOrder?.created_by || dp.created_by,
      updated_by: jobOrder?.updated_by || dp.updated_by,
      createdAt: jobOrder?.createdAt || dp.createdAt,
      updatedAt: jobOrder?.updatedAt || dp.updatedAt,
      job_order: jobOrder?._id || dp._id,
      job_order_id: jobOrder?.job_order_id,
      product_id: dpProduct.product_id._id,
      plant_name: dpProduct.product_id.plant?.plant_name || 'N/A',
      machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
      material_code: dpProduct.product_id.material_code || 'N/A',
      description: dpProduct.product_id.description || 'N/A',
      po_quantity: workOrderProduct?.po_quantity || 0,
      planned_quantity: jobOrderProduct?.planned_quantity || 0,
      scheduled_date: jobOrderProduct?.scheduled_date || dp.date,
      achieved_quantity: dpProduct.achieved_quantity || 0,
      rejected_quantity: dpProduct.rejected_quantity || 0,
      recycled_quantity: dpProduct.recycled_quantity || 0,
      started_at,
      stopped_at,
      submitted_by: dp.submitted_by || null,
      daily_production: {
        _id: dp._id,
        status: dp.status,
        date: dp.date,
        qc_checked_by: dp.qc_checked_by,
        downtime: dp.downtime,
        created_by: dp.created_by,
        updated_by: dp.updated_by,
        createdAt: dp.createdAt,
        updatedAt: dp.updatedAt,
      },
      latestDate: dp.date,
    };

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully.',
      data: responseObj,
    });

  } catch (err) {
    console.error('Error fetching production logs:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};




export const getUpdatedProductProduction = async (req, res) => {
  try {
    const { prodId, job_order, product_id } = req.query;

    // Validate required fields
    if (!prodId || !job_order || !product_id) {
      return res.status(400).json({ success: false, message: 'Missing prodId, job_order, or product_id' });
    }
    if (!mongoose.Types.ObjectId.isValid(job_order) || !mongoose.Types.ObjectId.isValid(product_id)) {
      return res.status(400).json({ success: false, message: 'Invalid ObjectId' });
    }

    // Find the DailyProduction document using prodId
    const dp = await DailyProduction.findOne({
      _id: prodId,
      job_order,
      'products.product_id': product_id,
    })
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products work_order',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              { path: 'project_id', select: 'name' },
              { path: 'client_id', select: 'name' },
            ],
          },
          {
            path: 'products.machine_name',
            select: 'name',
          },
        ],
      })
      .populate({
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: { path: 'plant', select: 'plant_name' },
      })
      .lean();

    if (!dp) {
      return res.status(404).json({
        success: false,
        message: `No production data for prodId:${prodId}, job_order:${job_order}, & product_id:${product_id}`,
      });
    }

    // Grab the first (and only) matching product in DailyProduction.products
    const dpProduct = dp.products.find(p => p.product_id._id.toString() === product_id);
    if (!dpProduct) {
      return res.status(404).json({ success: false, message: 'Product not found in DailyProduction' });
    }

    const jobOrder = dp.job_order;
    const workOrder = jobOrder?.work_order ?? null;

    // Locate the same product entry inside JobOrder.products + WorkOrder.products
    const jobOrderProduct = jobOrder?.products?.find(p => p.product.toString() === product_id) || {};
    const workOrderProduct = workOrder?.products?.find(p => p.product_id.toString() === product_id) || {};

    // Latest start/stop times
    let started_at = null, stopped_at = null;
    if (dp.production_logs?.length) {
      const startLog = dp.production_logs.filter(l => l.action === 'Start')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const stopLog = dp.production_logs.filter(l => l.action === 'Stop')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      started_at = startLog?.timestamp ?? null;
      stopped_at = stopLog?.timestamp ?? null;
    }

    // Build the response object
    const responseObj = {
      _id: jobOrder?._id || dp._id,
      work_order: {
        _id: workOrder?._id || null,
        work_order_number: workOrder?.work_order_number || 'N/A',
        project_name: workOrder?.project_id?.name || 'N/A',
        client_name: workOrder?.client_id?.name || 'N/A',
      },
      sales_order_number: jobOrder?.sales_order_number || 'N/A',
      batch_number: jobOrder?.batch_number || 'N/A',
      date: jobOrder?.date || { from: null, to: null },
      status: jobOrder?.status || dp.status,
      created_by: jobOrder?.created_by || dp.created_by,
      updated_by: jobOrder?.updated_by || dp.updated_by,
      createdAt: jobOrder?.createdAt || dp.createdAt,
      updatedAt: jobOrder?.updatedAt || dp.updatedAt,
      job_order: jobOrder?._id || dp._id,
      job_order_id: jobOrder?.job_order_id,
      product_id: dpProduct.product_id._id,
      plant_name: dpProduct.product_id.plant?.plant_name || 'N/A',
      machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
      material_code: dpProduct.product_id.material_code || 'N/A',
      description: dpProduct.product_id.description || 'N/A',
      po_quantity: workOrderProduct?.po_quantity || 0,
      planned_quantity: jobOrderProduct?.planned_quantity || 0,
      scheduled_date: jobOrderProduct?.scheduled_date || dp.date,
      achieved_quantity: dpProduct.achieved_quantity || 0,
      rejected_quantity: dpProduct.rejected_quantity || 0,
      recycled_quantity: dpProduct.recycled_quantity || 0,
      started_at,
      stopped_at,
      submitted_by: dp.submitted_by || null,
      daily_production: {
        _id: dp._id,
        status: dp.status,
        date: dp.date,
        qc_checked_by: dp.qc_checked_by,
        downtime: dp.downtime,
        created_by: dp.created_by,
        updated_by: dp.updated_by,
        createdAt: dp.createdAt,
        updatedAt: dp.updatedAt,
      },
      latestDate: dp.date,
    };

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully.',
      data: responseObj,
    });
  } catch (err) {
    console.error('Error fetching production logs:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};





export const getUpdatedProductProduction_18_08_2025 = async (req, res) => {
  try {
    const { job_order, objId } = req.query; // product_id is now JobOrder.products._id (objId)

    // 1️⃣ Validate IDs
    if (!job_order || !product_id) {
      return res.status(400).json({ success: false, message: 'Missing job_order or product_id' });
    }
    if (!mongoose.Types.ObjectId.isValid(job_order) || !mongoose.Types.ObjectId.isValid(product_id)) {
      return res.status(400).json({ success: false, message: 'Invalid ObjectId' });
    }

    // 2️⃣ Fetch DailyProduction with updated query and populates
    const dp = await DailyProduction.findOne({
      job_order,
      'products.objId': product_id, // Query using objId instead of product_id
    })
      .populate({
        path: 'job_order',
        select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products work_order',
        populate: [
          {
            path: 'work_order',
            select: 'project_id work_order_number products client_id',
            populate: [
              { path: 'project_id', select: 'name' },
              { path: 'client_id', select: 'name' },
            ],
          },
          {
            path: 'products.machine_name',
            select: 'name',
          },
          {
            path: 'products.product', // Populate product details from JobOrder.products
            select: 'material_code description plant',
            populate: { path: 'plant', select: 'plant_name' },
          },
        ],
      })
      .populate({
        path: 'products.product_id',
        select: 'material_code description plant',
        populate: { path: 'plant', select: 'plant_name' },
      })
      .lean();

    if (!dp) {
      return res.status(404).json({
        success: false,
        message: `No production data for job_order:${job_order} & objId:${product_id}`,
      });
    }

    // 3️⃣ Find the matching product in DailyProduction.products
    const dpProduct = dp.products.find((p) => p.objId.toString() === product_id);
    if (!dpProduct) {
      return res.status(404).json({ success: false, message: 'Product not found in DailyProduction' });
    }

    const jobOrder = dp.job_order;
    const workOrder = jobOrder?.work_order ?? null;

    // Locate the same product entry in JobOrder.products and WorkOrder.products
    const jobOrderProduct = jobOrder?.products?.find((p) => p._id.toString() === product_id) || {};
    const workOrderProduct = workOrder?.products?.find((p) => p.product_id.toString() === dpProduct.product_id.toString()) || {};

    // Latest start/stop times
    let started_at = null,
      stopped_at = null;
    if (dp.production_logs?.length) {
      const startLog = dp.production_logs
        .filter((l) => l.action === 'Start')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const stopLog = dp.production_logs
        .filter((l) => l.action === 'Stop')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      started_at = startLog?.timestamp ?? null;
      stopped_at = stopLog?.timestamp ?? null;
    }

    // 4️⃣ Build the response object matching getJobOrdersByDate
    const responseObj = {
      _id: jobOrder?._id || dp._id,
      work_order: {
        _id: workOrder?._id || null,
        work_order_number: workOrder?.work_order_number || 'N/A',
        project_name: workOrder?.project_id?.name || 'N/A',
        client_name: workOrder?.client_id?.name || 'N/A',
      },
      sales_order_number: jobOrder?.sales_order_number || 'N/A',
      batch_number: jobOrder?.batch_number || 'N/A',
      date: jobOrder?.date || { from: null, to: null },
      status: jobOrder?.status || dp.status,
      created_by: jobOrder?.created_by || dp.created_by,
      updated_by: jobOrder?.updated_by || dp.updated_by,
      createdAt: jobOrder?.createdAt || dp.createdAt,
      updatedAt: jobOrder?.updatedAt || dp.updatedAt,
      job_order: jobOrder?._id || dp._id,
      job_order_id: jobOrder?.job_order_id,
      product_id: dpProduct.objId, // Use JobOrder.products._id (objId)
      plant_name: dpProduct.product_id?.plant?.plant_name || jobOrderProduct?.product?.plant?.plant_name || 'N/A',
      machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
      material_code: dpProduct.product_id?.material_code || jobOrderProduct?.product?.material_code || 'N/A',
      description: dpProduct.product_id?.description || jobOrderProduct?.product?.description || 'N/A',
      po_quantity: workOrderProduct?.po_quantity || 0,
      planned_quantity: jobOrderProduct?.planned_quantity || 0,
      scheduled_date: jobOrderProduct?.scheduled_date || dp.date,
      achieved_quantity: dpProduct.achieved_quantity || 0,
      rejected_quantity: dpProduct.rejected_quantity || 0,
      recycled_quantity: dpProduct.recycled_quantity || 0,
      started_at,
      stopped_at,
      submitted_by: dp.submitted_by || null,
      daily_production: {
        _id: dp._id,
        status: dp.status,
        date: dp.date,
        qc_checked_by: dp.qc_checked_by,
        downtime: dp.downtime,
        created_by: dp.created_by,
        updated_by: dp.updated_by,
        createdAt: dp.createdAt,
        updatedAt: dp.updatedAt,
      },
      latestDate: dp.date,
    };

    return res.status(200).json({
      success: true,
      message: 'Production data fetched successfully.',
      data: responseObj,
    });
  } catch (err) {
    console.error('Error fetching production logs:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};




////////////////////////////NEED TO USE BELLOW API TO SHOW ALL THE PRODUCTION DOCUMENTS IN PRODUCTION TAB, BECAUSE CURRENT API WHICH IS ABOVE IS NOT SHOWING ALL THE PRODUCTION DOCUMENT ----------===========>
//09-07-2025



// export const getJobOrdersByDate = async (req, res) => {
//   try {
//     const today = new Date();
//     const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
//     const tomorrowUTC = new Date(todayUTC);
//     tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

//     const { date } = req.query;
//     let query = {};

//     if (date) {
//       const inputDate = new Date(date);
//       if (isNaN(inputDate.getTime())) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid date format. Use YYYY-MM-DD (e.g., "2025-05-06")',
//         });
//       }
//       const normalizedDate = new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
//       query.date = {
//         $gte: normalizedDate,
//         $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000),
//       };
//     }

//     const dailyProductions = await DailyProduction.find(query)
//       .populate({
//         path: 'job_order',
//         select: 'job_order_id sales_order_number batch_number date status created_by updated_by createdAt updatedAt products',
//         populate: [
//           {
//             path: 'work_order',
//             select: 'project_id work_order_number products client_id',
//             populate: [
//               { path: 'project_id', select: 'name' },
//               { path: 'client_id', select: 'name' },
//             ],
//           },
//           {
//             path: 'products.machine_name',
//             select: 'name',
//           },
//         ],
//       })
//       .populate({
//         path: 'products.product_id',
//         select: 'material_code description plant',
//         populate: { path: 'plant', select: 'plant_name' },
//       })
//       .lean();

//     const categorizedOrders = {
//       pastDPR: [],
//       todayDPR: [],
//       futureDPR: [],
//     };

//     dailyProductions.forEach((dailyProduction) => {
//       const jobOrder = dailyProduction.job_order;
//       const dpProduct = dailyProduction.products[0];
//       if (!dpProduct) return;

//       const productId = dpProduct.product_id._id.toString();
//       const jobOrderProduct = jobOrder?.products?.find(
//         (prod) => prod.product.toString() === productId
//       );
//       const workOrderProduct = jobOrder?.work_order?.products?.find(
//         (prod) => prod.product_id.toString() === productId
//       );

//       let started_at = null;
//       let stopped_at = null;

//       if (dailyProduction.production_logs?.length > 0) {
//         const startLog = dailyProduction.production_logs
//           .filter((log) => log.action === 'Start')
//           .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
//         const stopLog = dailyProduction.production_logs
//           .filter((log) => log.action === 'Stop')
//           .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

//         started_at = startLog?.timestamp || null;
//         stopped_at = stopLog?.timestamp || null;
//       }

//       const entry = {
//         _id: jobOrder?._id || dailyProduction._id,
//         work_order: {
//           _id: jobOrder?.work_order?._id || null,
//           work_order_number: jobOrder?.work_order?.work_order_number || 'N/A',
//           project_name: jobOrder?.work_order?.project_id?.name || 'N/A',
//           client_name: jobOrder?.work_order?.client_id?.name || 'N/A',
//         },
//         sales_order_number: jobOrder?.sales_order_number || 'N/A',
//         batch_number: jobOrder?.batch_number || 'N/A',
//         date: jobOrder?.date || { from: null, to: null },
//         status: jobOrder?.status || dailyProduction.status,
//         created_by: jobOrder?.created_by || dailyProduction.created_by,
//         updated_by: jobOrder?.updated_by || dailyProduction.updated_by,
//         createdAt: jobOrder?.createdAt || dailyProduction.createdAt,
//         updatedAt: jobOrder?.updatedAt || dailyProduction.updatedAt,
//         job_order: jobOrder?._id || dailyProduction._id,
//         job_order_id: jobOrder?.job_order_id,
//         product_id: dpProduct.product_id._id,
//         plant_name: dpProduct.product_id?.plant?.plant_name || 'N/A',
//         machine_name: jobOrderProduct?.machine_name?.name || 'N/A',
//         material_code: dpProduct.product_id?.material_code || 'N/A',
//         description: dpProduct.product_id?.description || 'N/A',
//         po_quantity: workOrderProduct?.po_quantity || 0,
//         planned_quantity: jobOrderProduct?.planned_quantity || 0,
//         scheduled_date: jobOrderProduct?.scheduled_date || dailyProduction.date,
//         achieved_quantity: dpProduct.achieved_quantity || 0,
//         rejected_quantity: dpProduct.rejected_quantity || 0,
//         recycled_quantity: dpProduct.recycled_quantity || 0,
//         started_at,
//         stopped_at,
//         submitted_by: dpProduct.submitted_by || null,
//         daily_production: {
//           _id: dailyProduction._id,
//           status: dailyProduction.status,
//           date: dailyProduction.date,
//           qc_checked_by: dailyProduction.qc_checked_by,
//           downtime: dailyProduction.downtime,
//           created_by: dailyProduction.created_by,
//           updated_by: dailyProduction.updated_by,
//           createdAt: dailyProduction.createdAt,
//           updatedAt: dailyProduction.updatedAt,
//         },
//         latestDate: dailyProduction.date,
//       };

//       const dpDate = new Date(Date.UTC(
//         new Date(entry.latestDate).getUTCFullYear(),
//         new Date(entry.latestDate).getUTCMonth(),
//         new Date(entry.latestDate).getUTCDate()
//       ));

//       if (date) {
//         categorizedOrders.todayDPR.push(entry);
//       } else {
//         if (dpDate.getTime() === todayUTC.getTime()) {
//           categorizedOrders.todayDPR.push(entry);
//         } else if (dpDate < todayUTC) {
//           categorizedOrders.pastDPR.push(entry);
//         } else if (dpDate >= tomorrowUTC) {
//           categorizedOrders.futureDPR.push(entry);
//         }
//       }
//     });

//     return res.status(200).json({
//       success: true,
//       message: 'Production data fetched successfully',
//       data: categorizedOrders,
//     });
//   } catch (error) {
//     console.error('Error getting production data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// };