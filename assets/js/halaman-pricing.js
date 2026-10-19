// Skrip halaman harga (pricing.html) — tanpa kode inline (CSP tanpa 'unsafe-inline').
// Dulu ada hitung mundur harga promo yang diulang setiap tengah malam (urgensi palsu); sudah dihapus.
const orderModal = document.getElementById('orderModal');
let pemicuTerakhir = null;

function closeOrderModal() {
    if (!orderModal.classList.contains('is-terbuka')) return;
    orderModal.classList.remove('is-terbuka');
    if (pemicuTerakhir && typeof pemicuTerakhir.focus === 'function') pemicuTerakhir.focus();
}

function showSection(id) {
    ['orderLoading', 'orderDetails', 'orderError'].forEach(s => {
        document.getElementById(s).hidden = s !== id;
    });
}

async function orderPlan(name, price, pemicu) {
    pemicuTerakhir = pemicu || null;
    orderModal.classList.add('is-terbuka');
    showSection('orderLoading');
    orderModal.querySelector('[data-tutup-order]').focus();

    let res, data;
    try {
        res = await fetch('api/payment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: name }),
            signal: AbortSignal.timeout(10000)
        });
        data = await res.json();
    } catch (err) {
        showSection('orderError');
        document.getElementById('orderErrorMsg').textContent = 'Server pembayaran tidak dapat dihubungi. Coba lagi nanti.';
        return;
    }

    if (res.ok && data?.status === 'success' && data.data) {
        const d = data.data;
        document.getElementById('odPlan').textContent = d.plan || name;
        document.getElementById('odOrderId').textContent = d.order_id || '-';
        document.getElementById('odAmount').textContent = 'Rp' + Number(d.amount_idr || price).toLocaleString('id-ID');
        document.getElementById('odStatus').textContent = d.payment_status || 'PENDING';
        document.getElementById('odQris').textContent = d.qr_string ? ('QRIS: ' + d.qr_string.slice(0, 64) + '…') : '';
        document.getElementById('odExpires').textContent = d.expires_at || '-';

        const methods = document.getElementById('odMethods');
        methods.textContent = '';
        (d.payment_methods || ['QRIS']).forEach(m => {
            const span = document.createElement('span');
            span.className = 'pb-lencana';
            span.textContent = m;
            methods.appendChild(span);
        });
        showSection('orderDetails');
        if (typeof showQuantumToast === 'function') showQuantumToast('Tagihan paket ' + (d.plan || name) + ' berhasil dibuat.', 'success');
    } else {
        showSection('orderError');
        const msg = res.status === 429
            ? 'Terlalu banyak permintaan. Coba lagi beberapa saat.'
            : (data?.message || 'Gagal membuat pesanan. Silakan coba lagi.');
        document.getElementById('orderErrorMsg').textContent = msg;
    }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOrderModal(); });

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline'): satu pendengar di document,
// satu klik = satu pesanan.
document.addEventListener('click', e => {
    const paket = e.target.closest('[data-plan]');
    if (paket) { orderPlan(paket.dataset.plan, Number(paket.dataset.harga), paket); return; }
    if (e.target.closest('[data-tutup-order]') || e.target === orderModal) closeOrderModal();
});
