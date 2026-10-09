// Turns database error codes (raised by our SQL functions) into safe, friendly text.
// Anything unknown becomes a generic message so internals never leak.
const MESSAGES: Record<string, string> = {
  TRIP_NOT_FOUND: 'That trip could not be found.',
  TREK_NOT_AVAILABLE: 'This trek is not open for booking.',
  TRIP_NOT_AVAILABLE: 'This date is not open for booking.',
  BOOKING_CLOSED: 'Bookings for this date have closed.',
  PARTICIPANT_LIMIT: 'Too many or too few participants for this trek.',
  NOT_ENOUGH_SEATS: 'Not enough seats left on this date.',
  ALREADY_BOOKED: 'You already have a booking for this date with this email.',
  CONSENT_REQUIRED: 'Please accept the terms and privacy policy.',
  ONLINE_PAYMENTS_DISABLED: 'Online payment is not available right now.',
  INVALID_INPUT: 'Some details are invalid. Please check the form.',
  NOT_AUTHORIZED: 'You are not allowed to do that.',
  BOOKING_NOT_FOUND: 'Booking not found.',
  BOOKING_CANCELLED: 'This booking is cancelled.',
  OVERPAYMENT: 'That is more than the amount due.',
  INVALID_STATUS_TRANSITION: 'That status change is not allowed.',
  IMMUTABLE_FIELD: 'That field cannot be changed.',
  NOT_CANCELLABLE: 'This booking can no longer be cancelled.',
  TRIP_STARTED: 'The trip has already started.',
  REQUEST_ALREADY_OPEN: 'A cancellation request is already open.',
  NOT_EDITABLE: 'This booking can no longer be edited.',
  PAYMENT_NOT_REFUNDABLE: 'This payment cannot be refunded.',
  REFUND_EXCEEDS_PAYMENT: 'Refund is larger than the amount paid.',
  REQUEST_NOT_FOUND: 'Request not found.',
  TRIP_NOT_FINISHED: 'This trip has not happened yet.',
  AMOUNT_MISMATCH: 'Payment amount does not match the booking.',
  ORDER_NOT_FOUND: 'Payment order not found.',
  USE_CANCEL_TRIP: 'Use “Cancel trip” so every booking is cancelled and notified.',
  TRIP_ALREADY_CANCELLED: 'A cancelled trip cannot be reopened. Create a new date instead.',
  trip_not_overbooked:'Capacity cannot be lower than seats already booked.',
};

export type DbError = { message?: string; details?: string | null; code?: string } | null | undefined;

export function errorCode(err: DbError) {
  const msg = err?.message ?? '';
  return Object.keys(MESSAGES).find((k) => msg.includes(k)) ?? null;
}

export function friendlyError(err: DbError, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const code = errorCode(err);
  if (!code) {
    if (err.code === '23503') return 'This item is linked to existing records and cannot be deleted. Archive it instead.';
    if (err.code === '23505') return 'That already exists (duplicate value).';
    if (err.code === '42501') return MESSAGES.NOT_AUTHORIZED;
    console.error('[db error]', err);
    return fallback;
  }
  const base = MESSAGES[code];
  return err.details && ['NOT_ENOUGH_SEATS', 'PARTICIPANT_LIMIT', 'OVERPAYMENT', 'REFUND_EXCEEDS_PAYMENT'].includes(code)
    ? `${base} (${err.details})` : base;
}
