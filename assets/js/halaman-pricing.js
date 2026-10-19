// Skrip halaman harga (pricing.html) — dulu <script> inline, dipindah agar lolos CSP tanpa 'unsafe-inline'.
const orderModal = document.getElementById('orderModal');

function closeOrderModal() { orderModal.classList.add('hidden'); orderModal.style.display = ''; }

function showSection(id) {
    ['orderLoading', 'orderDetails', 'orderError'].forEach(s => {
        document.getElementById(s).classList.toggle('hidden', s !== id);
    });
}

async function orderPlan(name, price) {
    orderModal.classList.remove('hidden');
    orderModal.style.display = 'flex';
    showSection('orderLoading');

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
        methods.innerHTML = '';
        (d.payment_methods || ['QRIS']).forEach(m => {
            const span = document.createElement('span');
            span.className = 'px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700';
            span.textContent = m;
            methods.appendChild(span);
        });
        showSection('orderDetails');
        showQuantumToast('🧾 Tagihan paket ' + (d.plan || name) + ' berhasil dibuat.', 'success');
    } else {
        showSection('orderError');
        const msg = res.status === 429
            ? 'Terlalu banyak permintaan. Coba lagi beberapa saat.'
            : (data?.message || 'Gagal membuat pesanan. Silakan coba lagi.');
        document.getElementById('orderErrorMsg').textContent = msg;
    }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOrderModal(); });

// #8 Early Bird Countdown Timer (resets daily at midnight)
(function(){
    function getEndOfDay() {
        var now = new Date();
        var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        return end;
    }
    function tick() {
        var now = new Date();
        var end = getEndOfDay();
        var diff = Math.max(0, end - now);
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        var el;
        el = document.getElementById('ebDays'); if(el) el.textContent = String(d).padStart(2,'0');
        el = document.getElementById('ebHours'); if(el) el.textContent = String(h).padStart(2,'0');
        el = document.getElementById('ebMins'); if(el) el.textContent = String(m).padStart(2,'0');
        el = document.getElementById('ebSecs'); if(el) el.textContent = String(s).padStart(2,'0');
    }
    tick();
    setInterval(tick, 1000);
})();

// Pengganti atribut onclick="..." (dilarang CSP tanpa 'unsafe-inline'). Kartu paket dan tombol di dalamnya
// sama-sama ber-data-plan; satu pendengar di document memastikan satu klik = satu pesanan (dulu klik tombol
// ikut menggelembung ke onclick kartu sehingga orderPlan terpanggil dua kali).
document.addEventListener('click', e => {
    const paket = e.target.closest('[data-plan]');
    if (paket) { orderPlan(paket.dataset.plan, Number(paket.dataset.harga)); return; }
    if (e.target.closest('[data-tutup-order]') || e.target === orderModal) closeOrderModal();
});
