(function(){
  "use strict";

  const tbody = document.getElementById("osTableBody");
  const tableWrap = document.getElementById("tableWrap");
  const emptyState = document.getElementById("emptyState");
  const filtroBusca = document.getElementById("filtroBusca");
  const filtroStatus = document.getElementById("filtroStatus");

  function badgeClass(status){
    if(status === "Em andamento") return "badge-andamento";
    if(status === "Concluída") return "badge-concluida";
    return "badge-aberta";
  }

  function formatDate(iso){
    if(!iso) return "—";
    const partes = iso.split("-");
    if(partes.length !== 3) return iso;
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }

  function render(){
    const busca = filtroBusca.value.trim().toLowerCase();
    const status = filtroStatus.value;

    let lista = OSDatabase.getAll().slice().sort((a, b) => {
      return (b.atualizadoEm || "").localeCompare(a.atualizadoEm || "");
    });

    if(status) lista = lista.filter(o => o.status === status);
    if(busca){
      lista = lista.filter(o => {
        const alvo = (
          (o.osNumero || "") + " " + ((o.cliente && o.cliente.nome) || "")
        ).toLowerCase();
        return alvo.includes(busca);
      });
    }

    tbody.innerHTML = "";

    if(lista.length === 0){
      tableWrap.style.display = "none";
      emptyState.style.display = "block";
      return;
    }
    tableWrap.style.display = "block";
    emptyState.style.display = "none";

    lista.forEach(o => {
      const cliente = o.cliente || {};
      const equipamento = o.equipamento || {};
      const equipamentoTexto = [equipamento.tipo, equipamento.modelo].filter(Boolean).join(" · ") || "—";

      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + (o.osNumero || "—") + '</td>' +
        '<td>' + (cliente.nome || "—") + '</td>' +
        '<td>' + equipamentoTexto + '</td>' +
        '<td><span class="badge ' + badgeClass(o.status) + '">' + (o.status || "—") + '</span></td>' +
        '<td>' + formatDate(o.osData) + '</td>' +
        '<td>' + formatDate(o.osPrevisao) + '</td>' +
        '<td class="num">' + formatBRL(o.totalGeral || 0) + '</td>' +
        '<td></td>';

      const actionsTd = tr.querySelector("td:last-child");
      actionsTd.className = "row-actions";

      const abrirLink = document.createElement("a");
      abrirLink.href = "index.html?id=" + encodeURIComponent(o.id);
      abrirLink.textContent = "Abrir";
      actionsTd.appendChild(abrirLink);

      const excelBtn = document.createElement("button");
      excelBtn.type = "button";
      excelBtn.textContent = "Excel";
      excelBtn.addEventListener("click", () => gerarExcel(o));
      actionsTd.appendChild(excelBtn);

      const pdfBtn = document.createElement("button");
      pdfBtn.type = "button";
      pdfBtn.textContent = "PDF";
      pdfBtn.addEventListener("click", () => gerarPdf(o));
      actionsTd.appendChild(pdfBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger";
      delBtn.textContent = "Excluir";
      delBtn.addEventListener("click", function(){
        if(confirm("Excluir a O.S. nº " + (o.osNumero || "sem número") + "? Essa ação não pode ser desfeita.")){
          OSDatabase.remove(o.id);
          showToast("Ordem de serviço excluída.");
          render();
        }
      });
      actionsTd.appendChild(delBtn);

      tbody.appendChild(tr);
    });
  }

  filtroBusca.addEventListener("input", render);
  filtroStatus.addEventListener("change", render);

  render();
})();
