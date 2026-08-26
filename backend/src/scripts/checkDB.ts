import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Psychologist } from '../models/Psychologist';

dotenv.config();

async function inspectDatabase() {
  try {
    const connStr = process.env.MONGO_URI;
    if (!connStr) throw new Error('No MONGO_URI');
    await mongoose.connect(connStr);
    console.log('[Inspect DB] Conectado a MongoDB Atlas');

    const users = await User.find();
    console.log(`\n=== USUARIOS EN BD (${users.length}) ===`);
    users.forEach((u) => console.log(`- ID: ${u._id} | Name: ${u.displayName} | Email: ${u.email} | Role: ${u.role}`));

    const psychologists = await Psychologist.find();
    console.log(`\n=== PSICÓLOGOS EN BD (${psychologists.length}) ===`);
    psychologists.forEach((p) =>
      console.log(`- ID: ${p._id} | UserID: ${p.user} | Name: ${p.displayName} | Available: ${p.isAvailable}`)
    );

    await mongoose.disconnect();
  } catch (err) {
    console.error('[Inspect Error]', err);
  }
}

inspectDatabase();
