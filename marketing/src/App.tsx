import { useLenis } from './lib/lenis';
import { Nav } from './components/Nav';
import { Hero } from './sections/Hero';
import { IntroMosaic } from './sections/IntroMosaic';
import { ForecastEngine } from './sections/ForecastEngine';
import { Roles } from './sections/Roles';
import { StatMoment } from './sections/StatMoment';
import { SurgeAction } from './sections/SurgeAction';
import { Modules } from './sections/Modules';
import { Coverage } from './sections/Coverage';
import { Compliance } from './sections/Compliance';
import { Worldwide } from './sections/Worldwide';
import { Closing } from './sections/Closing';

export function App() {
  useLenis();

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <Hero />
      <IntroMosaic />
      <ForecastEngine />
      <Roles />
      <StatMoment />
      <SurgeAction />
      <Modules />
      <Coverage />
      <Compliance />
      <Worldwide />
      <Closing />
    </main>
  );
}
