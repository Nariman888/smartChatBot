// QR Payment Service for Kaspi Pay and other providers
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentData {
  paymentId: string;
  businessId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  provider: 'kaspi' | 'halyk' | 'jusan' | 'stripe';
  createdAt: Date;
  qrData?: string;
  qrImage?: string;
}

export class QRPaymentService {
  private payments: Map<string, PaymentData> = new Map();
  
  // Generate Kaspi Pay QR code
  async generateKaspiQR(
    merchantId: string,
    amount: number,
    description: string,
    userId: string,
    businessId: string
  ): Promise<PaymentData> {
    const paymentId = uuidv4();
    
    // Kaspi Pay format
    const kaspiData = {
      service: 'P2P',
      merchant: merchantId,
      amount: amount.toFixed(2),
      txn_id: paymentId,
      desc: description
    };
    
    // Generate QR data string
    const qrData = `https://kaspi.kz/pay?${new URLSearchParams(kaspiData).toString()}`;
    
    // Generate QR code image
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    const payment: PaymentData = {
      paymentId,
      businessId,
      userId,
      amount,
      currency: 'KZT',
      description,
      status: 'pending',
      provider: 'kaspi',
      createdAt: new Date(),
      qrData,
      qrImage
    };
    
    this.payments.set(paymentId, payment);
    return payment;
  }
  
  // Generate Halyk Bank QR code
  async generateHalykQR(
    iin: string,
    amount: number,
    description: string,
    userId: string,
    businessId: string
  ): Promise<PaymentData> {
    const paymentId = uuidv4();
    
    // Halyk Bank format
    const halykData = {
      iin,
      amount: amount.toFixed(2),
      purpose: description,
      txn: paymentId
    };
    
    const qrData = `https://pay.halykbank.kz?${new URLSearchParams(halykData).toString()}`;
    
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#00A651',
        light: '#FFFFFF'
      }
    });
    
    const payment: PaymentData = {
      paymentId,
      businessId,
      userId,
      amount,
      currency: 'KZT',
      description,
      status: 'pending',
      provider: 'halyk',
      createdAt: new Date(),
      qrData,
      qrImage
    };
    
    this.payments.set(paymentId, payment);
    return payment;
  }
  
  // Generate universal payment QR (for any bank)
  async generateUniversalQR(
    recipientName: string,
    accountNumber: string,
    amount: number,
    description: string,
    userId: string,
    businessId: string
  ): Promise<PaymentData> {
    const paymentId = uuidv4();
    
    // ISO 20022 format for universal payments
    const qrData = [
      'SPD*1.0',
      `ACC:${accountNumber}`,
      `RN:${recipientName}`,
      `AM:${amount.toFixed(2)}`,
      `CUR:KZT`,
      `MSG:${description}`,
      `ID:${paymentId}`
    ].join('*');
    
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    const payment: PaymentData = {
      paymentId,
      businessId,
      userId,
      amount,
      currency: 'KZT',
      description,
      status: 'pending',
      provider: 'jusan',
      createdAt: new Date(),
      qrData,
      qrImage
    };
    
    this.payments.set(paymentId, payment);
    return payment;
  }
  
  // Update payment status (called from webhook)
  updatePaymentStatus(paymentId: string, status: PaymentData['status']): boolean {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return false;
    }
    
    payment.status = status;
    this.payments.set(paymentId, payment);
    return true;
  }
  
  // Get payment by ID
  getPayment(paymentId: string): PaymentData | undefined {
    return this.payments.get(paymentId);
  }
  
  // Get all payments for user
  getUserPayments(userId: string): PaymentData[] {
    const userPayments: PaymentData[] = [];
    for (const payment of this.payments.values()) {
      if (payment.userId === userId) {
        userPayments.push(payment);
      }
    }
    return userPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Check payment status (simulate for demo)
  async checkPaymentStatus(paymentId: string): Promise<PaymentData['status']> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return 'failed';
    }
    
    // In production, this would call the payment provider's API
    // For demo, randomly complete payments after 30 seconds
    const age = Date.now() - payment.createdAt.getTime();
    if (age > 30000 && payment.status === 'pending') {
      const randomComplete = Math.random() > 0.3;
      payment.status = randomComplete ? 'completed' : 'pending';
      this.payments.set(paymentId, payment);
    }
    
    return payment.status;
  }
  
  // Generate payment link
  generatePaymentLink(payment: PaymentData, baseUrl: string): string {
    return `${baseUrl}/pay/${payment.paymentId}`;
  }
}

export default QRPaymentService;