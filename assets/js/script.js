(async function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  let registroAtualId = editId || null;

  // Evita que um Enter em qualquer campo do formulário dispare o envio
  // nativo do <form>, o que recarregaria a página e apagaria os dados
  // digitados antes de o usuário conseguir clicar em "Salvar O.S.".
  const osForm = document.getElementById("osForm");
  if (osForm) {
    osForm.addEventListener("submit", function (e) {
      e.preventDefault();
    });
  }

  // ---------- Data padrão ----------
  const hoje = new Date().toISOString().split("T")[0];
  if (!editId) document.getElementById("osData").value = hoje;

  // ---------- Status toggle ----------
  document
    .getElementById("statusToggle")
    .addEventListener("click", function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      this.querySelectorAll("button").forEach((b) =>
        b.classList.remove("active"),
      );
      btn.classList.add("active");
    });

  function setStatus(status) {
    const btns = document.querySelectorAll("#statusToggle button");
    btns.forEach((b) =>
      b.classList.toggle("active", b.dataset.status === status),
    );
    if (![...btns].some((b) => b.classList.contains("active")) && btns[0])
      btns[0].classList.add("active");
  }

  // ---------- Formatação de moeda ----------
  const formatBRL = (function() {
    if(typeof window.formatBRL == "function") {
      const fn = window.formatBRL;
      // valida que não retorna HTML
      return function(v) {
        const result = fn(v);
        if (result && typeof result !== "string" || /<|>|&/.test(result)) {
          throw new Error("formatBRL retornou valor inválido");
        }
        return result;
      };
    }
    return function(value) {
      return value.toLocaleDateString("pt-BR", { style: "currency", currency: "BRL"});
    };
  })();
    
  // Os campos de preço agora são <input type="number">, que sempre usa
  // ponto como separador decimal (independente do idioma do navegador).
  function parsePrice(input) {
    const raw = input.value;
    // sanitizando antes de fazer o parse
    const sanitized = sanitizeText(raw);

    if (!sanitized || isNaN(parseFloat(sanitized))) return 0;

    // valida o formato numerico estrito (apenas digitos, ponto e sinal)
    const numericPattern = /^-?\d+(\.\d{1,2})?$/;
    if(!numericPattern.test(raw)) {
      console.warn("Formato de preço inválido:", raw);
      return 0;
    }
    return parseFloat(sanitized)
  }

  // Função auxiliar para limpar texto e evitar injeção de código
  function sanitizeText(text) {
    if (!text || typeof text !== "string") return "";

    // Remove tags HTML e caracteres especiais perigosos antes de salvar na variável
    let cleaned = text.replace(/<[^>]*>?/gm, "");
    // Remove handlers maliciosos (onfocus=, onclick=, etc.)
    cleaned = cleaned.replace(/\s*on\w+\s*=.*?/gim, "");

    const htmlEntities = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
    Object.values(htmlEntities).forEach((val, idx) => {
      cleaned = cleaned.replace(
        new RegExp(`[${Object.keys(htmlEntities)[idx]}]`, "g"),
        val,
      );
    });

    return cleaned.trim();
  }

  // ---------- Função de Escape HTML ----------
  function escapeHtml(text) {
    if (!text || typeof text !== "string") return "";
    const htmlEntities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
  }

  // ---------- Função que preenche os dados na tabela ----------
  function renderTableBody(data, bodyId) {
    const tbody = document.getElementById("osTableBody");

    if (!data || data.length === 0) {
      // Mostra estado vazio se não houver dados
      return;
    }

    let htmlContent = "";

    data.forEach((os) => {
      // Aplica a função escapeHtml em todos os campos que vêm do formulário ou do Supabase.
      const clienteEscaped = escapeHtml(os.cliente || "");
      const equipamentoEscaped = escapeHtml(os.equipamento || "");

      htmlContent += `
            <tr>
                <td>${os.numeroOs}</td>
                <td>${clienteEscaped}</td>
                <td>${equipamentoEscaped}</td>
                <td><span class="status">${escapeHtml(os.status)}</span></td>
                <td>${new Date(os.dataEntrada).toLocaleDateString("pt-BR")}</td>
                <td>${new Date(os.previsao).toLocaleDateString("pt-BR")}</td>
                <td>R$ ${os.total.toFixed(2)}</td>
                <td><button class="btn-action">Editar</button></td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlContent; // Atribuição segura ao tbody
  }

  // ---------- Validação de datas ----------
  const osDataInput = document.getElementById("osData");
  const osPrevisaoInput = document.getElementById("osPrevisao");
  const erroDatasEl = document.getElementById("erroDatas");

  function validarDatas() {
    const entrada = osDataInput.value;
    const previsao = osPrevisaoInput.value;
    
    if (!entrada || !previsao) return true; // campos vazios

    try {
      const dataEntrada = new Date(entrada);
      const dataPrevisao = new Date(previsao);

      if (isNaN(dataEntrada.getTime()) || isNaN(dataPrevisao.getTime())) {
        throw new Error("Data inválidas");
      }

      return  !isNaN(dataEntrada.getTime()) &&
              !isNaN(dataPrevisao.getTime()) &&
              dataPrevisao >= dataEntrada;
    } catch (e) {
      console.error("Erro ao validar datas:", e);
      return false;
    }
  }

  osDataInput.addEventListener("change", validarDatas);
  osPrevisaoInput.addEventListener("change", validarDatas);
  osDataInput.addEventListener("input", validarDatas);
  osPrevisaoInput.addEventListener("input", validarDatas);

  // ---------- Validação: telefone, e-mail e CPF/CNPJ ----------
  const telefoneInput = document.getElementById("clienteTelefone");
  const emailInput = document.getElementById("clienteEmail");
  const documentoInput = document.getElementById("clienteDocumento");
  const erroTelefoneEl = document.getElementById("erroTelefone");
  const erroEmailEl = document.getElementById("erroEmail");
  const erroDocumentoEl = document.getElementById("erroDocumento");

  function mostrarErro(input, erroEl, invalido) {
    if (erroEl) erroEl.style.display = invalido ? "block" : "none";
    input.classList.toggle("invalid", invalido);
  }

  // ----- Telefone: máscara (DDD) 9XXXX-XXXX enquanto digita -----
  function maskTelefone(valorBruto) {
    let v = valorBruto.replace(/\D/g, "").slice(0, 11);
    if (v.length > 10)
      v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    else if (v.length > 5)
      v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, "($1) $2");
    else if (v.length > 0) v = v.replace(/(\d{0,2})/, "($1");
    return v.trim();
  }

  function validarTelefone(mostrarSeVazio) {
    const digitos = telefoneInput.value.replace(/\D/g, "");
    if (digitos.length === 0) {
      mostrarErro(telefoneInput, erroTelefoneEl, false);
      return true;
    }
    const invalido = digitos.length < 10 || digitos.length > 11;
    mostrarErro(
      telefoneInput,
      erroTelefoneEl,
      invalido && mostrarSeVazio !== false,
    );
    return !invalido;
  }

  telefoneInput.addEventListener("input", function () {
    this.value = maskTelefone(this.value);
    if (this.classList.contains("invalid")) validarTelefone();
  });
  telefoneInput.addEventListener("blur", () => validarTelefone());

  // ----- E-mail -----
  const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function validarEmail() {
    const valor = emailInput.value.trim();
    if (valor === "") {
      mostrarErro(emailInput, erroEmailEl, false);
      return true;
    }
    const invalido = !REGEX_EMAIL.test(valor);
    mostrarErro(emailInput, erroEmailEl, invalido);
    return !invalido;
  }
  emailInput.addEventListener("blur", validarEmail);
  emailInput.addEventListener("input", function () {
    if (this.classList.contains("invalid")) validarEmail();
  });

  // ----- CPF / CNPJ -----
  function maskDocumento(valorBruto) {
    const digitos = valorBruto.replace(/\D/g, "").slice(0, 14);
    if (digitos.length <= 11) {
      if (digitos.length > 9)
        return (
          digitos.slice(0, 3) +
          "." +
          digitos.slice(3, 6) +
          "." +
          digitos.slice(6, 9) +
          "-" +
          digitos.slice(9)
        );
      if (digitos.length > 6)
        return (
          digitos.slice(0, 3) +
          "." +
          digitos.slice(3, 6) +
          "." +
          digitos.slice(6)
        );
      if (digitos.length > 3)
        return digitos.slice(0, 3) + "." + digitos.slice(3);
      return digitos;
    }
    let out =
      digitos.slice(0, 2) +
      "." +
      digitos.slice(2, 5) +
      "." +
      digitos.slice(5, 8) +
      "/" +
      digitos.slice(8, 12);
    if (digitos.length > 12) out += "-" + digitos.slice(12);
    return out;
  }

  function validarCPF(cpf) {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9], 10)) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf[10], 10);
  }

  function validarCNPJ(cnpj) {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    function calcularDigito(base, pesos) {
      const soma = base
        .split("")
        .reduce(
          (acc, digito, i) => acc + parseInt(digito, 10) * pesos[i],
          0,
        );
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    }
    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const digito1 = calcularDigito(cnpj.slice(0, 12), pesos1);
    if (digito1 !== parseInt(cnpj[12], 10)) return false;
    const digito2 = calcularDigito(cnpj.slice(0, 13), pesos2);
    return digito2 === parseInt(cnpj[13], 10);
  }

  function validarDocumento() {
    const digitos = documentoInput.value.replace(/\D/g, "");
    if (digitos.length === 0) {
      mostrarErro(documentoInput, erroDocumentoEl, false);
      return true;
    }
    let valido;
    if (digitos.length === 11) valido = validarCPF(digitos);
    else if (digitos.length === 14) valido = validarCNPJ(digitos);
    else valido = false;
    mostrarErro(documentoInput, erroDocumentoEl, !valido);
    return valido;
  }

  documentoInput.addEventListener("input", function () {
    this.value = maskDocumento(this.value);
    if (this.classList.contains("invalid")) validarDocumento();
  });
  documentoInput.addEventListener("blur", validarDocumento);

  // ---------- Linhas dinâmicas (serviços / peças) ----------
  function createLineRow(placeholderText) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input type="text" placeholder="' +
      placeholderText +
      '"></td>' +
      '<td class="num"><input type="number" class="price" placeholder="0.00" step="0.01" min="0" inputmode="decimal"></td>' +
      '<td class="action"><button type="button" class="remove-line" title="Remover">×</button></td>';
    return tr;
  }

  function setupLineTable(
    bodyId,
    addBtnId,
    placeholderText,
    onChangeCallback,
  ) {
    const body = document.getElementById(bodyId);
    const addBtn = document.getElementById(addBtnId);

    function addRow(focusNew, prefill) {
      const row = createLineRow(placeholderText);
      body.appendChild(row);
      const descInput = row.querySelector('input[type="text"]');
      const priceInput = row.querySelector(".price");

      if (prefill) {
        descInput.value = prefill.descricao || "";
        priceInput.value =
          prefill.preco || prefill.preco === 0 ? prefill.preco : "";
      }

      priceInput.addEventListener("input", onChangeCallback);
      row.querySelector(".remove-line").addEventListener(
        "click",
        function () {
          row.remove();
          onChangeCallback();
        },
      );

      // Enter em qualquer um dos campos: se a linha atual estiver
      // preenchida (descrição + preço) e for a última linha, cria a próxima.
      function handleEnter(e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const filled =
          descInput.value.trim() !== "" &&
          priceInput.value.trim() !== "";
        const isLastRow = row === body.lastElementChild;
        if (filled && isLastRow) {
          addRow(true);
        } else if (e.target === descInput) {
          priceInput.focus();
        }
      }
      descInput.addEventListener("keydown", handleEnter);
      priceInput.addEventListener("keydown", handleEnter);

      if (focusNew) descInput.focus();
      onChangeCallback();
      return row;
    }

    addBtn.addEventListener("click", () => addRow(true));
    return { addRow, body };
  }

  const servicosTable = setupLineTable(
    "servicosBody",
    "addServico",
    "Ex: Formatação e reinstalação do sistema",
    updateTotals,
  );
  const pecasTable = setupLineTable(
    "pecasBody",
    "addPeca",
    "Ex: Memória RAM 8GB DDR4",
    updateTotals,
  );

  function sumTable(bodyId) {
    const body = document.getElementById(bodyId);
    let total = 0;
    body.querySelectorAll(".price").forEach((input) => {
      total += parsePrice(input);
    });
    return total;
  }

  function updateTotals() {
    const totalServicos = sumTable("servicosBody");
    const totalPecas = sumTable("pecasBody");
    const total = totalServicos + totalPecas;

    document.getElementById("subtotalServicos").textContent =
      formatBRL(totalServicos);
    document.getElementById("subtotalPecas").textContent =
      formatBRL(totalPecas);
    document.getElementById("bdServicos").textContent =
      formatBRL(totalServicos);
    document.getElementById("bdPecas").textContent = formatBRL(totalPecas);
    document.getElementById("totalGeral").textContent = formatBRL(total);
  }

  // ---------- Fotos com preview ----------
  const fotoInput = document.getElementById("fotoInput");
  const photoGrid = document.getElementById("photoGrid");
  const pendingPhotoFiles = new Map();

  function addPhotoThumb(dataUrl, file) {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML =
      '<img src="' +
      dataUrl +
      '" alt="Foto do serviço">' +
      '<button type="button" title="Remover">×</button>';
    thumb.dataset.src = dataUrl;
    if (file) {
      thumb.dataset.pending = "true";
      pendingPhotoFiles.set(thumb, file);
    }
    thumb
      .querySelector("button")
      .addEventListener("click", () => {
        if (thumb.dataset.pending === "true") URL.revokeObjectURL(thumb.dataset.src);
        pendingPhotoFiles.delete(thumb);
        thumb.remove();
      });
    photoGrid.appendChild(thumb);
  }

  fotoInput.addEventListener("change", function () {
    const files = Array.from(fotoInput.files).filter((file) => file.type.startsWith("image/"));
    fotoInput.value = "";
    if (!files.length) return;
    files.forEach((file) => addPhotoThumb(URL.createObjectURL(file), file));
    showToast(files.length + " imagem(ns) pronta(s) para enviar ao salvar a O.S.", "info");
  });

  function getPhotos() {
    return Array.from(photoGrid.querySelectorAll(".photo-thumb"))
      .filter((thumb) => thumb.dataset.pending !== "true")
      .map((thumb) => thumb.dataset.src);
  }

  async function uploadPendingPhotos() {
    const pendingThumbs = Array.from(photoGrid.querySelectorAll('.photo-thumb[data-pending="true"]'));
    if (!pendingThumbs.length) return;

    showToast("Enviando " + pendingThumbs.length + " imagem(ns) ao ImgBB...", "info");
    const urls = await Promise.all(pendingThumbs.map((thumb) => {
      const file = pendingPhotoFiles.get(thumb);
      if (!file) throw new Error("Não foi possível localizar uma imagem pendente.");
      return OSDatabase.uploadImage(file);
    }));

    pendingThumbs.forEach((thumb, index) => {
      URL.revokeObjectURL(thumb.dataset.src);
      thumb.dataset.src = urls[index];
      thumb.dataset.pending = "false";
      thumb.querySelector("img").src = urls[index];
      pendingPhotoFiles.delete(thumb);
    });
    showToast("Imagem(ns) enviada(s) com sucesso.", "success");
  }

  // ---------- Coleta de dados do formulário ----------
  function val(id) {
    const el = document.getElementById(id);
    return sanitizeText(el ? el.value.trim() : "");
  }

  function getTableRows(bodyId) {
    const rows = [];
    // verifica se a função de limpeza existe antes de usar
    if (typeof sanitizeText === "undefined") {
      sanitizeText = function (text) {
        return text ? text.replace(/<[^>]*>?/gm, "").trim() : "";
      };
    }
    document
      .getElementById(bodyId)
      .querySelectorAll("tr")
      .forEach((tr) => {
        const descRaw = tr.querySelector('input[type="text"]').value;
        const desc = sanitizeText(descRaw);
        const priceInput = tr.querySelector(".price");
        const price = parsePrice(priceInput);
        if (desc !== "" || price > 0)
          rows.push({ descricao: desc, preco: price });
      });
    return rows;
  }

  function collectData() {
    const statusBtn = document.querySelector("#statusToggle button.active");
    const servicos = getTableRows("servicosBody");
    const pecas = getTableRows("pecasBody");
    const totalServicos = servicos.reduce((s, r) => s + r.preco, 0);
    const totalPecas = pecas.reduce((s, r) => s + r.preco, 0);

    return {
      osNumero: val("osNumero"),
      status: statusBtn ? statusBtn.dataset.status : "Aberta",
      osData: val("osData"),
      osPrevisao: val("osPrevisao"),
      cliente: {
        nome: val("clienteNome"),
        telefone: val("clienteTelefone"),
        email: val("clienteEmail"),
        endereco: val("clienteEndereco"),
        documento: val("clienteDocumento")
      },
      tecnico: { nome: val("tecnicoNome"), contato: val("tecnicoContato") },
      equipamento: {
        tipo: val("equipTipo"),
        marca: val("equipMarca"),
        modelo: val("equipModelo"),
        serie: val("equipSerie"),
        senha: val("equipSenha"),
        acessorios: val("equipAcessorios")
      },
      problema: val("problemaDescricao"),
      diagnostico: val("diagnostico"),
      orcamento: val("orcamentoDescricao"),
      totalGeral: totalServicos + totalPecas,
      fotos: getPhotos(),
      servicos,
      pecas,
      totalServicos,
      totalPecas,
    };

    /* return {
  osNumero: val("osNumero"),
  status: statusBtn ? statusBtn.dataset.status : "Aberta",
  osData: val("osData"),
  osPrevisao: val("osPrevisao"),
  cliente: {
    nome: val("clienteNome"), telefone: val("clienteTelefone"), email: val("clienteEmail"),
    endereco: val("clienteEndereco"), documento: val("clienteDocumento")
  },
  tecnico: { nome: val("tecnicoNome"), contato: val("tecnicoContato") },
  equipamento: {
    tipo: val("equipTipo"), marca: val("equipMarca"), modelo: val("equipModelo"),
    serie: val("equipSerie"), senha: val("equipSenha"), acessorios: val("equipAcessorios")
  },
  problema: val("problemaDescricao"),
  diagnostico: val("diagnostico"),
  orcamento: val("orcamentoDescricao"),
  servicos, pecas, totalServicos, totalPecas,
  totalGeral: totalServicos + totalPecas,
  fotos: getPhotos()
}; */
  }

  // ---------- Carregar O.S. existente (modo edição) ----------
  function preencherFormulario(registro) {
    document.getElementById("osNumero").value = registro.osNumero || "";
    setStatus(registro.status || "Aberta");
    osDataInput.value = registro.osData || "";
    osPrevisaoInput.value = registro.osPrevisao || "";

    const c = registro.cliente || {};
    document.getElementById("clienteNome").value = c.nome || "";
    document.getElementById("clienteTelefone").value = c.telefone || "";
    document.getElementById("clienteEmail").value = c.email || "";
    document.getElementById("clienteEndereco").value = c.endereco || "";
    document.getElementById("clienteDocumento").value = c.documento || "";

    const t = registro.tecnico || {};
    document.getElementById("tecnicoNome").value = t.nome || "";
    document.getElementById("tecnicoContato").value = t.contato || "";

    const eq = registro.equipamento || {};
    document.getElementById("equipTipo").value = eq.tipo || "";
    document.getElementById("equipMarca").value = eq.marca || "";
    document.getElementById("equipModelo").value = eq.modelo || "";
    document.getElementById("equipSerie").value = eq.serie || "";
    document.getElementById("equipSenha").value = eq.senha || "";
    document.getElementById("equipAcessorios").value = eq.acessorios || "";

    document.getElementById("problemaDescricao").value =
      registro.problema || "";
    document.getElementById("diagnostico").value =
      registro.diagnostico || "";
    document.getElementById("orcamentoDescricao").value =
      registro.orcamento || "";

    document.getElementById("servicosBody").innerHTML = "";
    document.getElementById("pecasBody").innerHTML = "";
    (registro.servicos && registro.servicos.length
      ? registro.servicos
      : [{}]
    ).forEach((r) => servicosTable.addRow(false, r));
    (registro.pecas && registro.pecas.length
      ? registro.pecas
      : [{}]
    ).forEach((r) => pecasTable.addRow(false, r));

    Array.from(photoGrid.querySelectorAll('.photo-thumb[data-pending="true"]')).forEach((thumb) => {
      URL.revokeObjectURL(thumb.dataset.src);
      pendingPhotoFiles.delete(thumb);
    });
    photoGrid.innerHTML = "";
    (registro.fotos || []).forEach(addPhotoThumb);

    updateTotals();
    validarDatas();

    const badge = document.getElementById("editBadge");
    if (badge) {
      badge.textContent =
        "Editando O.S. nº " + (registro.osNumero || "sem número");
      badge.style.display = "flex";
    }
  }

  if (editId && window.OSDatabase) {
    let registro = null;
    try {
      registro = await OSDatabase.getById(editId);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível carregar a ordem de serviço.", "error");
    }
    if (registro) {
      preencherFormulario(registro);
    } else {
      if (window.showToast)
        showToast(
          "Ordem de serviço não encontrada. Criando uma nova.",
          "error",
        );
      servicosTable.addRow(false);
      pecasTable.addRow(false);
      registroAtualId = null;
    }
  } else {
    servicosTable.addRow(false);
    pecasTable.addRow(false);
  }

  updateTotals();

  // ---------- Salvar no Supabase ----------
  async function salvarOS(mostrarToast) {
    if (!window.OSDatabase) {
      alert(
        "Não foi possível acessar a configuração do Supabase. Verifique config.js e db.js.",
      );
      return null;
    }
    if (!validarDatas()) {
      if (window.showToast)
        showToast(
          "A previsão de entrega não pode ser antes da data de entrada.",
          "error",
        );
      osPrevisaoInput.focus();
      return null;
    }
    try {
      await uploadPendingPhotos();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível enviar as imagens. A O.S. não foi salva.", "error");
      return null;
    }
    const dados = collectData();
    const agora = new Date().toISOString();
    let registroExistente = null;
    try {
      registroExistente = registroAtualId ? await OSDatabase.getById(registroAtualId) : null;
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível consultar a ordem de serviço.", "error");
      return null;
    }
    const registro = Object.assign({}, dados, {
      id: registroAtualId || OSDatabase.generateId(),
      criadoEm: registroExistente
        ? registroExistente.criadoEm || agora
        : agora,
      atualizadoEm: agora,
    });

    let salvo = null;
    try {
      salvo = await OSDatabase.upsert(registro);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível salvar a ordem de serviço.", "error");
      return null;
    }
    if (!salvo) {
      alert(
        "Não foi possível salvar a ordem de serviço no Supabase.",
      );
      return null;
    }

    registroAtualId = salvo.id;

    const badge = document.getElementById("editBadge");
    if (badge) {
      badge.textContent =
        "Editando O.S. nº " + (salvo.osNumero || "sem número");
      badge.style.display = "flex";
    }

    if (mostrarToast !== false && window.showToast)
      showToast("Ordem de serviço salva com sucesso.", "success");
    return salvo;
  }

  document.getElementById("btnSalvar").addEventListener("click", async function () {
    await salvarOS(true);
  });

  // ---------- Modal de escolha (gerar documento) ----------
  const modalOverlay = document.getElementById("modalOverlay");

  function abrirModal() {
    if (!validarDatas()) {
      if (window.showToast)
        showToast(
          "A previsão de entrega não pode ser antes da data de entrada.",
          "error",
        );
      osPrevisaoInput.focus();
      return;
    }
    modalOverlay.classList.add("open");
  }
  function fecharModal() {
    modalOverlay.classList.remove("open");
  }

  document.getElementById("btnGerar").addEventListener("click", abrirModal);
  document
    .getElementById("modalCancelar")
    .addEventListener("click", fecharModal);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) fecharModal();
  });

  document
    .getElementById("opcaoExcel")
    .addEventListener("click", function () {
      window.gerarExcel(collectData());
      fecharModal();
    });
  document.getElementById("opcaoPdf").addEventListener("click", function () {
    window.gerarPdf(collectData());
    fecharModal();
  });
  document
    .getElementById("opcaoImprimir")
    .addEventListener("click", function () {
      fecharModal();
      window.print();
    });

  // ---------- Ações ----------
  document.getElementById("btnLimpar").addEventListener("click", function () {
    if (
      !confirm(
        "Tem certeza que deseja limpar todos os campos desta ordem de serviço?",
      )
    )
      return;
    document
      .querySelectorAll(
        'input[type="text"], input[type="tel"], input[type="email"], textarea',
      )
      .forEach((el) => (el.value = ""));
    document.getElementById("servicosBody").innerHTML = "";
    document.getElementById("pecasBody").innerHTML = "";
    servicosTable.addRow(false);
    pecasTable.addRow(false);
    Array.from(photoGrid.querySelectorAll('.photo-thumb[data-pending="true"]')).forEach((thumb) => {
      URL.revokeObjectURL(thumb.dataset.src);
      pendingPhotoFiles.delete(thumb);
    });
    photoGrid.innerHTML = "";
    osDataInput.value = hoje;
    setStatus("Aberta");
    validarDatas();
    updateTotals();

    registroAtualId = null;
    const badge = document.getElementById("editBadge");
    if (badge) badge.style.display = "none";

    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "index.html");
    }
  });
})();
