export default function TermoConsentimento() {
  return (
    <div className="text-sm text-slate-700">
      <h2 className="mb-1 text-center text-lg font-bold text-slate-900">
        Termo de Consentimento Livre e Esclarecido (TCLE)
      </h2>

      <p className="mb-4 text-center text-xs text-slate-500">
        Apêndice A
      </p>

      <div className="space-y-1">
        <p>
          <span className="font-semibold">Título da Pesquisa:</span> Prontuário
          Eletrônico do Estudante (PEE): testagem e remodelamento de um protótipo
          desenvolvido pelo IFPE no Agreste Pernambucano
        </p>
        <p>
          <span className="font-semibold">Pesquisadora Responsável:</span> Sayane
          Marlla Silva Leite Montenegro
        </p>
        <p>
          <span className="font-semibold">Instituição Proponente:</span> Instituto
          Federal de Educação, Ciência e Tecnologia de Pernambuco (IFPE) – Campus
          Belo Jardim
        </p>
        <p>
          <span className="font-semibold">Contato da Pesquisadora:</span>{" "}
          sayane.marlla@belojardim.ifpe.edu.be, (81) 97306-3357
        </p>
      </div>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">1. Apresentação da pesquisa</h3>
        <p>
          Você está sendo convidado(a) a participar de uma pesquisa científica que
          tem como objetivo testar e avaliar um sistema informatizado denominado
          Prontuário Eletrônico do Estudante (PEE), voltado ao registro de
          informações de saúde e educação no ambiente escolar.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">2. Objetivos</h3>
        <p>
          Avaliar a usabilidade, funcionalidade, segurança e aplicabilidade do
          sistema PEE por meio de simulação realística, visando identificar
          possíveis melhorias e adequações.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">3. Procedimentos da pesquisa</h3>
        <p>
          Caso aceite participar, você será submetido(a) aos seguintes procedimentos:
        </p>
        <ul className="mt-1 list-disc pl-5">
          <li>
            Participação em simulação realística em ambiente controlado (laboratório);
          </li>
          <li>
            Utilização do sistema PEE para execução de tarefas previamente definidas;
          </li>
          <li>
            Resposta a questionários estruturados sobre usabilidade e satisfação;
          </li>
          <li>
            Registro de dados por meio de gravação de tela e/ou vídeo, além de logs
            do sistema.
          </li>
        </ul>
        <p className="mt-1">
          A participação terá duração aproximada de 60 a 90 minutos, em única sessão.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">4. Riscos e desconfortos</h3>
        <p>Os riscos são mínimos e podem incluir:</p>
        <ul className="mt-1 list-disc pl-5">
          <li>Desconforto no uso de tecnologias digitais;</li>
          <li>Cansaço durante a realização das atividades;</li>
          <li>Eventual dificuldade na execução das tarefas propostas.</li>
        </ul>
        <p className="mt-1">
          Caso ocorra qualquer desconforto, o(a) participante poderá interromper sua
          participação a qualquer momento.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">5. Benefícios</h3>
        <p>
          Não há benefícios diretos ao participante. Entretanto, sua participação
          contribuirá para o desenvolvimento e aprimoramento de uma tecnologia
          inovadora na interface entre saúde e educação.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">
          6. Garantia de sigilo e confidencialidade
        </h3>
        <p>
          As informações coletadas serão mantidas em sigilo e utilizadas
          exclusivamente para fins científicos. Os dados serão codificados,
          garantindo o anonimato dos participantes. Os registros (vídeo, tela e logs)
          serão armazenados em ambiente seguro, com acesso restrito à equipe de
          pesquisa.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">7. Participação voluntária</h3>
        <p>
          A participação nesta pesquisa é totalmente voluntária. Você pode recusar-se
          a participar ou desistir a qualquer momento, sem qualquer penalidade ou
          prejuízo.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">8. Custos e ressarcimentos</h3>
        <p>
          A participação não implicará em custos para o participante, assim como não
          haverá pagamento ou compensação financeira.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">9. Indenização</h3>
        <p>
          Em caso de danos decorrentes da participação na pesquisa, o participante
          terá direito à assistência integral e à indenização, conforme previsto na
          legislação vigente.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">10. Esclarecimentos</h3>
        <p>
          Você poderá esclarecer quaisquer dúvidas sobre a pesquisa com a
          pesquisadora responsável. Para dúvidas sobre seus direitos como
          participante de pesquisa, você poderá entrar em contato com o Comitê de
          Ética em Pesquisa (CEP) da instituição.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="font-semibold text-slate-900">
          11. Consentimento livre e esclarecido
        </h3>
        <p>
          Declaro que fui devidamente informado(a) sobre os objetivos, procedimentos,
          riscos e benefícios desta pesquisa, e que todas as minhas dúvidas foram
          esclarecidas. Concordo voluntariamente em participar deste estudo.
        </p>
      </section>
    </div>
  );
}
