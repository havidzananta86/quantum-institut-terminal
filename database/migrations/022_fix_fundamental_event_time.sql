-- 022_fix_fundamental_event_time.sql
-- PERBAIKAN fundamental_events.event_time yang tergeser zona waktu.
--
-- MENGAPA:
--   api/_fundamental.php menulis event_time dengan date() PHP (zona php.ini, mis.
--   Europe/Berlin di XAMPP), padahal kolom ini dibandingkan dengan NOW() MySQL (zona
--   server MySQL, mis. Asia/Bangkok). Hasilnya setiap peristiwa tergeser beberapa jam
--   (di XAMPP: 5 jam lebih awal), sehingga "peristiwa terdekat" dan hitungan "sudah lewat"
--   salah. Kode sekarang menulis FROM_UNIXTIME(epoch) — zona sesi MySQL, sama dengan NOW().
--
-- APA YANG DILAKUKAN:
--   Menghitung ulang event_time dari tanggal asli di raw_json ("2026-10-17T10:15:00-04:00"),
--   yang selalu membawa offset. Baris tanpa offset di raw_json tidak disentuh.
--   1. Hapus baris lama yang kembarannya (waktu benar) sudah ada — hanya terjadi bila
--      kode baru sempat menyinkronkan sebelum migrasi ini dijalankan.
--   2. Perbarui sisanya ke waktu yang benar.
--
-- SIFAT MIGRASI: idempoten — waktu dihitung dari raw_json, jadi menjalankan ulang tidak
-- mengubah apa-apa. Jalankan SEBELUM atau bersamaan dengan kode baru.

DELETE f FROM `fundamental_events` f
JOIN `fundamental_events` g
  ON g.`country` = f.`country` AND g.`event_name` = f.`event_name` AND g.`id` <> f.`id`
 AND g.`event_time` = FROM_UNIXTIME(TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00',
       CONVERT_TZ(STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(f.`raw_json`, '$.date')), 19), '%Y-%m-%dT%H:%i:%s'),
                  RIGHT(JSON_UNQUOTE(JSON_EXTRACT(f.`raw_json`, '$.date')), 6), '+00:00')))
WHERE JSON_UNQUOTE(JSON_EXTRACT(f.`raw_json`, '$.date')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$'
  AND f.`event_time` <> g.`event_time`;

UPDATE `fundamental_events`
SET `event_time` = FROM_UNIXTIME(TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00',
      CONVERT_TZ(STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(`raw_json`, '$.date')), 19), '%Y-%m-%dT%H:%i:%s'),
                 RIGHT(JSON_UNQUOTE(JSON_EXTRACT(`raw_json`, '$.date')), 6), '+00:00')))
WHERE JSON_UNQUOTE(JSON_EXTRACT(`raw_json`, '$.date')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$'
  AND `event_time` <> FROM_UNIXTIME(TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00',
      CONVERT_TZ(STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(`raw_json`, '$.date')), 19), '%Y-%m-%dT%H:%i:%s'),
                 RIGHT(JSON_UNQUOTE(JSON_EXTRACT(`raw_json`, '$.date')), 6), '+00:00')));
