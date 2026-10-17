// Quantum Institut read-only MT4 bridge.
// It publishes only account totals; it cannot place, change, or close orders.
#property strict

extern string Endpoint = "https://YOUR-DOMAIN/api/mt-bridge.php?action=snapshot";
extern string BridgeKey = "";
extern int SyncEverySeconds = 60;

// Key yang disalin dari browser sering membawa spasi atau baris baru di ujungnya,
// sehingga panjangnya jadi 69 dan EA menolak jalan. Versi bersihnya disimpan di sini.
string gBridgeKey = "";

int OnInit() {
   gBridgeKey = BridgeKey;
   StringTrimLeft(gBridgeKey);
   StringTrimRight(gBridgeKey);
   if (StringLen(gBridgeKey) != 68) {
      Print("Quantum bridge: Bridge Key tidak valid — panjang ", StringLen(gBridgeKey),
            " karakter, seharusnya 68. Salin ulang key dari dashboard (diawali QIB_).");
      return INIT_PARAMETERS_INCORRECT;
   }
   EventSetTimer(MathMax(30, SyncEverySeconds));
   SendSnapshot();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() { SendSnapshot(); }

// Daftar posisi terbuka sebagai JSON, dibatasi 50 posisi supaya body tetap kecil.
string PositionsJson() {
   string out = "[";
   int total = OrdersTotal();
   int written = 0;
   for(int i = 0; i < total && written < 50; i++) {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      int type = OrderType();
      if(type != OP_BUY && type != OP_SELL) continue;
      string symbol = OrderSymbol();
      if(symbol == "") continue;
      double current = (type == OP_BUY) ? MarketInfo(symbol, MODE_BID) : MarketInfo(symbol, MODE_ASK);
      if(written > 0) out += ",";
      out += StringFormat("{\"ticket\":\"%d\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"price_open\":%.5f,\"price_current\":%.5f,\"profit\":%.2f,\"sl\":%.5f,\"tp\":%.5f}",
         OrderTicket(), symbol, (type == OP_BUY ? "BUY" : "SELL"), OrderLots(), OrderOpenPrice(),
         current, OrderProfit() + OrderSwap() + OrderCommission(), OrderStopLoss(), OrderTakeProfit());
      written++;
   }
   return out + "]";
}

void SendSnapshot() {
   string body = StringFormat("{\"balance\":%.2f,\"equity\":%.2f,\"margin_used\":%.2f,\"open_positions\":%d,\"positions\":%s}",
      AccountBalance(), AccountEquity(), AccountMargin(), OrdersTotal(), PositionsJson());
   char data[], result[];
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nX-QI-Bridge-Key: " + gBridgeKey + "\r\n";
   int status = WebRequest("POST", Endpoint, headers, 8000, data, result, responseHeaders);
   if (status < 200 || status >= 300)
      Print("Quantum bridge gagal. HTTP=", status, "; pastikan URL sudah diizinkan pada WebRequest.");
}
