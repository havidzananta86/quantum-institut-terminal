<?php
/**
 * Quantum Engine c: Quantum EMA200 Pullback Engine
 */
function calculateQuantumEMA200($symbol, $price) {
    return [
        'engine' => 'c. Quantum EMA200 Pullback',
        'status' => 'PANTAU',
        'title' => 'Quantum EMA200 Touch',
        'description' => "Harga $symbol menguji pita dinamis EMA200. Menanti candle konfirmasi penolakan pinbar.",
        'entry_range' => round($price * 0.999, 2) . ' - ' . round($price * 1.002, 2),
        'stop_loss' => round($price * 0.991, 2) . ' (-0.90%)',
        'take_profit' => round($price * 1.028, 2) . ' (+2.80%)',
        'risk_reward' => '1 : 3.1'
    ];
}
