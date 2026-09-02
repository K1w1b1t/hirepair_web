module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Torna o escopo (ex: número da issue ou módulo) obrigatório
    'scope-empty': [2, 'never'],
    // Tipos convencionais permitidos
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'test', 'perf'],
    ],
    // Assunto não pode terminar com ponto final
    'subject-full-stop': [2, 'never', '.'],
  },
};
