import { BlockShowcase } from './BlockShowcase'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { UsageExample } from './UsageExample'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-page">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <BlockShowcase />
        <UsageExample />
      </main>
      <SiteFooter />
    </div>
  )
}
