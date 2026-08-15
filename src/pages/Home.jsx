import BackgroundDecor from '../components/decorative/BackgroundDecor'
import CompanionCard from '../components/home/CompanionCard'
import CycleInsightsCard from '../components/home/CycleInsightsCard'
import CycleStatusCard from '../components/home/CycleStatusCard'
import GreetingHero from '../components/home/GreetingHero'
import MoodSelector from '../components/home/MoodSelector'
import QuickActionsCard from '../components/home/QuickActionsCard'
import WellnessCard from '../components/home/WellnessCard'

function Home() {
  return (
    <div className="relative space-y-6">
      <BackgroundDecor />
      <GreetingHero />
      <CycleStatusCard />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MoodSelector />
        <CycleInsightsCard />
      </div>
      <CompanionCard />
      <WellnessCard />
      <QuickActionsCard />
    </div>
  )
}

export default Home
