
   import { Counter } from '../../models/konkreteKlinkers/counter.model.js';

   const counter = await Counter.findOneAndUpdate(
        { _id: 'job_order' },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
      );
      const jobOrderId = `JO-${String(counter.sequence_value).padStart(3, '0')}`;