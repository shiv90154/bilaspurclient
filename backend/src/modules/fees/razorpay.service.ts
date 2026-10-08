import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
}

/** Equal-time compare of two hex signatures (a wrong length is simply "not equal"). */
export function sameSignature(expected: string, given: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const hmacHex = (secret: string, data: string | Buffer) =>
  createHmac('sha256', secret).update(data).digest('hex');

/**
 * Thin client for the two things we need from Razorpay: creating an order (server decides the
 * amount) and checking signatures. Card/UPI details never touch our server: Razorpay's
 * checkout collects them.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId?: string;
  private readonly keySecret?: string;
  private readonly webhookSecret?: string;
  private readonly apiUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.keyId = config.get('RAZORPAY_KEY_ID', { infer: true })?.trim() || undefined;
    this.keySecret = config.get('RAZORPAY_KEY_SECRET', { infer: true })?.trim() || undefined;
    this.webhookSecret = config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true })?.trim() || undefined;
    this.apiUrl = config.get('RAZORPAY_API_URL', { infer: true }).replace(/\/$/, '');
    if (this.enabled) this.logger.log(`Online payments enabled (${this.keyId?.startsWith('rzp_test_') ? 'TEST mode' : 'live'})`);
    else this.logger.warn('Online payments disabled: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set');
  }

  get enabled(): boolean {
    return !!(this.keyId && this.keySecret);
  }

  get publicKeyId(): string | undefined {
    return this.keyId;
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Online payment is not set up yet. Please contact the institute.',
      });
    }
  }

  async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder> {
    this.assertEnabled();
    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/orders`, {
        method: 'POST',
        headers: {
          authorization: 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Razorpay order request failed: ${String(err)}`);
      throw new BadGatewayException({ statusCode: 502, code: 'PAYMENT_GATEWAY_ERROR', message: 'Could not reach the payment gateway. Try again.' });
    }
    if (!res.ok) {
      this.logger.error(`Razorpay order refused: ${res.status} ${(await res.text()).slice(0, 300)}`);
      throw new BadGatewayException({ statusCode: 502, code: 'PAYMENT_GATEWAY_ERROR', message: 'The payment gateway refused the request. Try again later.' });
    }
    return (await res.json()) as RazorpayOrder;
  }

  /** Checkout success handler: signature = HMAC(order_id|payment_id, key secret). */
  checkPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    this.assertEnabled();
    return sameSignature(hmacHex(this.keySecret!, `${orderId}|${paymentId}`), signature);
  }

  /** Webhook: signature = HMAC(raw body, webhook secret). False when no webhook secret is set. */
  checkWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return sameSignature(hmacHex(this.webhookSecret, rawBody), signature);
  }
}
