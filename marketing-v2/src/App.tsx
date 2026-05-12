import { useLenis } from './lib/lenis';
import { Nav } from './components/Nav';
import { DocumentaryChrome } from './components/DocumentaryChrome';
import { DocumentaryBackdrop } from './components/DocumentaryBackdrop';
import { Hero } from './sections/Hero';
import { IntroMosaic } from './sections/IntroMosaic';
import { ForecastEngine } from './sections/ForecastEngine';
import { Roles } from './sections/Roles';
import { StatMoment } from './sections/StatMoment';
import { SurgeAction } from './sections/SurgeAction';
import { WhyView } from './sections/WhyView';
import { Coverage } from './sections/Coverage';
import { BriefMe } from './sections/BriefMe';
import { Compliance } from './sections/Compliance';
import { Closing } from './sections/Closing';

export function App() {
  useLenis();

  return (
    // Backdrop is rendered as a SIBLING of main (not a child) so the
    // main wrapper's stacking context (z-index: 2 in documentary mode)
    // sits cleanly above the backdrop's fixed z-index: 1. If the
    // backdrop lived inside main, its z-index would be relative to its
    // siblings inside main — and would cover the page content.
    <>
      <DocumentaryBackdrop />
      <main style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Nav />
        <DocumentaryChrome />
        <Hero />
        <IntroMosaic />
        <ForecastEngine />
        <Roles />
        <StatMoment />
        <SurgeAction />
        <WhyView />
        <Coverage />
        <BriefMe />
        <Compliance />
        <Closing />
      </main>
    </>
  );
}
