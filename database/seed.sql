-- ============================================================
-- QUANTUM INSTITUT — SEED DATA (akun & lisensi demo)
-- Password demo semua akun: quantum2026
-- ============================================================

USE `quantum_market_terminal`;

-- Akun Admin, VIP & PRO Demo (password: quantum2026)
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `role`, `is_active`, `status`) VALUES
(1, 'Admin Quantum',     'admin@quantum-institut.com', '$2y$10$wtCnDn0NFP5lvAldHcIOne0Ywn0.qIOV9TOlbZLCkssT9mTFkT9A.', 'admin', 1, 'active'),
(2, 'VIP Trader Demo',   'vip@quantum-institut.com',   '$2y$10$wtCnDn0NFP5lvAldHcIOne0Ywn0.qIOV9TOlbZLCkssT9mTFkT9A.', 'vip',   1, 'active'),
(3, 'PRO Trader Demo',   'pro@quantum-institut.com',   '$2y$10$wtCnDn0NFP5lvAldHcIOne0Ywn0.qIOV9TOlbZLCkssT9mTFkT9A.', 'pro',   1, 'active')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`);

-- Lisensi Demo (key: QI-2026-99PRO-DEMO) untuk akun PRO, aktif s.d. akhir 2026
INSERT INTO `license_keys` (`user_id`, `license_key`, `plan_name`, `active_slots`, `is_active`, `expires_at`) VALUES
(3, 'QI-2026-99PRO-DEMO', '6 Bulan', 12, 1, '2026-12-31 23:59:59')
ON DUPLICATE KEY UPDATE `license_key` = VALUES(`license_key`), `expires_at` = VALUES(`expires_at`);
