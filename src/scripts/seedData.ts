import { upsertPsychologist } from '../repositories/PsychologistRepository';
import { Psychologist } from '../models/Psychologist';

const MOCK_PSYCHOLOGISTS: Psychologist[] = [
  {
    id: 'psy_001',
    displayName: 'Dra. Maria Elena Castillo',
    email: 'mcastillo@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=47',
    specialty: 'Ansiedad y Estres',
    licenseNumber: 'PSY-NI-2019-001',
    rating: 4.9,
    totalReviews: 128,
    pricePerHour: 600,
    modalities: ['chat', 'call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Especialista en terapia cognitivo-conductual con 8 anos de experiencia.',
    coordinates: { latitude: 12.1358, longitude: -86.2893 },
    createdAt: new Date(),
  },
  {
    id: 'psy_002',
    displayName: 'Dr. Carlos Mendez Rios',
    email: 'cmendez@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=68',
    specialty: 'Depresion y Duelo',
    licenseNumber: 'PSY-NI-2017-042',
    rating: 4.7,
    totalReviews: 203,
    pricePerHour: 500,
    modalities: ['call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Psicologo clinico especializado en depresion, duelo y transiciones vitales.',
    coordinates: { latitude: 12.1298, longitude: -86.2924 },
    createdAt: new Date(),
  },
  {
    id: 'psy_003',
    displayName: 'Lic. Sofia Vargas Luna',
    email: 'svargas@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=32',
    specialty: 'Trauma y TEPT',
    licenseNumber: 'PSY-NI-2020-115',
    rating: 4.8,
    totalReviews: 89,
    pricePerHour: 450,
    modalities: ['chat', 'call'],
    isAvailable: true,
    isVerified: true,
    bio: 'Especialista en trauma complejo y EMDR. Sesiones disponibles en linea.',
    coordinates: { latitude: 12.1318, longitude: -86.2884 },
    createdAt: new Date(),
  },
  {
    id: 'psy_004',
    displayName: 'Dr. Roberto Jimenez',
    email: 'rjimenez@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=55',
    specialty: 'Pareja y Familia',
    licenseNumber: 'PSY-NI-2016-078',
    rating: 4.6,
    totalReviews: 315,
    pricePerHour: 700,
    modalities: ['in-person', 'call'],
    isAvailable: true,
    isVerified: true,
    bio: 'Terapeuta familiar sistémico con enfoque en comunicacion asertiva.',
    coordinates: { latitude: 12.1338, longitude: -86.2864 },
    createdAt: new Date(),
  },
  {
    id: 'psy_005',
    displayName: 'Lic. Andrea Morales',
    email: 'amorales@rutaemocional.ni',
    photoURL: 'https://i.pravatar.cc/150?img=23',
    specialty: 'Adolescentes y Jovenes',
    licenseNumber: 'PSY-NI-2021-203',
    rating: 5.0,
    totalReviews: 47,
    pricePerHour: 350,
    modalities: ['chat', 'call', 'in-person'],
    isAvailable: true,
    isVerified: true,
    bio: 'Psicologa especializada en adolescentes, autoestima y ansiedad social.',
    coordinates: { latitude: 12.1348, longitude: -86.2914 },
    createdAt: new Date(),
  },
];

export async function seedAllPsychologists(): Promise<void> {
  console.log('[Seed] Iniciando carga de psicologos...');
  let success = 0;
  for (const psy of MOCK_PSYCHOLOGISTS) {
    try {
      await upsertPsychologist(psy);
      console.log(`[Seed] OK: ${psy.displayName}`);
      success++;
    } catch (error) {
      console.error(`[Seed] Error: ${psy.displayName}`, error);
    }
  }
  console.log(`[Seed] Completado: ${success}/${MOCK_PSYCHOLOGISTS.length} psicologos cargados`);
}

export { MOCK_PSYCHOLOGISTS };
