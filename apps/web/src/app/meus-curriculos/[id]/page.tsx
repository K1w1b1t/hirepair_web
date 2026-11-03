import { ResumeLibrary } from '../resume-library';
import '../../conversa/conversa.css';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResumeLibrary id={id} />;
}
