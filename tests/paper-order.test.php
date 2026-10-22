<?php
/**
 * Dipanggil oleh tests/paper-order.test.js. Menjalankan fungsi murni api/_paper_order.php
 * dan mencetak hasilnya sebagai JSON — tanpa database, tanpa jaringan.
 */
require __DIR__ . '/../api/_paper_order.php';

$acuan = static fn(array $ubah = []) => array_merge(
    ['price' => 4138.2, 'bid' => 4138.0, 'ask' => 4138.4, 'source' => 'oanda_tv', 'market' => 'open', 'tick_age' => 2, 'umur' => 3],
    $ubah
);

// Cache sungguhan di folder sementara: berkas terbaru menang, berkas basi dilewati.
$dir = sys_get_temp_dir() . '/qi-paper-order-' . getmypid();
@mkdir($dir);
file_put_contents("$dir/lama.json", json_encode(['prices' => ['XAUUSD' => ['price' => 4000, 'source' => 'oanda_tv']]]));
touch("$dir/lama.json", time() - 60);
file_put_contents("$dir/baru.json", json_encode(['prices' => ['XAUUSD' => ['price' => 4138.2, 'bid' => 4138.0, 'ask' => 4138.4, 'source' => 'oanda_tv', 'market' => 'open', 'tick_age' => 1]]]));
file_put_contents("$dir/basi.json", json_encode(['prices' => ['EURUSD' => ['price' => 1.1, 'source' => 'oanda_tv']]]));
touch("$dir/basi.json", time() - 1000);
$dariCache = qi_paper_harga_acuan('XAUUSD', $dir);
$tanpa = qi_paper_harga_acuan('EURUSD', $dir);
array_map('unlink', glob("$dir/*.json"));
@rmdir($dir);

echo json_encode([
    'buka_buy'        => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4138.3, $acuan()),
    'buka_sell'       => qi_paper_harga_eksekusi('XAUUSD', 'jual', 4138.1, $acuan()),
    'tanpa_bidask'    => qi_paper_harga_eksekusi('BTCUSDT', 'beli', null, $acuan(['price' => 84700.0, 'bid' => null, 'ask' => null, 'source' => 'binance', 'market' => null, 'tick_age' => null])),
    'harga_karangan'  => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4100.0, $acuan()),
    'karangan_dekat'  => qi_paper_harga_eksekusi('XAUUSD', 'jual', 4150.0, $acuan()),
    'acuan_basi'      => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4138.3, $acuan(['umur' => 45])),
    'tanpa_acuan'     => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4138.3, null),
    'kurs_harian'     => qi_paper_harga_eksekusi('EURUSD', 'beli', 1.12, $acuan(['price' => 1.12341, 'bid' => null, 'ask' => null, 'source' => 'frankfurter'])),
    'pasar_tutup'     => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4138.3, $acuan(['market' => 'closed'])),
    'tick_macet'      => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4138.3, $acuan(['tick_age' => 400])),
    'acuan_15dtk'     => qi_paper_harga_eksekusi('XAUUSD', 'beli', 4138.3, $acuan(['umur' => 15])),
    'sltp_buy_ok'     => qi_paper_cek_sltp('BUY', 4138.4, 4120.0, 4160.0),
    'sltp_buy_sl'     => qi_paper_cek_sltp('BUY', 4138.4, 4150.0, null),
    'sltp_buy_tp'     => qi_paper_cek_sltp('BUY', 4138.4, null, 4130.0),
    'sltp_sell_ok'    => qi_paper_cek_sltp('SELL', 4138.0, 4150.0, 4120.0),
    'sltp_sell_sl'    => qi_paper_cek_sltp('SELL', 4138.0, 4130.0, null),
    'cache_terbaru'   => $dariCache,
    'cache_basi'      => $tanpa,
    'obj'             => qi_paper_baris_ke_obj(['id' => 7, 'symbol' => 'XAUUSD', 'direction' => 'SELL', 'lots' => '0.10', 'entry_price' => '4138.000000',
                                                'stop_loss' => null, 'take_profit' => '4100.000000', 'status' => 'closed', 'close_price' => '4130.000000',
                                                'pnl_usd' => '80.0000', 'opened_ts' => 1790000000, 'closed_ts' => 1790000600, 'source' => 'manual']),
    'obj_tp'          => qi_paper_baris_ke_obj(['id' => 8, 'symbol' => 'XAUUSD', 'direction' => 'BUY', 'lots' => '0.10', 'entry_price' => '4100', 'stop_loss' => null,
                                                'take_profit' => '4130', 'status' => 'closed', 'close_price' => '4130', 'pnl_usd' => '300', 'opened_ts' => 1790000000,
                                                'closed_ts' => 1790000600, 'source' => 'manual', 'komp_periode' => '2026-W43', 'close_reason' => 'tp']),
]);
