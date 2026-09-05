/*
 * db.js — "banco de dados" local das ordens de serviço.
 * Usa localStorage do navegador (não envia nada para nenhum servidor).
 * Compartilhado entre index.html, ordens.html e relatorio.html.
 */
(function(window){
  "use strict";

  const DB_KEY = "os_database_v1";

  function getAll(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }catch(e){
      console.error("Não foi possível ler o banco de dados local:", e);
      return [];
    }
  }

  function saveAll(list){
    try{
      localStorage.setItem(DB_KEY, JSON.stringify(list));
      return true;
    }catch(e){
      console.error("Não foi possível salvar no banco de dados local:", e);
      return false;
    }
  }

  function getById(id){
    return getAll().find(o => o.id === id) || null;
  }

  function upsert(record){
    const list = getAll();
    const idx = list.findIndex(o => o.id === record.id);
    if(idx >= 0){ list[idx] = record; } else { list.push(record); }
    const ok = saveAll(list);
    return ok ? record : null;
  }

  function storageDisponivel(){
    try{
      const testKey = "__os_storage_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    }catch(e){
      return false;
    }
  }

  function remove(id){
    saveAll(getAll().filter(o => o.id !== id));
  }

  function clearAll(){
    localStorage.removeItem(DB_KEY);
  }

  function generateId(){
    return "os_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  window.OSDatabase = { getAll, saveAll, getById, upsert, remove, clearAll, generateId, storageDisponivel };

  // ---------- Formatação ----------
  function formatBRL(value){
    const n = typeof value === "number" ? value : parseFloat(value) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parsePrice(input){
    const rawValue = (input && typeof input === "object" && "value" in input) ? input.value : input;
    const raw = String(rawValue || "").replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  window.formatBRL = formatBRL;
  window.parsePrice = parsePrice;

  // ---------- Notificações (toast) ----------
  function showToast(message, type){
    type = type || "info";
    let container = document.getElementById("toastContainer");
    if(!container){
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(function(){
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  window.showToast = showToast;

  // ---------- Exportar Excel ----------
  function gerarExcel(data){
    if(typeof XLSX === "undefined"){
      showToast("Não foi possível carregar a biblioteca de Excel.", "error");
      return;
    }
    const aoa = [
      ["ORDEM DE SERVIÇO"], [],
      ["Nº da O.S.", data.osNumero], ["Status", data.status],
      ["Data de entrada", data.osData], ["Previsão de entrega", data.osPrevisao], [],
      ["DADOS DO CLIENTE"],
      ["Nome", data.cliente.nome], ["Telefone", data.cliente.telefone], ["E-mail", data.cliente.email],
      ["Endereço", data.cliente.endereco], ["CPF/CNPJ", data.cliente.documento], [],
      ["DADOS DO TÉCNICO"],
      ["Nome", data.tecnico.nome], ["Contato", data.tecnico.contato], [],
      ["DADOS DO EQUIPAMENTO"],
      ["Tipo", data.equipamento.tipo], ["Marca", data.equipamento.marca], ["Modelo", data.equipamento.modelo],
      ["Nº de série", data.equipamento.serie], ["Senha de acesso", data.equipamento.senha],
      ["Acessórios entregues", data.equipamento.acessorios], [],
      ["PROBLEMA RELATADO"], [data.problema], [],
      ["DIAGNÓSTICO TÉCNICO"], [data.diagnostico], [],
      ["ORÇAMENTO"], [data.orcamento], [],
      ["SERVIÇOS REALIZADOS"], ["Descrição", "Preço (R$)"]
    ];
    (data.servicos || []).forEach(r => aoa.push([r.descricao, r.preco]));
    aoa.push(["Subtotal serviços", data.totalServicos], []);

    aoa.push(["PEÇAS TROCADAS/ADICIONADAS"], ["Descrição", "Preço (R$)"]);
    (data.pecas || []).forEach(r => aoa.push([r.descricao, r.preco]));
    aoa.push(["Subtotal peças", data.totalPecas], []);

    aoa.push(["TOTAL GERAL", data.totalGeral]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 32 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordem de Serviço");
    const nomeArquivo = "OS-" + (data.osNumero || "sem-numero") + ".xlsx";
    XLSX.writeFile(wb, nomeArquivo);
  }

  // ---------- Exportar PDF ----------
  function gerarPdf(data){
    if(typeof window.jspdf === "undefined"){
      showToast("Não foi possível carregar a biblioteca de PDF.", "error");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    function checkPageBreak(lineHeight){
      if(y + lineHeight > pageHeight - margin){
        doc.addPage();
        y = margin;
      }
    }

    function addTitle(text){
      checkPageBreak(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(text, margin, y);
      y += 18;
    }

    function addLine(label, value){
      checkPageBreak(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "normal");
      const text = value || "-";
      const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2 - 120);
      doc.text(wrapped, margin + 120, y);
      y += Math.max(14, wrapped.length * 12);
    }

    function addParagraph(text){
      checkPageBreak(16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(text || "-", pageWidth - margin * 2);
      wrapped.forEach(line => {
        checkPageBreak(14);
        doc.text(line, margin, y);
        y += 14;
      });
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Ordem de Serviço", margin, y);
    y += 26;

    addLine("Nº da O.S.", data.osNumero);
    addLine("Status", data.status);
    addLine("Data de entrada", data.osData);
    addLine("Previsão de entrega", data.osPrevisao);
    y += 6;

    addTitle("Dados do cliente");
    addLine("Nome", data.cliente.nome);
    addLine("Telefone", data.cliente.telefone);
    addLine("E-mail", data.cliente.email);
    addLine("Endereço", data.cliente.endereco);
    addLine("CPF/CNPJ", data.cliente.documento);
    y += 6;

    addTitle("Dados do técnico");
    addLine("Nome", data.tecnico.nome);
    addLine("Contato", data.tecnico.contato);
    y += 6;

    addTitle("Dados do equipamento");
    addLine("Tipo", data.equipamento.tipo);
    addLine("Marca", data.equipamento.marca);
    addLine("Modelo", data.equipamento.modelo);
    addLine("Nº de série", data.equipamento.serie);
    addLine("Senha de acesso", data.equipamento.senha);
    addLine("Acessórios entregues", data.equipamento.acessorios);
    y += 6;

    addTitle("Problema relatado");
    addParagraph(data.problema);

    addTitle("Diagnóstico técnico");
    addParagraph(data.diagnostico);

    addTitle("Orçamento");
    addParagraph(data.orcamento);

    addTitle("Serviços realizados");
    if((data.servicos || []).length === 0){
      addParagraph("Nenhum serviço adicionado.");
    } else {
      data.servicos.forEach(r => addLine(r.descricao || "-", formatBRL(r.preco)));
    }
    addLine("Subtotal serviços", formatBRL(data.totalServicos));
    y += 6;

    addTitle("Peças trocadas ou adicionadas");
    if((data.pecas || []).length === 0){
      addParagraph("Nenhuma peça adicionada.");
    } else {
      data.pecas.forEach(r => addLine(r.descricao || "-", formatBRL(r.preco)));
    }
    addLine("Subtotal peças", formatBRL(data.totalPecas));
    y += 10;

    checkPageBreak(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("TOTAL GERAL: " + formatBRL(data.totalGeral), margin, y);

    const nomeArquivo = "OS-" + (data.osNumero || "sem-numero") + ".pdf";
    doc.save(nomeArquivo);
  }

  window.gerarExcel = gerarExcel;
  window.gerarPdf = gerarPdf;

})(window);
