import { Request, Response } from 'express';
import { Psychologist } from '../models/Psychologist';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';

const INITIAL_MOCK_PSYCHOLOGISTS = [
  {
    displayName: 'Dra. María Elena Castillo',
    email: 'mcastillo@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=47',
    specialty: 'Ansiedad y Estrés',
    licenseNumber: 'PSY-NI-2019-001',
    rating: 4.9,
    totalReviews: 128,
    pricePerHour: 600,
    modalities: ['chat', 'call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Especialista en terapia cognitivo-conductual con 8 años de experiencia.',
    location: { type: 'Point', coordinates: [-86.2893, 12.1358] },
  },
  {
    displayName: 'Dr. Carlos Méndez Ríos',
    email: 'cmendez@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=68',
    specialty: 'Depresión y Duelo',
    licenseNumber: 'PSY-NI-2017-042',
    rating: 4.7,
    totalReviews: 203,
    pricePerHour: 500,
    modalities: ['call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Psicólogo clínico especializado en depresión, duelo y transiciones vitales.',
    location: { type: 'Point', coordinates: [-86.2924, 12.1298] },
  },
];

async function seedDefaultPsychologistsIfEmpty(): Promise<void> {
  const count = await Psychologist.countDocuments();
  if (count === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Password123!', salt);

    for (const mock of INITIAL_MOCK_PSYCHOLOGISTS) {
      let user = await User.findOne({ email: mock.email });
      if (!user) {
        user = await User.create({
          displayName: mock.displayName,
          email: mock.email,
          passwordHash: hash,
          role: 'psychologist',
        });
      }
      await Psychologist.create({
        ...mock,
        user: user._id,
      });
    }
  }
}

function formatPsychologistData(p: any) {
  const userObj = p.user && typeof p.user === 'object' ? p.user : {};
  return {
    _id: p._id,
    id: p._id,
    user: p.user?._id || p.user,
    displayName: p.displayName || userObj.displayName || p.email?.split('@')[0] || 'Psicólogo',
    email: p.email || userObj.email || '',
    photoURL: p.photoURL || userObj.photoURL || 'https://i.pravatar.cc/150?img=12',
    specialty: p.specialty || 'Psicología General',
    licenseNumber: p.licenseNumber || 'MINSA-000',
    rating: typeof p.rating === 'number' ? p.rating : 5.0,
    totalReviews: p.totalReviews || 0,
    pricePerHour: typeof p.pricePerHour === 'number' ? p.pricePerHour : 25,
    modalities: p.modalities && p.modalities.length > 0 ? p.modalities : ['chat', 'call'],
    isAvailable: p.isAvailable !== false,
    isVerified: p.isVerified || false,
    bio: p.bio || 'Profesional de salud mental disponible para consultas.',
    location: p.location || { type: 'Point', coordinates: [-86.2904, 12.1328] },
    coordinates: p.location?.coordinates
      ? { longitude: p.location.coordinates[0], latitude: p.location.coordinates[1] }
      : { longitude: -86.2904, latitude: 12.1328 },
  };
}

export async function getAllPsychologists(req: Request, res: Response): Promise<void> {
  try {
    await seedDefaultPsychologistsIfEmpty();
    // Consultar todos los psicólogos cuyo isAvailable no sea explícitamente false ($ne: false)
    const list = await Psychologist.find({ isAvailable: { $ne: false } }).populate('user', 'displayName email photoURL');
    const formatted = list.map(formatPsychologistData);
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: `Error al obtener psicólogos: ${error.message}` });
  }
}

export async function getNearbyPsychologists(req: Request, res: Response): Promise<void> {
  try {
    await seedDefaultPsychologistsIfEmpty();
    const { lat, lng, radiusKm } = req.query;

    if (!lat || !lng) {
      const all = await Psychologist.find({ isAvailable: { $ne: false } }).populate('user', 'displayName email photoURL');
      res.json(all.map(formatPsychologistData));
      return;
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const maxDistanceMeters = (parseFloat(radiusKm as string) || 10) * 1000;

    const nearby = await Psychologist.find({
      isAvailable: { $ne: false },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    }).populate('user', 'displayName email photoURL');

    res.json(nearby.map(formatPsychologistData));
  } catch (error: any) {
    const fallback = await Psychologist.find({ isAvailable: { $ne: false } }).populate('user', 'displayName email photoURL');
    res.json(fallback.map(formatPsychologistData));
  }
}

export async function updateLocation(req: Request, res: Response): Promise<void> {
  try {
    const { userId, latitude, longitude, isAvailable } = req.body;

    const psych = await Psychologist.findOneAndUpdate(
      { user: userId },
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      },
      { new: true }
    );

    if (!psych) {
      res.status(404).json({ message: 'Perfil de psicólogo no encontrado' });
      return;
    }

    res.json(formatPsychologistData(psych));
  } catch (error: any) {
    res.status(500).json({ message: `Error actualizando ubicación del psicólogo: ${error.message}` });
  }
}
