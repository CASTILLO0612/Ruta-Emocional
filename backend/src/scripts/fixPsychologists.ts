import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Psychologist } from '../models/Psychologist';
import { User } from '../models/User';

async function fixPsychologists() {
  try {
    const connStr = process.env.MONGO_URI;
    if (!connStr) throw new Error('No MONGO_URI');
    await mongoose.connect(connStr);
    console.log('[Fix] Conectado a MongoDB Atlas');

    // 1. Asegurar que todos los psicólogos tengan isAvailable: true
    const result = await Psychologist.updateMany(
      { isAvailable: { $ne: true } },
      { $set: { isAvailable: true, rating: 5.0, pricePerHour: 25, specialty: 'Psicología General' } }
    );
    console.log(`[Fix] ${result.modifiedCount} psicólogos actualizados a isAvailable: true`);

    // 2. Si un psicólogo no tiene displayName, copiar el displayName de su User asociado
    const all = await Psychologist.find().populate('user');
    for (const p of all) {
      const userObj: any = p.user;
      if (!p.displayName && userObj && userObj.displayName) {
        p.displayName = userObj.displayName;
        await p.save();
        console.log(`[Fix] Nombre asignado a psicólogo ${p._id}: ${userObj.displayName}`);
      }
    }

    console.log('[Fix] Proceso completado exitosamente.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[Fix Error]', err);
  }
}

fixPsychologists();
