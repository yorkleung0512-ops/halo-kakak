-- LOCAL / DEV SEED ONLY — do NOT run on production automatically.
-- Replace :household_id and :user_id after signing in and creating a household.

-- Sample daily templates (Hong Kong household routines)
-- insert into public.task_templates (
--   household_id, title_zh, title_id, default_time, recurrence_rule,
--   priority, created_by, translation_approved, start_date
-- ) values
--   (:household_id, '準備早餐', 'Siapkan sarapan', '07:00', 'daily', 'normal', :user_id, true, current_date),
--   (:household_id, '清潔客廳同抹地', 'Bersihkan ruang tamu dan pel lantai', '08:00', 'daily', 'normal', :user_id, true, current_date),
--   (:household_id, '買餸／買菜', 'Belanja bahan makanan / sayur', '10:00', 'weekdays', 'normal', :user_id, true, current_date),
--   (:household_id, '準備午餐同洗碗', 'Siapkan makan siang dan cuci piring', '12:00', 'daily', 'normal', :user_id, true, current_date),
--   (:household_id, '洗衫同晾衫', 'Cuci baju dan jemur baju', '15:00', 'daily', 'normal', :user_id, true, current_date),
--   (:household_id, '準備晚餐／煲湯', 'Siapkan makan malam / masak sup', '17:30', 'daily', 'normal', :user_id, true, current_date),
--   (:household_id, '執屋同倒垃圾', 'Rapikan rumah dan buang sampah', '20:00', 'daily', 'normal', :user_id, true, current_date);

-- Sample glossary
-- insert into public.household_glossary (household_id, chinese_term, indonesian_term, created_by)
-- values
--   (:household_id, '買餸', 'Belanja bahan makanan', :user_id),
--   (:household_id, '抹地', 'Pel lantai', :user_id)
-- on conflict (household_id, chinese_term) do nothing;

-- Then: select public.ensure_today_occurrences(:household_id, current_date);
