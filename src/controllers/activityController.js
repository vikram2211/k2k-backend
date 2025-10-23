import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

// Helper function to format activity data
const formatActivity = (item, type, company, action = 'created') => {
  const baseActivity = {
    id: item._id,
    type,
    company,
    action,
    timestamp: item.updatedAt || item.createdAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  // Determine the actual action based on status and type
  const getAction = (item, type) => {
    const status = item.status?.toLowerCase();
    
    switch (type) {
      case 'workOrder':
        if (status === 'completed' || status === 'finished') return 'completed';
        if (status === 'in_progress' || status === 'active') return 'started';
        return 'created';
      
      case 'jobOrder':
        if (status === 'completed' || status === 'finished') return 'completed';
        if (status === 'in_progress' || status === 'active') return 'started';
        return 'created';
      
      case 'production':
        if (status === 'completed' || status === 'finished') return 'completed';
        if (status === 'in_progress' || status === 'started' || status === 'active') return 'started';
        return 'created';
      
      case 'qc':
        if (status === 'passed' || status === 'approved') return 'passed';
        if (status === 'failed' || status === 'rejected') return 'failed';
        if (status === 'completed') return 'completed';
        return 'created';
      
      case 'packing':
        if (status === 'completed' || status === 'packed') return 'completed';
        if (status === 'in_progress' || status === 'packing') return 'started';
        return 'created';
      
      case 'dispatch':
        if (status === 'shipped' || status === 'delivered') return 'shipped';
        if (status === 'in_transit' || status === 'dispatched') return 'dispatched';
        return 'created';
      
      default:
        return action;
    }
  };

  const actualAction = getAction(item, type);

  switch (type) {
    case 'workOrder':
      return {
        ...baseActivity,
        action: actualAction,
        title: `Work Order ${actualAction}`,
        description: actualAction === 'completed' 
          ? `Work order completed for ${item.client_name || 'client'}`
          : actualAction === 'started'
          ? `Work order started for ${item.client_name || 'client'}`
          : `Work order created for ${item.client_name || 'client'}`,
        reference: item.work_order_number || item.wo_number,
        status: item.status || 'active'
      };
    
    case 'jobOrder':
      return {
        ...baseActivity,
        action: actualAction,
        title: `Job Order ${actualAction}`,
        description: actualAction === 'completed'
          ? `Job order completed for production`
          : actualAction === 'started'
          ? `Job order started for production`
          : `Job order created for production`,
        reference: item.job_order_id || item._id?.toString().slice(-8),
        status: item.status || 'active'
      };
    
    case 'production':
      return {
        ...baseActivity,
        action: actualAction,
        title: `Production batch #${item.semifinished_id} ${actualAction}`,
        description: actualAction === 'completed'
          ? `Production batch completed with ${item.quantity || item.produced_quantity || 0} units`
          : actualAction === 'started'
          ? `Production batch started with target of ${item.quantity || item.target_quantity || 0} units`
          : `Production batch created with ${item.quantity || 0} units`,
        reference: item.semifinished_id || item._id?.toString().slice(-8),
        status: item.status || 'active',
        quantity: item.quantity || item.produced_quantity || item.target_quantity || 0
      };
    
    case 'qc':
      return {
        ...baseActivity,
        action: actualAction,
        title: `Quality Check ${actualAction}`,
        description: actualAction === 'passed'
          ? `Quality check passed for ${item.product_name || 'product'} with ${item.pass_rate || 100}% pass rate`
          : actualAction === 'failed'
          ? `Quality check failed for ${item.product_name || 'product'}`
          : `Quality check ${actualAction} for ${item.product_name || 'product'}`,
        reference: item.qc_number || item.qc_id || item._id?.toString().slice(-8),
        status: item.status || 'pending',
        passRate: item.pass_rate || (actualAction === 'passed' ? 100 : 0)
      };
    
    case 'packing':
      return {
        ...baseActivity,
        action: actualAction,
        title: `Packing order ${actualAction}`,
        description: actualAction === 'completed'
          ? `Packing order completed for ${item.product_name || 'product'} - ${item.quantity || 0} units packed`
          : actualAction === 'started'
          ? `Packing order started for ${item.product_name || 'product'} - ${item.quantity || 0} units`
          : `Packing order created for ${item.product_name || 'product'}`,
        reference: item.packing_number || item.packing_id || item._id?.toString().slice(-8),
        status: item.status || 'pending',
        quantity: item.quantity || 0
      };
    
    case 'dispatch':
      return {
        ...baseActivity,
        action: actualAction,
        title: `Dispatch order ${actualAction}`,
        description: actualAction === 'shipped'
          ? `Order shipped to ${item.customer_name || 'customer'} with tracking ${item.tracking_number || 'N/A'}`
          : actualAction === 'dispatched'
          ? `Order dispatched to ${item.customer_name || 'customer'}`
          : `Dispatch order created for ${item.customer_name || 'customer'}`,
        reference: item.dispatch_number || item.dispatch_id || item._id?.toString().slice(-8),
        status: item.status || 'pending',
        trackingNumber: item.tracking_number
      };
    
    default:
      return baseActivity;
  }
};

// Get recent activities for a specific company
const getRecentActivities = asyncHandler(async (req, res) => {
  const { company } = req.params;
  const limit = parseInt(req.query.limit) || 6; // Default to 6 activities

  let activities = [];

  try {
    // Get the appropriate collections based on company
    const db = mongoose.connection.db;
    
    switch (company) {
      case 'falconFacade':
        activities = await getFalconFacadeActivities(db, limit);
        break;
      case 'ironSmith':
        activities = await getIronSmithActivities(db, limit);
        break;
      case 'konkreteKlinkers':
        activities = await getKonkreteKlinkersActivities(db, limit);
        break;
      default:
        throw new ApiError(400, 'Invalid company specified');
    }

    // Sort by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      data: activities.slice(0, limit),
      count: activities.length
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    throw new ApiError(500, `Failed to fetch activities: ${error.message}`);
  }
});

// Falcon Facade activities
const getFalconFacadeActivities = async (db, limit) => {
  const activities = [];

  try {
    // Work Orders
    const workOrders = await db.collection('falconworkorders').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    workOrders.forEach(wo => {
      activities.push(formatActivity(wo, 'workOrder', 'falconFacade', 'created'));
    });

    // Job Orders
    const jobOrders = await db.collection('falconjoborders').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    jobOrders.forEach(jo => {
      activities.push(formatActivity(jo, 'jobOrder', 'falconFacade', 'created'));
    });

    // Production
    const productions = await db.collection('falconproductions').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    productions.forEach(prod => {
      activities.push(formatActivity(prod, 'production', 'falconFacade', 'created'));
    });

    // QC Checks
    const qcChecks = await db.collection('falconqcchecks').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    qcChecks.forEach(qc => {
      activities.push(formatActivity(qc, 'qc', 'falconFacade', 'created'));
    });

    // Packing
    const packings = await db.collection('falconpackings').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    packings.forEach(packing => {
      activities.push(formatActivity(packing, 'packing', 'falconFacade', 'created'));
    });

    // Dispatch
    const dispatches = await db.collection('falcondispatches').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    dispatches.forEach(dispatch => {
      activities.push(formatActivity(dispatch, 'dispatch', 'falconFacade', 'created'));
    });

  } catch (error) {
    console.error('Error fetching Falcon Facade activities:', error);
  }

  return activities;
};

// Iron Smith activities
const getIronSmithActivities = async (db, limit) => {
  const activities = [];

  try {
    // Work Orders
    const workOrders = await db.collection('ironworkorders').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    workOrders.forEach(wo => {
      activities.push(formatActivity(wo, 'workOrder', 'ironSmith', 'created'));
    });

    // Job Orders
    const jobOrders = await db.collection('ironjoborders').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    jobOrders.forEach(jo => {
      activities.push(formatActivity(jo, 'jobOrder', 'ironSmith', 'created'));
    });

    // Production (using products collection)
    const productions = await db.collection('products').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    productions.forEach(prod => {
      activities.push(formatActivity(prod, 'production', 'ironSmith', 'created'));
    });

    // QC Checks
    const qcChecks = await db.collection('ironqcchecks').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    qcChecks.forEach(qc => {
      activities.push(formatActivity(qc, 'qc', 'ironSmith', 'created'));
    });

    // Packing
    const packings = await db.collection('ironpackings').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    packings.forEach(packing => {
      activities.push(formatActivity(packing, 'packing', 'ironSmith', 'created'));
    });

    // Dispatch
    const dispatches = await db.collection('irondispatches').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    dispatches.forEach(dispatch => {
      activities.push(formatActivity(dispatch, 'dispatch', 'ironSmith', 'created'));
    });

  } catch (error) {
    console.error('Error fetching Iron Smith activities:', error);
  }

  return activities;
};

// Konkrete Klinkers activities
const getKonkreteKlinkersActivities = async (db, limit) => {
  const activities = [];

  try {
    // Work Orders
    const workOrders = await db.collection('workorders').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    workOrders.forEach(wo => {
      activities.push(formatActivity(wo, 'workOrder', 'konkreteKlinkers', 'created'));
    });

    // Job Orders
    const jobOrders = await db.collection('joborders').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    jobOrders.forEach(jo => {
      activities.push(formatActivity(jo, 'jobOrder', 'konkreteKlinkers', 'created'));
    });

    // Production (using products collection)
    const productions = await db.collection('products').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    productions.forEach(prod => {
      activities.push(formatActivity(prod, 'production', 'konkreteKlinkers', 'created'));
    });

    // QC Checks
    const qcChecks = await db.collection('qcchecks').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    qcChecks.forEach(qc => {
      activities.push(formatActivity(qc, 'qc', 'konkreteKlinkers', 'created'));
    });

    // Packing
    const packings = await db.collection('packings').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    packings.forEach(packing => {
      activities.push(formatActivity(packing, 'packing', 'konkreteKlinkers', 'created'));
    });

    // Dispatch
    const dispatches = await db.collection('dispatches').find({}).sort({ updatedAt: -1 }).limit(2).toArray();
    dispatches.forEach(dispatch => {
      activities.push(formatActivity(dispatch, 'dispatch', 'konkreteKlinkers', 'created'));
    });

  } catch (error) {
    console.error('Error fetching Konkrete Klinkers activities:', error);
  }

  return activities;
};


export { getRecentActivities };
