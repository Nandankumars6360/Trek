export type Difficulty = 'easy' | 'moderate' | 'difficult';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'partially_refunded' | 'refunded';

export type Trek = {
  id: string; name: string; slug: string; destination: string; region: string | null;
  short_description: string | null; description: string | null; difficulty: Difficulty;
  distance_km: number | null; duration_hours: number | null; elevation_m: number | null;
  price_paise: number; featured_image: string | null; gallery_images: string[];
  itinerary: { time?: string; title: string; details?: string }[];
  inclusions: string[]; exclusions: string[]; things_to_carry: string[];
  fitness_guidance: string | null; min_age: number | null; safety_info: string | null; weather_info: string | null;
  meeting_point: string | null; meeting_point_map_url: string | null;
  default_reporting_time: string | null; default_return_time: string | null;
  leader_name: string | null; leader_bio: string | null; meals_offered: boolean;
  cancellation_policy: string | null; refund_rules: { hours_before: number; refund_percent: number }[];
  min_participants_per_booking: number; max_participants_per_booking: number;
  is_featured: boolean; status: 'draft' | 'published' | 'archived'; created_at: string; updated_at: string;
};

export type PublicTrip = {
  trip_id: string; trip_date: string; reporting_time: string | null; return_time: string | null;
  capacity: number; seats_reserved: number; seats_left: number; price_paise: number;
  booking_deadline: string; availability: 'open' | 'full' | 'closed' | 'completed' | 'cancelled';
  trek_id: string; slug: string; name: string; destination: string; region: string | null;
  difficulty: Difficulty; distance_km: number | null; duration_hours: number | null;
  short_description: string | null; featured_image: string | null; is_featured: boolean;
};

export type BookingDetails = {
  id: string; reference: string; status: BookingStatus; payment_status: PaymentStatus; payment_mode: 'manual' | 'online';
  customer_name: string; customer_email: string; customer_phone: string; participant_count: number;
  price_per_participant_paise: number; total_paise: number; paid_paise: number; created_at: string;
  participants: string[];
  trip: { id: string; date: string; reporting_time: string | null; return_time: string | null; meeting_point: string | null; meeting_point_map_url: string | null; status: string };
  trek: { name: string; slug: string; destination: string; things_to_carry: string[]; safety_info: string | null; cancellation_policy: string | null };
  open_cancellation_request: boolean;
};

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
