// Quantum Institut read-only MT5 bridge.
// It publishes only account totals and prices; it cannot place, change, or close orders.
#property strict

// Endpoint snapshot. URL untuk tick diturunkan otomatis dari URL ini
// (action=snapshot diganti menjadi action=tick), jadi tidak perlu input baru.
input string Endpoint = "https://YOUR-DOMAIN/api/mt-bridge.php?action=snapshot";
input string BridgeKey = "";
input int SyncEverySeconds = 60;   // snapshot saldo/ekuitas/posisi
input int TickEverySeconds = 1;    // harga + spread (0 = matikan pengiriman tick)

// Key yang disalin dari browser sering membawa spasi atau baris baru di ujungnya,
// sehingga panjangnya jadi 69 dan EA menolak jalan. Versi bersihnya disimpan di sini.
string gBridgeKey = "";
int    gDetik = 0;
int    gGagalTickBerturut = 0;

int OnInit() {
   gBridgeKey = BridgeKey;
   StringTrimLeft(gBridgeKey);
   StringTrimRight(gBridgeKey);
   if (StringLen(gBridgeKey) != 68) {
      Print("Quantum bridge: Bridge Key tidak valid — panjang ", StringLen(gBridgeKey),
            " karakter, seharusnya 68. Salin ulang key dari dashboard (diawali QIB_).");
      return INIT_PARAMETERS_INCORRECT;
   }
   // Satu timer 1 detik; snapshot tetap dikirim tiap SyncEverySeconds detik.
   EventSetTimer(1);
   SendSnapshot();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() {
   gDetik++;
   if (TickEverySeconds > 0 && (gDetik % (int)MathMax(1, TickEverySeconds)) == 0) SendTicks();
   if ((gDetik % (int)MathMax(30, SyncEverySeconds)) == 0) SendSnapshot();
}

// URL endpoint tick, diturunkan dari Endpoint snapshot.
string TickUrl() {
   string u = Endpoint;
   int pos = StringFind(u, "action=snapshot");
   if (pos >= 0) return StringSubstr(u, 0, pos) + "action=tick";
   if (StringFind(u, "action=") >= 0) return "";   // action lain: jangan diubah
   return u + (StringFind(u, "?") >= 0 ? "&" : "?") + "action=tick";
}

// Harga bid/ask/spread seluruh simbol Market Watch (maksimum 30) sebagai JSON.
// Yang tampil di Market Watch pengguna itulah yang dikirim — jadi pengguna
// mengendalikan sendiri simbol mana yang realtime tanpa mengubah kode.
string TicksJson() {
   string out = "[";
   int written = 0;
   int total = SymbolsTotal(true);
   for(int i = 0; i < total && written < 30; i++) {
      string sym = SymbolName(i, true);
      if(sym == "") continue;
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      if(bid <= 0.0 || ask <= 0.0 || ask < bid) continue;
      if(written > 0) out += ",";
      out += StringFormat("{\"symbol\":\"%s\",\"bid\":%.6f,\"ask\":%.6f,\"spread\":%.6f}", sym, bid, ask, ask - bid);
      written++;
   }
   return out + "]";
}

void SendTicks() {
   string url = TickUrl();
   if (url == "") return;
   string body = "{\"ticks\":" + TicksJson() + "}";
   if (StringFind(body, "{\"symbol\"") < 0) return;   // tidak ada simbol valid

   char data[], result[];
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nX-QI-Bridge-Key: " + gBridgeKey + "\r\n";
   int status = WebRequest("POST", url, headers, 5000, data, result, responseHeaders);
   if (status >= 200 && status < 300) {
      gGagalTickBerturut = 0;
      return;
   }
   gGagalTickBerturut++;
   // Jangan membanjiri log: laporkan hanya tiap 60 kegagalan berturut-turut.
   if (gGagalTickBerturut == 1 || gGagalTickBerturut % 60 == 0) {
      Print("Quantum tick gagal. HTTP=", status,
            ". Pastikan URL api/mt-bridge.php sudah diizinkan di Tools > Options > Expert Advisors > Allow WebRequest.");
   }
}

// Daftar posisi terbuka sebagai JSON, dibatasi 50 posisi supaya body tetap kecil.
string PositionsJson() {
   string out = "[";
   int total = PositionsTotal();
   int written = 0;
   for(int i = 0; i < total && written < 50; i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      if(symbol == "") continue;
      long type = PositionGetInteger(POSITION_TYPE);
      if(written > 0) out += ",";
      out += StringFormat("{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"price_open\":%.5f,\"price_current\":%.5f,\"profit\":%.2f,\"sl\":%.5f,\"tp\":%.5f}",
         ticket, symbol, (type == POSITION_TYPE_BUY ? "BUY" : "SELL"),
         PositionGetDouble(POSITION_VOLUME), PositionGetDouble(POSITION_PRICE_OPEN),
         PositionGetDouble(POSITION_PRICE_CURRENT), PositionGetDouble(POSITION_PROFIT),
         PositionGetDouble(POSITION_SL), PositionGetDouble(POSITION_TP));
      written++;
   }
   return out + "]";
}

void SendSnapshot() {
   string body = StringFormat("{\"balance\":%.2f,\"equity\":%.2f,\"margin_used\":%.2f,\"open_positions\":%d,\"positions\":%s}",
      AccountInfoDouble(ACCOUNT_BALANCE), AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN), PositionsTotal(), PositionsJson());
   char data[], result[];
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nX-QI-Bridge-Key: " + gBridgeKey + "\r\n";
   int status = WebRequest("POST", Endpoint, headers, 8000, data, result, responseHeaders);
   if (status < 200 || status >= 300)
      Print("Quantum bridge gagal. HTTP=", status, "; pastikan URL sudah diizinkan pada WebRequest.");
}
