import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Psychologist } from '../models/Psychologist';
import { requireJwtAccessSecret } from '../config/env';

function generateToken(id: string, email: string, role: string): string {
  const secret = requireJwtAccessSecret();
  return jwt.sign({ id, email, role }, secret, { expiresIn: '30d' });
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { displayName, email, password, role, specialty, licenseNumber, pricePerHour, coordinates } = req.body;

    if (!displayName || !email || !password) {
      res.status(400).json({ message: 'Todos los campos requeridos deben ser proporcionados' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      res.status(400).json({ message: 'El usuario con este correo ya existe' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      displayName: displayName.trim(),
      email: cleanEmail,
      passwordHash,
      role: role || 'patient',
    });

    if (role === 'psychologist') {
      await Psychologist.create({
        user: newUser._id,
        displayName: newUser.displayName,
        email: newUser.email,
        specialty: specialty || 'Psicología General',
        licenseNumber: (typeof licenseNumber === 'string' && licenseNumber.trim()) ? licenseNumber.trim() : 'MINSA-0000',
        verificationStatus: 'pending',
        pricePerHour: pricePerHour || 25,
        isAvailable: true,
        location: {
          type: 'Point',
          coordinates: coordinates ? [coordinates.longitude, coordinates.latitude] : [-86.2904, 12.1328],
        },
      });
    }

    const token = generateToken(newUser._id.toString(), newUser.email, newUser.role);

    res.status(201).json({
      user: {
        id: newUser._id.toString(),
        displayName: newUser.displayName,
        email: newUser.email,
        role: newUser.role,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error registrando usuario: ${error.message}` });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Por favor proporciona email y contraseña' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      res.status(401).json({ message: 'Correo o contraseña incorrectos' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Correo o contraseña incorrectos' });
      return;
    }

    // Asegurar que si el rol es psicólogo exista su perfil correspondiente en la colección de psicólogos
    if (user.role === 'psychologist') {
      let psych = await Psychologist.findOne({ user: user._id });
      if (!psych) {
        await Psychologist.create({
          user: user._id,
          displayName: user.displayName,
          email: user.email,
          specialty: 'Psicología General',
          licenseNumber: 'MINSA-0000',
          verificationStatus: 'pending',
          pricePerHour: 25,
          isAvailable: true,
          location: { type: 'Point', coordinates: [-86.2904, 12.1328] },
        });
      }
    }

    const token = generateToken(user._id.toString(), user.email, user.role);

    res.json({
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error iniciando sesión: ${error.message}` });
  }
}
