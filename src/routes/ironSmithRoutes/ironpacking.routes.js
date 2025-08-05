import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

import {
    createPackingBundle,generatePackingQRCode,getAllPackingDetails, getPackingDetailsById, updatePackingDetails, getShapesByWorkOrderId} from '../../controllers/ironSmith/packingController.js';
// import {
//     getWorkOrderProductByJobOrder} from '../../controllers/ironSmith/ironDropdownApis/dropdownApis.js';

const router = Router();
router.use(verifyJWT);

router.route('/packing/get').get( getAllPackingDetails);
router.route('/packing-bundle/create').post( createPackingBundle);
router.route('/packing/create').post( generatePackingQRCode);
router.route('/packing/getbyid').get( getPackingDetailsById);
router.route('/packing/getshapes').get( getShapesByWorkOrderId);
router.route('/packing/update/:packingId').put( updatePackingDetails);


export default router;
