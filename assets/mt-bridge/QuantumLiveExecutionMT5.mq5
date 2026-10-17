// Quantum Institut MT5 live execution bridge.
// Default is OFF. Set AllowRealExecution=true only after configuring web guardrails.
#property strict
#include <Trade/Trade.mqh>

input string Endpoint = "https://YOUR-DOMAIN/api/mt-execution.php";
input string BridgeKey = "";
input bool AllowRealExecution = false;
input int PollEverySeconds = 15;

// Key bersih (spasi/baris baru di ujung dipangkas) yang dipakai saat mengirim request.
string gBridgeKey = "";

CTrade trade;

string JsonString(const string json, const string key) {
   string needle = "\"" + key + "\":\"";
   int begin = StringFind(json, needle);
   if(begin < 0) return "";
   begin += StringLen(needle);
   int end = StringFind(json, "\"", begin);
   return end < 0 ? "" : StringSubstr(json, begin, end - begin);
}
double JsonNumber(const string json, const string key) {
   string needle = "\"" + key + "\":";
   int begin = StringFind(json, needle);
   if(begin < 0) return 0.0;
   begin += StringLen(needle);
   int end = StringFind(json, ",", begin); if(end < 0) end = StringFind(json, "}", begin);
   return end < 0 ? 0.0 : StringToDouble(StringSubstr(json, begin, end - begin));
}
void SendJson(const string body, string &response, int &status) {
   char data[], result[]; string responseHeaders;
   StringToCharArray(body, data, 0, StringLen(body), CP_UTF8);
   string headers = "Content-Type: application/json\r\nX-QI-Bridge-Key: " + gBridgeKey + "\r\n";
   status = WebRequest("POST", Endpoint, headers, 8000, data, result, responseHeaders);
   response = CharArrayToString(result, 0, -1, CP_UTF8);
}
void Report(const string token, const bool ok, const string detail) {
   string body = StringFormat("{\"action\":\"report\",\"order_token\":\"%s\",\"result\":\"%s\",\"broker_order_ticket\":%I64u,\"broker_deal_ticket\":%I64u,\"retcode\":\"%u\",\"message\":\"%s\"}", token, ok ? "executed" : "rejected", trade.ResultOrder(), trade.ResultDeal(), trade.ResultRetcode(), detail);
   string ignored; int status; SendJson(body, ignored, status);
}
int OnInit() {
   gBridgeKey = BridgeKey;
   StringTrimLeft(gBridgeKey);
   StringTrimRight(gBridgeKey);
   if(StringLen(gBridgeKey) != 68) {
      Print("Quantum live bridge: Bridge Key tidak valid — panjang ", StringLen(gBridgeKey), " karakter, seharusnya 68.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(!AllowRealExecution) Print("Quantum live bridge is disabled locally.");
   EventSetTimer((int)MathMax(10, PollEverySeconds));
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() {
   if(!AllowRealExecution) return;
   string body = StringFormat("{\"action\":\"poll\",\"balance\":%.2f,\"equity\":%.2f,\"open_positions\":%d}", AccountInfoDouble(ACCOUNT_BALANCE), AccountInfoDouble(ACCOUNT_EQUITY), PositionsTotal());
   string response; int status; SendJson(body, response, status);
   if(status != 200 || StringFind(response, "\"instruction\":null") >= 0) return;
   string token = JsonString(response, "order_token"), symbol = JsonString(response, "symbol"), side = JsonString(response, "side");
   double volume = JsonNumber(response, "volume"), sl = JsonNumber(response, "stop_loss"), tp = JsonNumber(response, "take_profit");
   long magic = (long)JsonNumber(response, "magic_number");
   if(token == "" || symbol == "" || (side != "BUY" && side != "SELL") || volume <= 0 || volume > 0.01 || sl <= 0 || tp <= 0) { Report(token, false, "Local guardrail rejected instruction"); return; }
   if(!SymbolSelect(symbol, true)) { Report(token, false, "Symbol is unavailable in this terminal"); return; }
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP), minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   if(step <= 0 || volume < minLot || MathAbs(volume / step - MathRound(volume / step)) > 0.00001) { Report(token, false, "Volume conflicts with broker lot rules"); return; }
   MqlTick tick; if(!SymbolInfoTick(symbol, tick)) { Report(token, false, "No market tick available"); return; }
   if((side == "BUY" && !(sl < tick.ask && tp > tick.ask)) || (side == "SELL" && !(tp < tick.bid && sl > tick.bid))) { Report(token, false, "SL/TP no longer valid at market price"); return; }
   trade.SetExpertMagicNumber((ulong)magic); trade.SetDeviationInPoints(10);
   bool sent = side == "BUY" ? trade.Buy(volume, symbol, 0, sl, tp, "QI live signal") : trade.Sell(volume, symbol, 0, sl, tp, "QI live signal");
   Report(token, sent && (trade.ResultRetcode() == TRADE_RETCODE_DONE || trade.ResultRetcode() == TRADE_RETCODE_PLACED), trade.ResultRetcodeDescription());
}
