import { Router } from 'express';
import userRouter from './user.routes.js';
import employeeRouter from './emplyee.routes.js';
import clientRouter from './client.routes.js';
import plantRouter from './plant.routes.js';
import machineRouter from './machine.routes.js';
import projectRouter from './project.routes.js';
import productRouter from './product.routes.js';
import woRouter from './workorder.routes.js';
import joRouter from './joborder.routes.js';
import productionRouter from './production.routes.js';
import qcRouter from './qcCheck.routes.js';
import packingRouter from './packing.routes.js';
import dropdownRouter from './dropdown.routes.js';
import dispatchRouter from './dispatch.routes.js';
import tranferRouter from './tranfer.routes.js';
import inventoryRouter from './inventory.routes.js';

const router = Router();

// Register routes
router.use('/users', userRouter);
router.use('/users', employeeRouter);
router.use('/dropdown', dropdownRouter);

//the routes should be a/c to the company type, so that multiple companies can be added.
router.use('/konkreteKlinkers', clientRouter);
router.use('/konkreteKlinkers', plantRouter);
router.use('/konkreteKlinkers', machineRouter);
router.use('/konkreteKlinkers', projectRouter);
router.use('/konkreteKlinkers', projectRouter);
router.use('/konkreteKlinkers', productRouter);
router.use('/konkreteKlinkers', woRouter);
router.use('/konkreteKlinkers', joRouter);
router.use('/konkreteKlinkers', productionRouter);
router.use('/konkreteKlinkers',qcRouter);
router.use('/konkreteKlinkers',packingRouter);
router.use('/konkreteKlinkers',dispatchRouter);
router.use('/konkreteKlinkers',tranferRouter);
router.use('/konkreteKlinkers',inventoryRouter);



//////FALCON FACADE - 
import falconClientRouter from './falconFacadeRoutes/client.routes.js';
import falconProjectRouter from './falconFacadeRoutes/project.routes.js';
import falconSystemRouter from './falconFacadeRoutes/system.routes.js';
import falconProductSystemRouter from './falconFacadeRoutes/productsystem.routes.js';
import falconProductRouter from './falconFacadeRoutes/product.routes.js';
import falconWorkOrderRouter from './falconFacadeRoutes/workorder.routes.js';
import falconJobOrderRouter from './falconFacadeRoutes/joborder.routes.js';

router.use('/falconFacade', falconClientRouter);
router.use('/falconFacade', falconProjectRouter);
router.use('/falconFacade', falconSystemRouter);
router.use('/falconFacade', falconProductSystemRouter);
router.use('/falconFacade', falconProductRouter);
router.use('/falconFacade', falconWorkOrderRouter);
router.use('/falconFacade', falconJobOrderRouter);


//routes a/c to the employee permissions. 
//either the employee can have the access to the individual CRUD operations (more chances this will be implemented ~ full control , create any type of user in the future and use. submadmin,qc check, inventory check , etc.. no difference among each other.)or
// according to the process which means in each continuous checks page can be added. and if its done for multiple employees .(complex)


export default router;
