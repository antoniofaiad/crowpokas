"use strict";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_L = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CHAVE = "controle-financeiro:v1";
const CHAVE_TEMA = "controle-financeiro:tema";

const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dec = v => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseV = s => {
  s = String(s || "").trim().replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nomeMes = m => { const [y, mm] = m.split("-"); return MESES_L[+mm - 1] + " " + y; };
const curto = m => MESES[+m.split("-")[1] - 1];
const nextMes = m => { let [y, mm] = m.split("-").map(Number); mm++; if (mm > 12) { mm = 1; y++; } return y + "-" + String(mm).padStart(2, "0"); };
const novoId = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hoje = new Date();
const mesHoje = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
const $ = id => document.getElementById(id);

let meses = {}, sel = null, filtro = "todas", editando = null, armado = null;

/* ---------- Armazenamento (localStorage) ---------- */

function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) meses = validar(JSON.parse(raw));
  } catch { meses = {}; }
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(meses)); }
  catch { toast("Não deu para salvar neste navegador. Exporte um backup."); }
}

// Normaliza dados vindos do armazenamento ou de um backup importado
function validar(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  const fonte = obj.meses && typeof obj.meses === "object" ? obj.meses : obj;
  for (const [m, d] of Object.entries(fonte)) {
    if (!/^\d{4}-\d{2}$/.test(m) || !d || typeof d !== "object") continue;
    out[m] = {
      mes: m,
      renda: typeof d.renda === "number" ? d.renda : null,
      contas: (Array.isArray(d.contas) ? d.contas : [])
        .filter(c => c && typeof c.conta === "string" && typeof c.valor === "number")
        .map(c => ({
          id: String(c.id || novoId(m)),
          conta: c.conta,
          categoria: typeof c.categoria === "string" && c.categoria ? c.categoria : "Outros",
          valor: c.valor,
          pago: !!c.pago,
          venc: Number.isInteger(c.venc) && c.venc >= 1 && c.venc <= 31 ? c.venc : null,
        })),
    };
  }
  return out;
}

/* ---------- UI ---------- */

function toast(t) {
  const el = $("toast");
  el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2400);
}

function render() {
  const lista = Object.keys(meses).sort();
  $("status").textContent = lista.length
    ? `${lista.length} ${lista.length > 1 ? "meses" : "mês"} · marque as contas conforme for pagando`
    : "Comece criando o primeiro mês.";

  // abas
  const tabs = $("tabs"); tabs.innerHTML = "";
  lista.forEach(m => {
    const b = document.createElement("button");
    b.className = "tab"; b.textContent = nomeMes(m);
    b.setAttribute("aria-selected", m === sel);
    b.onclick = () => { sel = m; editando = null; render(); };
    tabs.appendChild(b);
  });
  const nb = document.createElement("button");
  nb.className = "tab new";
  nb.textContent = "+ " + (lista.length ? nomeMes(nextMes(lista[lista.length - 1])) : nomeMes(mesHoje));
  nb.onclick = novoMes; tabs.appendChild(nb);
  const sb = tabs.querySelector('[aria-selected="true"]');
  if (sb) sb.scrollIntoView({ block: "nearest", inline: "nearest" });

  const d = meses[sel];
  if (!d) {
    $("lista").innerHTML = '<li class="empty">Nenhum mês ainda. Toque em “+ ' + esc(nomeMes(mesHoje)) + '” para começar.</li>';
    ["sTotal", "sPago", "sPend", "sSobra"].forEach(id => $(id).textContent = "—");
    $("cats").innerHTML = ""; $("hist").innerHTML = ""; $("alerta").hidden = true;
    return;
  }

  const contas = [...d.contas].sort((a, b) => (a.venc || 99) - (b.venc || 99) || a.conta.localeCompare(b.conta));
  const total = contas.reduce((s, c) => s + c.valor, 0);
  const pago = contas.filter(c => c.pago).reduce((s, c) => s + c.valor, 0);
  const nPago = contas.filter(c => c.pago).length;

  // resumo
  $("sTotal").textContent = brl(total); $("sPago").textContent = brl(pago); $("sPend").textContent = brl(total - pago);
  const ri = $("renda");
  if (document.activeElement !== ri) ri.value = d.renda != null ? dec(d.renda) : "";
  const so = $("sSobra");
  if (d.renda != null) { const s = d.renda - total; so.textContent = brl(s); so.className = "val num " + (s < 0 ? "bad" : "ok"); }
  else { so.textContent = "—"; so.className = "val num"; }
  $("barra").style.width = (total ? pago / total * 100 : 0) + "%";
  $("barlbl").textContent = `${nPago} de ${contas.length} contas pagas` + (total ? ` · ${Math.round(pago / total * 100)}% do valor` : "");
  $("listaTitulo").textContent = "Contas de " + nomeMes(sel);

  // alerta de vencimentos
  const al = $("alerta"); al.hidden = true;
  const pendentes = contas.filter(c => !c.pago);
  if (sel <= mesHoje) {
    const dia = sel === mesHoje ? hoje.getDate() : 32;
    const atras = pendentes.filter(c => c.venc && c.venc < dia);
    const prox = pendentes.filter(c => c.venc && c.venc >= dia && c.venc <= dia + 5);
    if (atras.length) {
      const s = atras.length > 1 ? "s" : "";
      al.className = "alert bad";
      al.textContent = `${atras.length} conta${s} vencida${s}: ${atras.map(c => c.conta).join(", ")} (${brl(atras.reduce((t, c) => t + c.valor, 0))}).`;
      al.hidden = false;
    } else if (prox.length) {
      al.className = "alert warn";
      al.textContent = `Vence nos próximos dias: ${prox.map(c => c.conta + " (dia " + c.venc + ")").join(", ")}.`;
      al.hidden = false;
    } else if (!pendentes.length && contas.length) {
      al.className = "alert ok"; al.textContent = "Tudo pago neste mês."; al.hidden = false;
    }
  }

  // lista
  const ul = $("lista"); ul.innerHTML = "";
  const vis = contas.filter(c => filtro === "todas" || (filtro === "pago" ? c.pago : !c.pago));
  if (!vis.length) ul.innerHTML = `<li class="empty">${contas.length ? "Nada por aqui com esse filtro." : "Nenhuma conta neste mês. Adicione abaixo."}</li>`;
  const diaAtual = sel === mesHoje ? hoje.getDate() : (sel < mesHoje ? 32 : 0);
  vis.forEach(c => ul.appendChild(c.id === editando ? linhaEdicao(c) : linhaConta(c, diaAtual)));

  // categorias
  const porCat = {};
  contas.forEach(c => { const k = c.categoria || "Outros"; porCat[k] = (porCat[k] || 0) + c.valor; });
  const cs = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const max = cs.length ? cs[0][1] || 1 : 1;
  $("cats").innerHTML = cs.map(([k, v]) =>
    `<div class="crow"><span>${esc(k)}</span><div class="track"><i style="width:${v / max * 100}%"></i></div><span class="num" style="text-align:right">${brl(v)}</span></div>`
  ).join("") || '<p class="empty">Sem contas neste mês.</p>';
  const all = new Set();
  Object.values(meses).forEach(m => m.contas.forEach(c => c.categoria && all.add(c.categoria)));
  $("catlist").innerHTML = [...all].sort().map(c => `<option value="${esc(c)}">`).join("");

  // histórico
  const tots = lista.map(m => {
    const cc = meses[m].contas;
    return { m, t: cc.reduce((s, c) => s + c.valor, 0), p: cc.filter(c => c.pago).reduce((s, c) => s + c.valor, 0) };
  });
  const hm = Math.max(1, ...tots.map(x => x.t));
  const h = $("hist"); h.innerHTML = "";
  tots.forEach(x => {
    const b = document.createElement("button");
    b.className = "hcol" + (x.m === sel ? " sel" : "");
    b.setAttribute("aria-label", `${nomeMes(x.m)}: ${brl(x.t)}`);
    b.title = `${nomeMes(x.m)} — total ${brl(x.t)}, pago ${brl(x.p)}`;
    b.innerHTML = `<span class="v num">${Math.round(x.t).toLocaleString("pt-BR")}</span><div class="b" style="height:${x.t / hm * 110}px"><i style="height:${x.t ? x.p / x.t * 100 : 0}%"></i></div><span class="m">${curto(x.m)}</span>`;
    b.onclick = () => { sel = x.m; editando = null; render(); };
    h.appendChild(b);
  });
}

function linhaConta(c, diaAtual) {
  const li = document.createElement("li");
  li.className = "bill" + (c.pago ? " pago" : "");
  const late = !c.pago && c.venc && c.venc < diaAtual;
  li.innerHTML = `<button class="chk" aria-label="${c.pago ? "Marcar como a pagar" : "Marcar como paga"}"><svg viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="info"><div class="nome">${esc(c.conta)}</div><div class="meta"><span class="cat">${esc(c.categoria || "Outros")}</span>${c.venc ? `<span class="${late ? "late" : ""}">${late ? "venceu dia " : "dia "}${c.venc}</span>` : ""}</div></div>
    <div class="valor num">${brl(c.valor)}</div>
    <div class="acts"><button class="ic ed">Editar</button><button class="ic del${armado === c.id ? " armed" : ""}">${armado === c.id ? "Confirmar" : "Excluir"}</button></div>`;
  li.querySelector(".chk").onclick = () => { c.pago = !c.pago; salvar(); render(); };
  li.querySelector(".ed").onclick = () => { editando = c.id; armado = null; render(); };
  li.querySelector(".del").onclick = () => {
    if (armado !== c.id) {
      armado = c.id; render();
      setTimeout(() => { if (armado === c.id) { armado = null; render(); } }, 3000);
      return;
    }
    armado = null;
    meses[sel].contas = meses[sel].contas.filter(x => x.id !== c.id);
    salvar(); render(); toast("Conta excluída");
  };
  return li;
}

function linhaEdicao(c) {
  const li = document.createElement("li");
  li.className = "bill";
  li.innerHTML = `<form class="f editrow">
      <label class="c-nome">Conta<input name="conta" required></label>
      <label>Categoria<input name="cat" list="catlist"></label>
      <label>Valor (R$)<input name="valor" inputmode="decimal" required></label>
      <label>Dia<input name="venc" type="number" min="1" max="31"></label>
      <div class="editbtns"><button class="btn" type="submit">Salvar</button><button class="btn ghost" type="button">Cancelar</button></div>
    </form>`;
  const f = li.querySelector("form");
  f.conta.value = c.conta; f.cat.value = c.categoria || ""; f.valor.value = dec(c.valor); f.venc.value = c.venc || "";
  f.querySelector(".ghost").onclick = () => { editando = null; render(); };
  f.onsubmit = e => {
    e.preventDefault();
    const v = parseV(f.valor.value);
    if (v == null) return toast("Valor inválido.");
    Object.assign(c, { conta: f.conta.value.trim(), categoria: f.cat.value.trim() || "Outros", valor: v, venc: diaValido(f.venc.value) });
    editando = null; salvar(); render(); toast("Conta atualizada");
  };
  setTimeout(() => f.conta.focus(), 0);
  return li;
}

const diaValido = s => { const n = parseInt(s, 10); return n >= 1 && n <= 31 ? n : null; };

function novoMes() {
  const lista = Object.keys(meses).sort();
  const ult = lista[lista.length - 1];
  const m = ult ? nextMes(ult) : mesHoje;
  const base = ult ? meses[ult].contas : [];
  meses[m] = { mes: m, renda: ult ? meses[ult].renda ?? null : null, contas: base.map(c => ({ ...c, id: novoId(m), pago: false })) };
  sel = m; editando = null; salvar(); render();
  toast(ult ? `${nomeMes(m)} criado com as contas de ${nomeMes(ult)}` : `${nomeMes(m)} criado`);
}

/* ---------- Eventos ---------- */

$("novo").onsubmit = e => {
  e.preventDefault();
  if (!meses[sel]) novoMes();
  const v = parseV($("nValor").value);
  if (v == null) return toast("Informe um valor válido, ex.: 125,50");
  meses[sel].contas.push({
    id: novoId(sel), conta: $("nConta").value.trim(), categoria: $("nCat").value.trim() || "Outros",
    valor: v, pago: false, venc: diaValido($("nVenc").value),
  });
  e.target.reset(); salvar(); render(); toast("Conta adicionada");
  $("nConta").focus();
};

$("renda").addEventListener("change", e => {
  if (!meses[sel]) return;
  meses[sel].renda = parseV(e.target.value);
  salvar(); render();
});

document.querySelectorAll(".filters button").forEach(b => b.onclick = () => {
  filtro = b.dataset.f;
  document.querySelectorAll(".filters button").forEach(x => x.setAttribute("aria-pressed", x === b));
  render();
});

// Backup
const menu = $("menu"), btnMenu = $("btnMenu");
const fecharMenu = () => { menu.hidden = true; btnMenu.setAttribute("aria-expanded", "false"); };
btnMenu.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; btnMenu.setAttribute("aria-expanded", String(!menu.hidden)); };
document.addEventListener("click", e => { if (!menu.contains(e.target)) fecharMenu(); });

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("btnExportar").onclick = () => {
  fecharMenu();
  const dados = { app: "controle-financeiro", versao: 1, exportadoEm: new Date().toISOString(), meses };
  baixar(`controle-financeiro-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados, null, 2), "application/json");
};

$("btnImportar").onclick = () => { fecharMenu(); $("arquivo").click(); };
$("arquivo").onchange = async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try {
    const novos = validar(JSON.parse(await file.text()));
    const n = Object.keys(novos).length;
    if (!n) return toast("Esse arquivo não tem meses válidos.");
    if (Object.keys(meses).length && !confirm(`Importar ${n} ${n > 1 ? "meses" : "mês"}? Meses com o mesmo nome serão substituídos.`)) return;
    Object.assign(meses, novos);
    sel = meses[mesHoje] ? mesHoje : Object.keys(meses).sort().pop();
    salvar(); render(); toast("Backup importado");
  } catch { toast("Não consegui ler esse arquivo."); }
};

$("btnCsv").onclick = () => {
  fecharMenu();
  if (!meses[sel]) return toast("Nenhum mês selecionado.");
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const linhas = [["Conta", "Categoria", "Valor", "Vencimento", "Pago"].join(";")]
    .concat(meses[sel].contas.map(c => [q(c.conta), q(c.categoria), dec(c.valor), c.venc || "", c.pago ? "Sim" : "Não"].join(";")));
  baixar(`contas-${sel}.csv`, "﻿" + linhas.join("\r\n"), "text/csv");
};

// Tema
function aplicarTema(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
try { aplicarTema(localStorage.getItem(CHAVE_TEMA)); } catch {}
$("btnTema").onclick = () => {
  const escuro = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const t = escuro ? "light" : "dark";
  aplicarTema(t);
  try { localStorage.setItem(CHAVE_TEMA, t); } catch {}
};

// Sincroniza entre abas abertas
window.addEventListener("storage", e => { if (e.key === CHAVE) { carregar(); if (!meses[sel]) sel = Object.keys(meses).sort().pop() || null; render(); } });

/* ---------- App (PWA) ---------- */

let promptInstalar = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalar = e; $("btnInstalar").hidden = false; });
$("btnInstalar").onclick = async () => {
  if (!promptInstalar) return;
  promptInstalar.prompt();
  await promptInstalar.userChoice;
  promptInstalar = null; $("btnInstalar").hidden = true;
};
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ---------- Início ---------- */

carregar();
{
  const lista = Object.keys(meses).sort();
  sel = meses[mesHoje] ? mesHoje : lista[lista.length - 1] || null;
}
render();
