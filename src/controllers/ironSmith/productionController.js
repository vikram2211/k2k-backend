import { ironDailyProduction } from "../../models/ironSmith/dailyProductionPlanning.js";
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';


const getProductionData = asyncHandler(async (req, res) => {
    // Get current date (start of day in IST)
    const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    console.log("today",today);
    const [todayDate] = today.split(','); // Extract date part (e.g., "7/29/2025")
    const [month, day, year] = todayDate.split('/');
    const currentDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`).toISOString();
  
    ///// Fetch all production records /////
    const productions = await ironDailyProduction
      .find()
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
  
    // Categorize production records
    const categorizedProductions = {
      pastDPR: [],
      todayDPR: [],
      futureDPR: [],
    };
  
    productions.forEach((production) => {
      const productionDate = new Date(production.date).toISOString().split('T')[0]; // Normalize to date only
  
      if (productionDate < currentDate) {
        categorizedProductions.pastDPR.push(production);
      } else if (productionDate === currentDate) {
        categorizedProductions.todayDPR.push(production);
      } else {
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

  export {getProductionData};