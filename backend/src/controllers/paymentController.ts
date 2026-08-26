import { Request, Response } from 'express';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Modelo de Transacción de Pago (inline para mantener cohesión)
// ─────────────────────────────────────────────────────────────────────────────

interface IPayment extends mongoose.Document {
  requestId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  psychologistId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: 'pending' | 'held' | 'completed' | 'refunded' | 'failed';
  paymentMethod: string;
  transactionRef: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new mongoose.Schema<IPayment>(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActiveRequest', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    psychologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NIO' }, // Córdobas nicaragüenses
    status: {
      type: String,
      enum: ['pending', 'held', 'completed', 'refunded', 'failed'],
      default: 'pending',
    },
    paymentMethod: { type: String, default: 'wallet' },
    transactionRef: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function generateTransactionRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RE-${timestamp}-${random}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controladores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/hold
 * Retener fondos al aceptar una oferta (simula un pre-cargo).
 */
export async function holdPayment(req: Request, res: Response): Promise<void> {
  try {
    const { requestId, patientId, psychologistId, amount, paymentMethod } = req.body;

    if (!requestId || !patientId || !psychologistId || !amount) {
      res.status(400).json({ message: 'Faltan campos requeridos para procesar el pago' });
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ message: 'El monto debe ser un número positivo' });
      return;
    }

    // Verificar que no exista un hold activo para la misma solicitud
    const existingHold = await Payment.findOne({
      requestId,
      status: { $in: ['pending', 'held'] },
    });

    if (existingHold) {
      res.status(409).json({
        message: 'Ya existe una retención activa para esta solicitud',
        payment: existingHold,
      });
      return;
    }

    const transactionRef = generateTransactionRef();

    const payment = await Payment.create({
      requestId,
      patientId,
      psychologistId,
      amount,
      paymentMethod: paymentMethod || 'wallet',
      status: 'held',
      transactionRef,
    });

    console.log(`[Payment] Fondos retenidos: C$${amount} — Ref: ${transactionRef}`);

    res.status(201).json({
      message: 'Fondos retenidos exitosamente',
      payment: {
        id: payment._id,
        transactionRef: payment.transactionRef,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error procesando retención de pago: ${error.message}` });
  }
}

/**
 * POST /api/payments/complete
 * Completar el pago después de la sesión.
 */
export async function completePayment(req: Request, res: Response): Promise<void> {
  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      res.status(400).json({ message: 'Se requiere la referencia de transacción' });
      return;
    }

    const payment = await Payment.findOne({ transactionRef });

    if (!payment) {
      res.status(404).json({ message: 'Transacción no encontrada' });
      return;
    }

    if (payment.status !== 'held') {
      res.status(400).json({ message: `No se puede completar un pago con estado: ${payment.status}` });
      return;
    }

    payment.status = 'completed';
    await payment.save();

    console.log(`[Payment] Pago completado: C$${payment.amount} — Ref: ${transactionRef}`);

    res.json({
      message: 'Pago completado exitosamente',
      payment: {
        id: payment._id,
        transactionRef: payment.transactionRef,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error completando pago: ${error.message}` });
  }
}

/**
 * POST /api/payments/refund
 * Reembolsar un pago retenido (si la sesión se cancela).
 */
export async function refundPayment(req: Request, res: Response): Promise<void> {
  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      res.status(400).json({ message: 'Se requiere la referencia de transacción' });
      return;
    }

    const payment = await Payment.findOne({ transactionRef });

    if (!payment) {
      res.status(404).json({ message: 'Transacción no encontrada' });
      return;
    }

    if (payment.status !== 'held') {
      res.status(400).json({ message: `No se puede reembolsar un pago con estado: ${payment.status}` });
      return;
    }

    payment.status = 'refunded';
    await payment.save();

    console.log(`[Payment] Pago reembolsado: C$${payment.amount} — Ref: ${transactionRef}`);

    res.json({
      message: 'Reembolso procesado exitosamente',
      payment: {
        id: payment._id,
        transactionRef: payment.transactionRef,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: `Error procesando reembolso: ${error.message}` });
  }
}

/**
 * GET /api/payments/history/:userId
 * Obtener historial de pagos de un usuario.
 */
export async function getPaymentHistory(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.json([]);
      return;
    }

    const payments = await Payment.find({
      $or: [{ patientId: userId }, { psychologistId: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ message: `Error obteniendo historial de pagos: ${error.message}` });
  }
}
