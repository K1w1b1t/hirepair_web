import type { Metadata } from 'next';
import { ConversationPageClient } from './_components/conversation-page-client';

export const metadata: Metadata = {
  title: 'Conversa | HirePair',
  description: 'Monte seu currículo com perguntas simples, uma etapa de cada vez.',
  alternates: { canonical: '/conversa' },
};

export default function ConversationPage() {
  return <ConversationPageClient />;
}
