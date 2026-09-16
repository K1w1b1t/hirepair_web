import './conversa.css';
import { ConversationAnalytics } from '../../analytics/conversation-analytics';

export default function ConversationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ConversationAnalytics />
      {children}
    </>
  );
}
