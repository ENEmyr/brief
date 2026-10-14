import { BlockTable } from './BlockTable'
import { ClosingBand } from './ClosingBand'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { ReaderPreview } from './ReaderPreview'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { SmallThings } from './SmallThings'
import { UsageExample } from './UsageExample'

// leading-[normal]: B-Landing sets no line height outside its type styles.
export function LandingPage() {
  return (
    <div className="min-h-screen bg-page leading-[normal] text-text">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <UsageExample />
        <ReaderPreview />
        <BlockTable />
        <SmallThings />
        <ClosingBand />
      </main>
      <SiteFooter />
    </div>
  )
}
