import type { PdfInput } from '../src/app/conversa/_lib/pdf-contract';
import type { ResumeSection } from '@hirepair/interview-engine';

// Expected presentation fixtures derived from authorized local references.
// These are manually authored benchmarks, never outputs attributed to the AI.
function section(id: string, title: string, lines: string[]): ResumeSection {
  return {
    id,
    title,
    experienceId: [
      'project',
      'apprentice',
      'assistant',
      'current',
      'finance',
      'geo',
      'support',
      'intern',
    ].includes(id)
      ? id
      : null,
    units: lines.map((text, index) => ({
      id: `${id}-${index}`,
      text,
      factIds: [],
      criterionIds: [],
    })),
  };
}
export const PRESENTATION_REFERENCES: Array<{
  id: string;
  expectedPages: number;
  input: PdfInput;
}> = [
  {
    id: 'engineering-entry',
    expectedPages: 1,
    input: {
      archetype: 'A_FIRST_JOB',
      profile: {
        name: 'Pessoa Exemplo — Engenharia',
        professionalTitle: 'Estágio em Engenharia Mecânica',
        email: 'engenharia@example.com',
        phone: '(11) 00000-0000',
        location: 'Cidade Exemplo, SP',
        linkedin: 'linkedin.com/in/perfil-exemplo',
        github: 'github.com/perfil-exemplo',
        portfolio: 'https://example.com/portfolio',
        confirmed: true,
      },
      document: {
        version: 1,
        explanation:
          'Referência esperada de apresentação, anonimizada e inserida manualmente. Não gerada por IA.',
        sections: [
          section('objective', 'Objetivo profissional', [
            'Estágio em engenharia mecânica, com interesse em suporte a projetos, desenho e documentação técnica. Estudante de engenharia automotiva com experiência prática em manutenção e diagnóstico e participação no desenvolvimento estrutural de um veículo acadêmico.',
          ]),
          section('education', 'Formação acadêmica e cursos', [
            'Bacharelado em Engenharia Automotiva — Universidade Exemplo | 2024–2029 | Cursando.',
            'Mecânica automotiva — Escola Técnica Exemplo | Cursando. Formação complementar em veículos híbridos e elétricos e características de motores a combustão.',
            'Treinamentos em direção, suspensão, controle de chassi e componentes de sistemas automotivos.',
          ]),
          section('project', 'Projeto acadêmico — desenvolvimento de veículo | Em andamento', [
            'Participa do desenvolvimento da estrutura mecânica de um protótipo, aplicando conceitos de engenharia e interpretação de desenho técnico.',
            'Colabora nas decisões de projeto, na análise dos requisitos e na solução de problemas do veículo acadêmico.',
          ]),
          section('apprentice', 'Jovem aprendiz — Concessionária Horizonte | 2025–atual', [
            'Apoia manutenções preventivas e corretivas, diagnóstico e rastreamento de falhas em conjunto com os profissionais responsáveis.',
            'Tem contato prático com sistemas de veículos híbridos e elétricos, complementando a formação técnica.',
            'Atende clientes e apoia rotinas de estoque, notas fiscais e organização de peças.',
          ]),
          section('assistant', 'Auxiliar de mecânica — Oficina Azul | 2022–2025', [
            'Executou manutenções preventivas e corretivas e participou da identificação de defeitos e análise do funcionamento de componentes.',
            'Realizou testes de rodagem e conversou com clientes para apoiar a identificação de problemas e a definição dos serviços necessários.',
          ]),
          section('skills', 'Competências e idiomas', [
            'Desenho técnico e interpretação de documentação; fundamentos de mecânica aplicada; diagnóstico e análise de problemas; organização e comunicação técnica.',
            'Trabalho em equipe em projetos de engenharia. Inglês avançado.',
          ]),
        ],
      },
    },
  },
  {
    id: 'software-career',
    expectedPages: 2,
    input: {
      archetype: 'E_SPECIALIST',
      profile: {
        name: 'Pessoa Exemplo — Software',
        professionalTitle: 'Engenheiro de Software | Backend e Cloud',
        email: 'software@example.com',
        phone: '(11) 00000-0000',
        location: 'Cidade Exemplo, SP',
        linkedin: 'linkedin.com/in/perfil-exemplo',
        github: 'github.com/perfil-exemplo',
        portfolio: 'https://example.com/portfolio',
        confirmed: true,
      },
      document: {
        version: 1,
        explanation:
          'Referência esperada de apresentação, anonimizada e inserida manualmente. Não gerada por IA.',
        sections: [
          section('summary', 'Resumo profissional', [
            'Engenheiro de software com experiência em backend, sistemas distribuídos e infraestrutura cloud nos setores financeiro, educacional e geoespacial. Atuação no ciclo de desenvolvimento: arquitetura, implementação, testes, deploy, observabilidade e sustentação de serviços.',
          ]),
          section('stack', 'Competências técnicas', [
            'Backend e APIs: Python, Node.js, NestJS, TypeScript, Django, Flask, FastAPI, APIs REST e GraphQL.',
            'Dados e processamento: PostgreSQL, PostGIS, Redis, BullMQ, modelagem relacional, otimização de consultas, filas e processamento assíncrono.',
            'Cloud e entrega: AWS, ECS, EKS, RDS, Docker, Kubernetes, Terraform, GitHub Actions, CI/CD e Git.',
            'Engenharia: testes automatizados, observabilidade, análise de causa raiz, sistemas distribuídos, performance e mentoria técnica.',
          ]),
          section('current', 'Engenheiro de Software — Empresa Horizonte | 2025–atual', [
            'Desenvolve serviços backend e fluxos assíncronos para integrações de atendimento por mensagens, e-mail e voz, incluindo ferramentas de simulação e atendimento com IA.',
            'Reestruturou a infraestrutura AWS com Terraform, ajustando o dimensionamento dos recursos e o processamento por filas para reduzir custos de operação.',
            'Mantém ambientes com ECS, RDS e GitHub Actions e melhora o monitoramento de erros, os logs operacionais e os alertas de disponibilidade.',
            'Criou uma estrutura de avaliação automatizada para fluxos de IA, verificando ferramentas, contexto e respostas para identificar regressões.',
          ]),
          section('finance', 'Engenheiro de Software — Plataforma Financeira Exemplo | 2024–2025', [
            'Desenvolveu APIs em Python e sistemas de detecção de fraude bancária em tempo real, com atenção a latência, confiabilidade e concorrência.',
            'Trabalhou com arquitetura em camadas e processamento por filas para sustentar o volume de requisições e os requisitos operacionais dos serviços.',
            'Refatorou componentes da API antifraude e do motor de regras e implementou testes de regressão com dados representativos para reduzir a complexidade de manutenção.',
            'Automatizou a entrega de serviços de machine learning e trabalhou em SDKs de segurança e identificação de dispositivos para diferentes plataformas.',
          ]),
          section('geo', 'Engenheiro de Software — Tecnologia Geoespacial Exemplo | 2023–2024', [
            'Desenvolveu serviços Python com Django, Flask e FastAPI e pipelines distribuídos com Kubernetes e PostGIS para processar dados geográficos e imagens de satélite.',
            'Implementou processamento baseado em filas para classificação de áreas e operações assíncronas.',
            'Modelou dados relacionais, índices espaciais e operações de sobreposição e busca para produtos de monitoramento ambiental e risco bancário.',
          ]),
          section('support', 'Analista de Suporte a Sistemas — Educação Exemplo | 2021–2023', [
            'Atuou em sistemas de produção com Ruby on Rails, Elixir e Vue.js, corrigindo falhas e desenvolvendo funcionalidades em jornadas comerciais.',
            'Coordenou o trabalho da equipe de suporte, a resolução de incidentes e as melhorias de processos. Trabalhou em correções de causa raiz e automação para reduzir a demanda recorrente.',
          ]),
          section('intern', 'Estágio em desenvolvimento — Indústria Exemplo | 2019–2020', [
            'Desenvolveu ferramentas de simulação de desempenho, viabilidade de rotas, carga e custos operacionais para propostas de engenharia de vendas.',
          ]),
          section('education', 'Formação e certificação', [
            'Análise e Desenvolvimento de Sistemas — Universidade Exemplo | Cursando. Estudos anteriores em Ciência e Tecnologia.',
            'AWS Certified Solutions Architect — Associate.',
          ]),
          section('languages', 'Idiomas', ['Português nativo | Inglês fluente.']),
        ],
      },
    },
  },
];
