import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorDia,
  chaveDoDia,
  diasDaSemana,
  faixaDeHoras,
  posicaoDoBloco,
  inicioDaSemana,
  intervaloDaSemana,
  linhasDoPdf,
  nomeDoArquivoDaAgenda,
  paraIso,
  podeVerAgenda,
  validarHorario,
  type Atendimento,
} from "./agenda";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

// As datas são montadas no horário local, como a tela faz, para o teste não
// depender do fuso da máquina.
function atendimento(id: number, inicio: Date, fim: Date, nome = "Maria", notes: string | null = null): Atendimento {
  return {
    id,
    starts_at: inicio.toISOString(),
    ends_at: fim.toISOString(),
    notes,
    student: { id: 20 + id, full_name: nome, email: `${nome.toLowerCase()}@edutrace.com` },
  };
}

describe("podeVerAgenda", () => {
  it("libera só o Professor do AEE", () => {
    assert.equal(podeVerAgenda([PROFESSOR_AEE]), true);
    assert.equal(podeVerAgenda([PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
  });

  it("nega os demais perfis, inclusive o administrador", () => {
    for (const papel of [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE]) {
      assert.equal(podeVerAgenda([papel]), false);
    }
  });
});

describe("inicioDaSemana", () => {
  it("volta à segunda-feira para qualquer dia da semana", () => {
    // 2026-11-25 é quarta-feira; a segunda é 2026-11-23.
    assert.equal(chaveDoDia(inicioDaSemana(new Date(2026, 10, 25, 15, 30))), "2026-11-23");
    assert.equal(chaveDoDia(inicioDaSemana(new Date(2026, 10, 23))), "2026-11-23");
  });

  it("trata o domingo como último dia da semana", () => {
    assert.equal(chaveDoDia(inicioDaSemana(new Date(2026, 10, 29))), "2026-11-23");
  });

  it("zera a hora", () => {
    const inicio = inicioDaSemana(new Date(2026, 10, 25, 15, 30));
    assert.equal(inicio.getHours(), 0);
    assert.equal(inicio.getMinutes(), 0);
  });
});

describe("diasDaSemana e intervaloDaSemana", () => {
  const inicio = new Date(2026, 10, 23);

  it("devolve sete dias consecutivos, atravessando o fim do mês", () => {
    const chaves = diasDaSemana(new Date(2026, 10, 30)).map(chaveDoDia);
    assert.deepEqual(chaves, [
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
  });

  it("o intervalo vai da segunda à segunda seguinte", () => {
    const { from, to } = intervaloDaSemana(inicio);
    assert.equal(from, inicio.toISOString());
    assert.equal(to, new Date(2026, 10, 30).toISOString());
  });
});

describe("paraIso", () => {
  it("converte data e hora locais no instante ISO", () => {
    assert.equal(paraIso("2026-11-23", "14:30"), new Date(2026, 10, 23, 14, 30).toISOString());
  });
});

describe("validarHorario", () => {
  const valido = { data: "2026-11-23", inicio: "09:00", fim: "10:00", observacao: "" };

  it("aceita um horário válido", () => {
    assert.equal(validarHorario(valido), null);
  });

  it("exige data, início e fim", () => {
    assert.match(validarHorario({ ...valido, data: "" }) ?? "", /Informe/);
    assert.match(validarHorario({ ...valido, fim: "" }) ?? "", /Informe/);
  });

  it("recusa fim igual ou anterior ao início", () => {
    assert.match(validarHorario({ ...valido, fim: "09:00" }) ?? "", /depois do início/);
    assert.match(validarHorario({ ...valido, fim: "08:00" }) ?? "", /depois do início/);
  });

  it("recusa observação acima de 500 caracteres", () => {
    assert.match(validarHorario({ ...valido, observacao: "a".repeat(501) }) ?? "", /500/);
    assert.equal(validarHorario({ ...valido, observacao: "a".repeat(500) }), null);
  });
});

describe("agruparPorDia", () => {
  it("agrupa pelo dia local e mantém a ordem recebida", () => {
    const lista = [
      atendimento(1, new Date(2026, 10, 23, 9), new Date(2026, 10, 23, 10)),
      atendimento(2, new Date(2026, 10, 23, 11), new Date(2026, 10, 23, 12)),
      atendimento(3, new Date(2026, 10, 24, 9), new Date(2026, 10, 24, 10)),
    ];

    const grupos = agruparPorDia(lista);

    assert.deepEqual(grupos["2026-11-23"].map((a) => a.id), [1, 2]);
    assert.deepEqual(grupos["2026-11-24"].map((a) => a.id), [3]);
  });

  it("devolve objeto vazio sem atendimentos", () => {
    assert.deepEqual(agruparPorDia([]), {});
  });
});

describe("linhasDoPdf", () => {
  it("monta data, horário, estudante e observação, com observação vazia quando não há", () => {
    const linhas = linhasDoPdf([
      atendimento(1, new Date(2026, 10, 23, 9), new Date(2026, 10, 23, 10, 30), "Maria", "Leitura"),
      atendimento(2, new Date(2026, 10, 23, 11), new Date(2026, 10, 23, 12), "João"),
    ]);

    assert.equal(linhas.length, 2);
    assert.equal(linhas[0][1], "09:00 às 10:30");
    assert.equal(linhas[0][2], "Maria");
    assert.equal(linhas[0][3], "Leitura");
    assert.equal(linhas[1][3], "");
  });
});

describe("nomeDoArquivoDaAgenda", () => {
  it("usa a segunda-feira da semana no nome", () => {
    assert.equal(nomeDoArquivoDaAgenda(new Date(2026, 10, 23)), "Agenda_2026-11-23.pdf");
  });
});

describe("grade da semana", () => {
  const dia = (h: number, min = 0) => new Date(2026, 10, 23, h, min);

  it("usa a faixa de 07h às 19h quando não há atendimento fora dela", () => {
    assert.deepEqual(faixaDeHoras([]), { inicio: 7, fim: 19 });
    assert.deepEqual(faixaDeHoras([atendimento(1, dia(9), dia(10))]), { inicio: 7, fim: 19 });
  });

  it("amplia a faixa para caber um atendimento cedo ou tarde", () => {
    const faixa = faixaDeHoras([atendimento(1, dia(6, 30), dia(7, 30)), atendimento(2, dia(19), dia(20, 15))]);
    assert.deepEqual(faixa, { inicio: 6, fim: 21 });
  });

  it("mede topo e altura do bloco em minutos a partir da primeira hora", () => {
    assert.deepEqual(posicaoDoBloco(atendimento(1, dia(9, 30), dia(10, 45)), 7), { topo: 150, altura: 75 });
  });

  it("dá altura mínima ao bloco muito curto", () => {
    assert.equal(posicaoDoBloco(atendimento(1, dia(9), dia(9, 5)), 7).altura, 15);
  });
});
