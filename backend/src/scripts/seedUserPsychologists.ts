import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Psychologist } from '../models/Psychologist';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EXTRA_PSYCHOLOGISTS = [
  {
    displayName: 'Lic. Doene',
    email: 'doene120280@gmail.com',
    photoURL: 'https://i.pravatar.cc/150?img=33',
    specialty: 'Psicología General',
    licenseNumber: 'MINSA-101',
    rating: 5.0,
    totalReviews: 12,
    pricePerHour: 300,
    modalities: ['chat', 'call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Psicólogo capacitado para atención de crisis y apoyo emocional.',
    location: { type: 'Point', coordinates: [-86.2890, 12.1350] },
  },
  {
    displayName: 'Alfredo Fajardo',
    email: 'fajalfred@gmail.com',
    photoURL: 'https://i.pravatar.cc/150?img=12',
    specialty: 'Psicología Clínica y Terapia',
    licenseNumber: 'MINSA-102',
    rating: 5.0,
    totalReviews: 25,
    pricePerHour: 400,
    modalities: ['chat', 'call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Especialista en psicología clínica y acompañamiento emocional.',
    location: { type: 'Point', coordinates: [-86.2910, 12.1310] },
  },
];

async function seedFirebasePsychologistsToMongo() {
  try {
    const connStr = process.env.MONGO_URI;
    if (!connStr) throw new Error('No MONGO_URI');

    const seedPassword = process.env.MONGO_MIGRATION_SEED_PASSWORD;
    if (!seedPassword || seedPassword.length < 12) {
      throw new Error('MONGO_MIGRATION_SEED_PASSWORD must contain at least 12 characters');
    }

    await mongoose.connect(connStr);
    console.log('[Seed Mongo] Conectado a MongoDB Atlas (RutaEmocional)');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(seedPassword, salt);

    for (const data of EXTRA_PSYCHOLOGISTS) {
      let user = await User.findOne({ email: data.email.toLowerCase() });
      if (!user) {
        user = await User.create({
          displayName: data.displayName,
          email: data.email.toLowerCase(),
          passwordHash: hash,
          role: 'psychologist',
        });
        console.log(`[Seed Mongo] Usuario creado: ${user.email}`);
      }

      let psych = await Psychologist.findOne({ user: user._id });
      if (!psych) {
        psych = await Psychologist.create({
          ...data,
          user: user._id,
        });
        console.log(`[Seed Mongo] Perfil Psicólogo creado en Mongo: ${data.displayName} (${data.email})`);
      } else {
        psych.displayName = data.displayName;
        psych.isAvailable = true;
        await psych.save();
        console.log(`[Seed Mongo] Perfil Psicólogo actualizado: ${data.displayName}`);
      }
    }

    console.log('[Seed Mongo] Finalizado exitosamente.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[Seed Mongo Error]', err);
  }
}

seedFirebasePsychologistsToMongo();
