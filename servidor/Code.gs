// Os Malas Studio - agenda compartilhada (Google Apps Script)
const ABA = "Agendamentos";
function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(ABA);
  if (!s) {
    s = ss.insertSheet(ABA);
    s.getRange("A:H").setNumberFormat("@");
    s.appendRow(["Data", "Início (min)", "Duração (min)", "Horário", "Serviço", "Nome", "Telefone", "Criado em"]);
    s.setFrozenRows(1);
  }
  return s;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function lista_(date) {
  const s = aba_(), n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, 3).getValues()
    .filter(r => String(r[0]) === date)
    .map(r => [Number(r[1]), Number(r[2])]);
}
function doGet(e) { return json_({ busy: lista_(String((e.parameter || {}).date || "")) }); }
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !(b.start >= 0 && b.start < 1440) || !(b.dur > 0 && b.dur <= 240)) return json_({ ok: false, error: "invalid" });
    if (lista_(b.date).some(([s, u]) => b.start < s + u && s < b.start + b.dur)) return json_({ ok: false, error: "taken" });
    aba_().appendRow([b.date, String(b.start), String(b.dur), String(b.time).slice(0, 5), String(b.service).slice(0, 40), String(b.name).slice(0, 80), String(b.phone).slice(0, 30), new Date().toISOString()]);
    return json_({ ok: true });
  } finally { lock.releaseLock(); }
}
