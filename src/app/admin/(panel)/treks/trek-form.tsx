import { ActionForm } from '@/components/admin/action-form';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { paiseToRupees } from '@/lib/format';
import type { Trek } from '@/lib/types';
import { saveTrekAction } from './actions';

const join = (a?: string[] | null) => (a ?? []).join('\n');

export function TrekForm({ trek }: { trek?: Trek }) {
  const t = trek;
  const itinerary = (t?.itinerary ?? []).map((s) => (s.time ? `${s.time} | ${s.title}` : s.title)).join('\n');
  const rules = (t?.refund_rules ?? []).map((r) => `${r.hours_before}h: ${r.refund_percent}%`).join('\n');
  const L = (label: string, name: string, node: React.ReactNode, hint?: string, cls = '') => <Field label={label} htmlFor={name} hint={hint} className={cls}>{node}</Field>;
  return (
    <ActionForm action={saveTrekAction} submit={t ? 'Save trek' : 'Create trek'} variant="forest" size="md">
      {t && <input type="hidden" name="id" value={t.id} />}
      <fieldset className="grid gap-4 rounded-xl2 border border-sand-200 bg-white p-5 md:grid-cols-2">
        <legend className="px-1 font-display text-lg">Basics</legend>
        {L('Name', 'name', <Input id="name" name="name" defaultValue={t?.name} required />)}
        {L('URL slug', 'slug', <Input id="slug" name="slug" defaultValue={t?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />, 'e.g. skandagiri-sunrise → /treks/skandagiri-sunrise')}
        {L('Destination', 'destination', <Input id="destination" name="destination" defaultValue={t?.destination} required />)}
        {L('Region / location', 'region', <Input id="region" name="region" defaultValue={t?.region ?? ''} />)}
        {L('Difficulty', 'difficulty', <Select id="difficulty" name="difficulty" defaultValue={t?.difficulty ?? 'easy'}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option></Select>)}
        {L('Status', 'status', <Select id="status" name="status" defaultValue={t?.status ?? 'draft'}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="archived">Archived</option></Select>)}
        {L('Price per person (₹)', 'price_paise', <Input id="price_paise" name="price_paise" inputMode="decimal" defaultValue={paiseToRupees(t?.price_paise)} required />, 'Default price; a trip date can override it.')}
        <div className="grid grid-cols-3 gap-3">
          {L('Distance km', 'distance_km', <Input id="distance_km" name="distance_km" inputMode="decimal" defaultValue={t?.distance_km ?? ''} />)}
          {L('Hours', 'duration_hours', <Input id="duration_hours" name="duration_hours" inputMode="decimal" defaultValue={t?.duration_hours ?? ''} />)}
          {L('Elevation m', 'elevation_m', <Input id="elevation_m" name="elevation_m" inputMode="numeric" defaultValue={t?.elevation_m ?? ''} />)}
        </div>
        {L('Short description', 'short_description', <Textarea id="short_description" name="short_description" rows={2} maxLength={300} defaultValue={t?.short_description ?? ''} />, 'Shown on cards (max 300 characters).', 'md:col-span-2')}
        {L('Full description', 'description', <Textarea id="description" name="description" rows={6} defaultValue={t?.description ?? ''} />, undefined, 'md:col-span-2')}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={t?.is_featured} className="accent-forest-700" /> Feature on home page</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="meals_offered" defaultChecked={t?.meals_offered} className="accent-forest-700" /> Meals included (ask food preference)</label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl2 border border-sand-200 bg-white p-5 md:grid-cols-2">
        <legend className="px-1 font-display text-lg">Logistics</legend>
        {L('Meeting point', 'meeting_point', <Textarea id="meeting_point" name="meeting_point" rows={2} defaultValue={t?.meeting_point ?? ''} />)}
        {L('Google Maps link', 'meeting_point_map_url', <Input id="meeting_point_map_url" name="meeting_point_map_url" type="url" defaultValue={t?.meeting_point_map_url ?? ''} placeholder="https://maps.app.goo.gl/…" />)}
        {L('Reporting time', 'default_reporting_time', <Input id="default_reporting_time" name="default_reporting_time" type="time" defaultValue={t?.default_reporting_time?.slice(0, 5) ?? ''} />)}
        {L('Return time (approx.)', 'default_return_time', <Input id="default_return_time" name="default_return_time" type="time" defaultValue={t?.default_return_time?.slice(0, 5) ?? ''} />)}
        {L('Min people per booking', 'min_participants_per_booking', <Input id="min_participants_per_booking" name="min_participants_per_booking" type="number" min={1} max={20} defaultValue={t?.min_participants_per_booking ?? 1} />)}
        {L('Max people per booking', 'max_participants_per_booking', <Input id="max_participants_per_booking" name="max_participants_per_booking" type="number" min={1} max={20} defaultValue={t?.max_participants_per_booking ?? 6} />)}
        {L('Itinerary', 'itinerary', <Textarea id="itinerary" name="itinerary" rows={6} defaultValue={itinerary} placeholder={'04:00 | Leave from meeting point\n06:00 | Start climb'} />, 'One step per line. Optional time before a | sign.', 'md:col-span-2')}
        {L('Trek leader name', 'leader_name', <Input id="leader_name" name="leader_name" defaultValue={t?.leader_name ?? ''} />)}
        {L('Trek leader bio', 'leader_bio', <Textarea id="leader_bio" name="leader_bio" rows={2} defaultValue={t?.leader_bio ?? ''} />)}
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl2 border border-sand-200 bg-white p-5 md:grid-cols-3">
        <legend className="px-1 font-display text-lg">Inclusions & preparation</legend>
        {L("What's included", 'inclusions', <Textarea id="inclusions" name="inclusions" rows={5} defaultValue={join(t?.inclusions)} />, 'One per line.')}
        {L('Not included', 'exclusions', <Textarea id="exclusions" name="exclusions" rows={5} defaultValue={join(t?.exclusions)} />, 'One per line.')}
        {L('Things to carry', 'things_to_carry', <Textarea id="things_to_carry" name="things_to_carry" rows={5} defaultValue={join(t?.things_to_carry)} />, 'One per line.')}
        {L('Fitness guidance', 'fitness_guidance', <Textarea id="fitness_guidance" name="fitness_guidance" rows={3} defaultValue={t?.fitness_guidance ?? ''} />)}
        {L('Minimum age', 'min_age', <Input id="min_age" name="min_age" inputMode="numeric" defaultValue={t?.min_age ?? ''} />)}
        <div />
        {L('Safety instructions', 'safety_info', <Textarea id="safety_info" name="safety_info" rows={4} defaultValue={t?.safety_info ?? ''} />, undefined, 'md:col-span-2')}
        {L('Weather notes', 'weather_info', <Textarea id="weather_info" name="weather_info" rows={4} defaultValue={t?.weather_info ?? ''} />)}
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl2 border border-sand-200 bg-white p-5 md:grid-cols-2">
        <legend className="px-1 font-display text-lg">Cancellation</legend>
        {L('Cancellation policy text', 'cancellation_policy', <Textarea id="cancellation_policy" name="cancellation_policy" rows={4} defaultValue={t?.cancellation_policy ?? ''} />)}
        {L('Refund rules', 'refund_rules', <Textarea id="refund_rules" name="refund_rules" rows={4} defaultValue={rules} placeholder={'72h: 100%\n24h: 50%'} />, 'One per line: hours before reporting → refund %. Later = no refund.')}
      </fieldset>
    </ActionForm>
  );
}
