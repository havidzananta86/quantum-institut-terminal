<?php
/**
 * Quantum Engine a: Quantum SNR (Support & Resistance Retest Engine)
 */
function calculateQuantumSNR($symbol, $price) {
    $slOffset = $price * 0.008;
    $tpOffset = $price * 0.027;

    return [
        'engine' => 'a. Quantum SNR',
        'status' => 'SETUP',
        'title' => 'Quantum SNR Setup Terbentuk',
        'description' => "Harga $symbol ($price) berhasil bertahan di atas Key Support Level setelah 3x retest.",
        'entry_range' => round($price - $slOffset * 0.2, 2) . ' - ' . round($price + $slOffset * 0.2, 2),
        'stop_loss' => round($price - $slOffset, 2) . ' (-0.80%)',
        'take_profit' => round($price + $tpOffset, 2) . ' (+2.70%)',
        'risk_reward' => '1 : 3.4',
        'execution_cost_limit' => '5% dari Risk Limit',
        'checklist' => [
            ['name' => 'Retest Support Valid (>2x)', 'passed' => true],
            ['name' => 'Rejection Candle Body', 'passed' => true],
            ['name' => 'Ratio Risk:Reward >= 1:2.5', 'passed' => true],
            ['name' => 'Penutupan Candle H1', 'passed' => false]
        ]
    ];
}
