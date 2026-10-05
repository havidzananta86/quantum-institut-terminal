-- ============================================================
-- QUANTUM INSTITUT SEED DATA
-- ============================================================

USE `quantum_market_terminal`;

-- Seed Admin & VIP Users
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `role`, `status`) VALUES
(1, 'Admin Quantum', 'admin@quantuminstitut.market', '$2y$10$e0MYzXyjpJS7Pd0RVvHwHe1z5.2Y3N9vK0x8d5X9vK0x8d5X9vK0x', 'admin', 'active'),
(2, 'VIP Trader Demo', 'vip@quantuminstitut.market', '$2y$10$e0MYzXyjpJS7Pd0RVvHwHe1z5.2Y3N9vK0x8d5X9vK0x8d5X9vK0x', 'vip', 'active')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- Seed Demo License Keys
INSERT INTO `license_keys` (`user_id`, `license_key`, `plan_name`, `active_slots`, `expires_at`) VALUES
(2, 'QI-2026-99PRO-DEMO', '6 Bulan', 12, '2026-12-31 23:59:59')
ON DUPLICATE KEY UPDATE `license_key` = VALUES(`license_key`);
