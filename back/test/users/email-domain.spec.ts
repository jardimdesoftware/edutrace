import { isInstitutionalHostedAccount } from 'src/users/email-domain';

describe('isInstitutionalHostedAccount', () => {
  it.each([
    ['eriak.cardeal@belojardim.ifpe.edu.br', 'belojardim.ifpe.edu.br'],
    ['aluno@discente.ifpe.edu.br', 'discente.ifpe.edu.br'],
    ['pessoa@ifpe.edu.br', 'ifpe.edu.br'],
    ['pessoa@belojardim.ifpe.edu.br', 'ifpe.edu.br'],
    ['Pessoa@BeloJardim.IFPE.edu.br', 'BELOJARDIM.ifpe.edu.br'],
  ])('should accept %s with hd %s', (email, hd) => {
    expect(isInstitutionalHostedAccount(email, hd)).toBe(true);
  });

  it.each([
    ['pessoa@belojardim.ifpe.edu.br', undefined],
    ['pessoa@belojardim.ifpe.edu.br', ''],
    ['pessoa@belojardim.ifpe.edu.br', 'outra.edu.br'],
    ['pessoa@outra.edu.br', 'ifpe.edu.br'],
    ['pessoa@outra.edu.br', 'outra.edu.br'],
    ['pessoa@gmail.com', 'ifpe.edu.br'],
    ['pessoa@evilifpe.edu.br', 'ifpe.edu.br'],
    ['pessoa@ifpe.edu.br.evil.com', 'ifpe.edu.br'],
    ['pessoa@ifpe.edu.br', 'belojardim.ifpe.edu.br'],
    ['pessoa@xifpe.edu.br', 'xifpe.edu.br'],
    ['sem-arroba', 'ifpe.edu.br'],
  ])('should refuse %s with hd %s', (email, hd) => {
    expect(isInstitutionalHostedAccount(email, hd)).toBe(false);
  });
});
