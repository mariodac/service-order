(function(){
  "use strict";

  const lista = OSDatabase.getAll();

  const totalOs = lista.length;
  const faturamentoTotal = lista.reduce((s, o) => s + (o.totalGeral || 0), 0);
  const ticketMedio = totalOs > 0 ? faturamentoTotal / totalOs : 0;
  const abertasCount = lista.filter(o => o.status === "Aberta").length;
  const andamentoCount = lista.filter(o => o.status === "Em andamento").length;
  const concluidaCount = lista.filter(o => o.status === "Concluída").length;

  document.getElementById("kpiTotalOs").textContent = totalOs;
  document.getElementById("kpiFaturamento").textContent = formatBRL(faturamentoTotal);
  document.getElementById("kpiTicketMedio").textContent = formatBRL(ticketMedio);
  document.getElementById("kpiAbertas").textContent = abertasCount + andamentoCount;
  document.getElementById("kpiAbertasSub").textContent =
    abertasCount + " abertas · " + andamentoCount + " em andamento";

  if(totalOs === 0){
    document.getElementById("relatorioEmpty").style.display = "block";
    document.getElementById("kpiGrid").style.display = "none";
    document.querySelector(".chart-grid").style.display = "none";
    return;
  }

  const corAccent = "#2e6f5e";
  const corAmbar = "#c9862c";
  const corAzul = "#3b5ba5";
  const corGrade = "#d7ddd8";

  if(window.Chart){
    Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
    Chart.defaults.color = "#4c5750";
  }

  if (typeof window.Chart === "undefined") {
    document.querySelector(".chart-grid").innerHTML =
      "<p>Não foi possível carregar a biblioteca de gráficos.</p>";
    return;
  }

  // ---------- O.S. por status ----------
  new Chart(document.getElementById("chartStatus"), {
    type: "doughnut",
    data: {
      labels: ["Aberta", "Em andamento", "Concluída"],
      datasets: [{
        data: [abertasCount, andamentoCount, concluidaCount],
        backgroundColor: [corAzul, corAmbar, corAccent],
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      cutout: "62%"
    }
  });

  // ---------- Serviços x peças no faturamento ----------
  const totalServicosGeral = lista.reduce((s, o) => s + (o.totalServicos || 0), 0);
  const totalPecasGeral = lista.reduce((s, o) => s + (o.totalPecas || 0), 0);

  new Chart(document.getElementById("chartServicoPeca"), {
    type: "doughnut",
    data: {
      labels: ["Serviços", "Peças"],
      datasets: [{
        data: [totalServicosGeral, totalPecasGeral],
        backgroundColor: [corAccent, corAmbar],
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      cutout: "62%"
    }
  });

  // ---------- Faturamento por mês ----------
  const porMes = {};
  lista.forEach(o => {
    const ref = o.osData || (o.criadoEm ? o.criadoEm.slice(0, 10) : null);
    if(!ref) return;
    const chave = ref.slice(0, 7); // AAAA-MM
    porMes[chave] = (porMes[chave] || 0) + (o.totalGeral || 0);
  });
  const mesesOrdenados = Object.keys(porMes).sort();
  const nomesMes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const labelsMes = mesesOrdenados.map(chave => {
    const partes = chave.split("-");
    const ano = partes[0], mes = partes[1];
    return nomesMes[parseInt(mes, 10) - 1] + "/" + ano.slice(2);
  });

  new Chart(document.getElementById("chartMes"), {
    type: "bar",
    data: {
      labels: labelsMes,
      datasets: [{
        label: "Faturamento",
        data: mesesOrdenados.map(k => porMes[k]),
        backgroundColor: corAccent,
        borderRadius: 5,
        maxBarThickness: 46
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatBRL(ctx.parsed.y) } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: corGrade }, ticks: { callback: v => formatBRL(v) } },
        x: { grid: { display: false } }
      }
    }
  });

  // ---------- Serviços mais realizados ----------
  const contagemServicos = {};
  lista.forEach(o => {
    (o.servicos || []).forEach(s => {
      const nome = (s.descricao || "").trim();
      if(!nome) return;
      if(!contagemServicos[nome]) contagemServicos[nome] = { qtd: 0, total: 0 };
      contagemServicos[nome].qtd += 1;
      contagemServicos[nome].total += s.preco || 0;
    });
  });
  const topServicos = Object.entries(contagemServicos)
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .slice(0, 6);

  if(topServicos.length === 0){
    document.getElementById("chartServicos").closest(".chart-card").innerHTML =
      '<h3>Serviços mais realizados</h3>' +
      '<p style="color:var(--ink-soft);font-size:13px;margin:0;">Nenhum serviço registrado ainda.</p>';
  } else {
    new Chart(document.getElementById("chartServicos"), {
      type: "bar",
      data: {
        labels: topServicos.map(([nome]) => nome.length > 30 ? nome.slice(0, 28) + "…" : nome),
        datasets: [{
          label: "Vezes realizado",
          data: topServicos.map(([, v]) => v.qtd),
          backgroundColor: corAzul,
          borderRadius: 5,
          maxBarThickness: 34
        }]
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: corGrade }, ticks: { precision: 0 } },
          y: { grid: { display: false } }
        }
      }
    });
  }

})();
