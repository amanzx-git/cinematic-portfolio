import { useCallback, useReducer } from 'react'
import GameLab from '../game/GameLab'
import type { GameScreen } from '../game/session'
import { RecruiterCinematic } from './RecruiterCinematic'
import { storyTransition, STORY_VIDEOS } from './story'
import './recruiter.css'

export default function RecruiterExperience({ onPresented }: { onPresented: () => void }) {
  const [stage, dispatch] = useReducer(storyTransition, 'opening')
  const screenChanged = useCallback((screen: GameScreen) => {
    if (screen === 'playing') dispatch('start')
    if (screen === 'complete') dispatch('escape-finished')
  }, [])
  const openingFinished = useCallback(() => dispatch('opening-finished'), [])
  const reunionFinished = useCallback(() => dispatch('reunion-finished'), [])
  return <div className="recruiter-experience" data-story-stage={stage}>
    {stage !== 'opening' && <div inert={stage === 'reunion'}>
      <GameLab production onPresented={onPresented} onScreenChange={screenChanged}
        completionVisible={stage === 'completion'} inputEnabled={stage !== 'reunion' && stage !== 'completion'} onReplay={() => dispatch('replay')} />
    </div>}
    {stage === 'opening' && <RecruiterCinematic key="opening" source={STORY_VIDEOS.opening} title="Opening"
      onDone={openingFinished} onPresented={onPresented} />}
    {stage === 'reunion' && <RecruiterCinematic key="reunion" source={STORY_VIDEOS.reunion} title="Reunion"
      onDone={reunionFinished} onPresented={onPresented} />}
  </div>
}
