/**
 * DELEGASI AKSI — pengganti atribut on*="..." yang dilarang CSP tanpa 'unsafe-inline'.
 *
 *   <button data-qi-aksi="qtSetAkun" data-qi-arg='["real"]'>      ← dulu onclick="qtSetAkun('real')"
 *   <select data-qi-aksi-change="qtSetAkun" data-qi-arg-change='["$nilai"]'>  ← dulu onchange="qtSetAkun(this.value)"
 *
 * - data-qi-aksi = klik; data-qi-aksi-<jenis> untuk change / input / submit / keydown. Satu pendengar per jenis
 *   peristiwa di document, jadi elemen yang digambar ulang lewat innerHTML tetap jalan tanpa dipasang ulang.
 * - Nama aksi dicari dulu di daftar QIAksi.daftar(...), lalu di window (boleh bertitik: "QIMTools.calcPnl"
 *   dipanggil dengan this = QIMTools). Dicari SAAT diklik, seperti handler inline dulu — jadi pembungkus
 *   yang dipasang belakangan (mis. pembungkus yang dipasang modul lain pada window.qtSetAkun) tetap terpakai.
 * - data-qi-arg = larik JSON. Token khusus: "$el" = elemennya (dulu `this`), "$event" = peristiwanya,
 *   "$nilai" = el.value. Tanpa data-qi-arg fungsi dipanggil tanpa argumen.
 * - Urutan & penghentian sama seperti handler inline: dari target naik ke leluhur; aksi "hentikan"
 *   (dulu event.stopPropagation()) menghentikan aksi leluhur. Elemen yang memanggil e.stopPropagation()
 *   lewat addEventListener juga tetap menghalangi aksi leluhurnya (peristiwa tidak sampai ke document).
 * - Di template string JS pakai QIAksi.arg(...) untuk data-qi-arg: hasilnya JSON yang sudah di-escape untuk
 *   atribut ber-kutip ganda.
 */
(function () {
    'use strict';
    if (window.QIAksi) return;

    const JENIS = ['click', 'change', 'input', 'submit', 'keydown'];
    const atribut = jenis => jenis === 'click' ? ['data-qi-aksi', 'data-qi-arg'] : ['data-qi-aksi-' + jenis, 'data-qi-arg-' + jenis];
    const terdaftar = Object.create(null);

    const el$ = sel => sel === 'body' ? document.body : document.querySelector(sel);

    // Aksi kecil yang dulu ditulis langsung di atribut (document.getElementById(...).classList.toggle(...) dsb.).
    // Semua aksi terdaftar dipanggil (el, e, ...arg).
    Object.assign(terdaftar, {
        hentikan(el, e) { e.stopPropagation(); },
        alihKelas(el, e, sel, kelas) { const t = el$(sel); if (t) t.classList.toggle(kelas); },
        tambahKelas(el, e, sel, kelas) { const t = el$(sel); if (t) t.classList.add(kelas); },
        klikElemen(el, e, sel) { const t = el$(sel); if (t) t.click(); },
        fokus(el, e, sel) { const t = el$(sel); if (t) { t.focus(); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
        hapusElemen(el, e, sel) { const t = sel ? el$(sel) : el; if (t) t.remove(); },
        hapusTerdekat(el, e, sel) { const t = el.closest(sel); if (t) t.remove(); },
        bukaUrl(el, e, url) { window.location.href = url; },
    });

    function cari(nama) {
        if (terdaftar[nama]) return { fn: terdaftar[nama], ini: null, terdaftar: true };
        let ini = window, fn = window;
        for (const bagian of nama.split('.')) { ini = fn; fn = fn == null ? undefined : fn[bagian]; }
        return typeof fn === 'function' ? { fn, ini, terdaftar: false } : null;
    }

    function argumen(el, e, mentah) {
        if (mentah == null || mentah === '') return [];
        let arr;
        try { arr = JSON.parse(mentah); } catch (err) { console.warn('[QIAksi] data-qi-arg bukan JSON:', mentah, el); return []; }
        if (!Array.isArray(arr)) arr = [arr];
        return arr.map(a => a === '$el' ? el : a === '$event' ? e : a === '$nilai' ? el.value : a);
    }

    function jalankan(el, e, jenis) {
        const [aAksi, aArg] = atribut(jenis);
        const nama = el.getAttribute(aAksi);
        if (!nama) return;
        const f = cari(nama);
        if (!f) { console.warn('[QIAksi] aksi tidak ditemukan:', nama, el); return; }
        const arg = argumen(el, e, el.getAttribute(aArg));
        try {
            // Aksi terdaftar menerima (el, e, ...arg); fungsi window menerima arg apa adanya.
            // Fungsi async: galatnya tetap muncul sebagai unhandledrejection seperti dulu.
            if (f.terdaftar) f.fn(el, e, ...arg); else f.fn.apply(f.ini, arg);
        } catch (err) {
            // Sama seperti handler inline: galat satu aksi dilaporkan (window.onerror / error-tracker.js)
            // tanpa menghentikan aksi leluhur.
            setTimeout(() => { throw err; });
        }
    }

    for (const jenis of JENIS) {
        const [aAksi] = atribut(jenis);
        document.addEventListener(jenis, function (e) {
            for (let el = e.target; el && el !== document; el = el.parentElement) {
                if (el.nodeType !== 1) continue;
                if (el.hasAttribute(aAksi)) {
                    // Elemen nonaktif tidak menerima klik (handler inline juga tidak dipanggil browser).
                    if (jenis === 'click' && el.disabled) return;
                    jalankan(el, e, jenis);
                    if (e.cancelBubble) return;
                }
            }
        });
    }

    const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    window.QIAksi = {
        /** Daftarkan aksi bernama: QIAksi.daftar({ nama(el, e, arg1, arg2) { ... } }). */
        daftar(peta) { Object.assign(terdaftar, peta); },
        /** Nilai data-qi-arg siap ditempel ke atribut ber-kutip ganda: `data-qi-arg="${QIAksi.arg(id, 1)}"`. */
        arg(...nilai) { return escAttr(JSON.stringify(nilai)); },
        /** Untuk uji/diagnosa: apakah nama aksi bisa dijalankan sekarang. */
        ada(nama) { return !!cari(nama); },
    };
})();
