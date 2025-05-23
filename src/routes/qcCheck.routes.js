import {Router} from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

import { addQcCheck ,getQcCheckDetails,getQcCheckById,updateQcCheck,deleteQcCheck,getProductByJobOrder} from '../controllers/konkreteKlinkers/qcCheckController.js';
router.use(verifyJWT);

router.route('/qc-check').post(addQcCheck).get(getQcCheckDetails);
router.route('/qc-check/delete').delete(deleteQcCheck);
router.route('/qc-check/products').get(getProductByJobOrder);
router.route('/qc-check/:id').get(getQcCheckById).put(updateQcCheck);


export default router;