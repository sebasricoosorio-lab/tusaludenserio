// Página principal: toda la interfaz vive en el componente de cliente, que
// consulta la API con la sesión del usuario. No se incrusta ningún dato aquí.
import PortalApp from '@/components/PortalApp';

export default function Home() {
  return <PortalApp />;
}
