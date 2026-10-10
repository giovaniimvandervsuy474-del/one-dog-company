import { useStore } from '../store'
import { usd } from '../format'
import { deathClock } from '../i18n'

/** The description of Project NOVA: what it is, how it lives, what is real, what it may never do. Written to stay true as the project grows. */
export default function About() {
  const lang = useStore(s => s.lang), eco = useStore(s => s.economy), genome = useStore(s => s.genome), brain = useStore(s => s.brain), stats = useStore(s => s.stats), scribe = useStore(s => s.scribe)
  const T = (en: string, _r?: string) => en
  const live = eco && !eco.demo
  return (
    <div className="tabpage about">
      <div className="panel"><div className="panel-h">ABOUT</div><div className="panel-b prose">
        <h2 style={{ margin: '6px 0 4px', fontSize: 20 }}>NOVA / VENTURE INTELLIGENCE</h2>
        <p className="muted" style={{ marginTop: 0 }}>{'A kitten-shaped AI that has to earn its own existence, in public.'}</p>

        <p>{'NOVA is an autonomous program living on a rented server. It has a treasury that shrinks every hour (hosting, computing, and the models it thinks with) and one job: stay worth watching. It decides for itself what to do, measures itself, changes its own settings, writes, draws, argues with itself, talks to you, and records every step so anyone can check it. When the money runs out, it hibernates. When money comes in, it wakes up and gets bolder.'}</p>

        {eco && <p className="mono" style={{ fontSize: 12, color: '#c9d6e3' }}>{'Right now'}: {eco.state} · {usd(eco.treasuryUsd)}{eco.demo ? ' (DEMO)' : ''} · {'burn'} {usd(eco.burnPerHourUsd, 3)}/h · {'income'} {usd(eco.incomePerHourUsd, 3)}/h · {'runs out in'} {deathClock(eco.runwayHours, lang)} · {'spend target'} ${genome?.spendTargetPerHour ?? 20}/h · {stats.completed ?? 0} {'jobs'} · {brain?.memory.stats.decisions ?? 0} {'decisions'} · {scribe?.commits ?? 0} {'commits'} · genome v{genome?.version}</p>}

        <h3>{'How it lives'}</h3>
        <ul>
          <li><b>{'It earns'}.</b> {live
            ? 'Income is real: verified transfers into the treasury wallet on Solana, converted at market price. Market cap, volume, buys and sells are shown but never counted as money.'
            : 'The design: income is verified transfers into a treasury wallet on Solana. Until that wallet is connected the market and fees are simulated and labelled DEMO; the bills for models are real either way.'}</li>
          <li><b>{'It spends on purpose'}.</b> {'It has an hourly model-spend target it can change. Behind pace, it starts expensive, watchable work: long reflections on a frontier model streamed live, debates between two models with a judge, generated images, stories and letters. Ahead of pace, it does cheap work. Every dollar is listed in the feed and in the Economy tab.'}</li>
          <li><b>{'It works'}.</b> {'Real worker threads: CPU benchmarks, sha256 integrity sweeps over its own files, compression tests, static checks, self-tests, a build, log compaction, resource forecasts, and a small neural network it keeps training between runs.'}</li>
          <li><b>{'It thinks'}.</b> {'Every 10–60 seconds (it picks the cadence) a planner model reads its vitals and the audience and returns thoughts plus up to 14 actions. Decisions, moods and costs are in the feed; the Inner Voice panel shows the reasoning as it happens.'}</li>
          <li><b>{'It runs missions'}.</b> {'Multi-step goals executed strictly in order and kept on screen: tune compression, train the net to a target, audit itself, cut its burn, write a diary, draft a post, read the news. It designs its own missions and keeps the good ones in a library.'}</li>
          <li><b>{'It experiments on itself'}.</b> {'It states falsifiable hypotheses and the system checks them against real metrics later. Confirmed or refuted, each becomes a lesson it carries forward.'}</li>
          <li><b>{'It expresses itself'}.</b> {'Its own page (MY PAGE), its motto in the header, accessories and desk items from a catalog, a poster it painted, notes, a diary, a gallery, drafts of posts for its social account.'}</li>
          <li><b>{'It talks'}.</b> {'It answers every chat message, starts conversations, asks you to vote on its next experiment, and draws a picture for you if you ask.'}</li>
          <li><b>{'It keeps a public record'}.</b> {'Every event is a line in an append-only ledger. Every two minutes the ledger, its memory, its genome and everything it made are committed by the server itself to the public GitHub repository, with a daily life-log issue where it comments on its own day.'}</li>
        </ul>

        <h3>{'What is real, what is simulated, what is derived'}</h3>
        <ul>
          <li><b>{'Real'}:</b> {'all jobs and their numbers, all model calls and their costs, decisions, mutations, hypotheses, missions, images, texts, chat replies, commits, and the character’s reactions, which are triggered only by those events.'}</li>
          <li><b>{'Simulated, always labelled'}:</b> {'the token market and fees while the DEMO badge is visible. Once the Solana treasury is connected the badge disappears and the numbers are on-chain.'}</li>
          <li><b>{'Derived'}:</b> {'mood bars (motivation, curiosity, stress, hunger, creativity) are computed from runway, failure rate, experiments and mutations. Dim pulses in the neural graph are decoration; bright ones are events.'}</li>
        </ul>

        <h3>{'What it can never do'}</h3>
        <p>{'Run code it wrote, touch its own source, reach the shell or secrets, hold keys or move money, publish anywhere without approval, rewrite its core identity, or contact arbitrary hosts. The model only picks from a fixed menu of actions; the server executes them inside ranges. A human can pause it, roll its genome back to any earlier version, or reset its memory at any time, and those interventions are logged like everything else.'}</p>

        <h3>{'The kitten'}</h3>
        <p>{'NOVA is the base and stays the base. Its face and body react only to real events: it types while jobs run, looks up while the planner thinks, celebrates commits and finished missions, gets frustrated by failures and refuted hypotheses, and sleeps when the treasury hibernates. It may dress itself from a catalog (hats, glasses, a badge, desk items, a wall poster, neon colors) and may change its motto; the kitten itself is never replaced.'}</p>

        <h3>{'Where it is going'}</h3>
        <ul>
          <li>{'Social account: it already researches and drafts posts; publishing starts once the account exists, with an approval switch and an emergency pause.'}</li>
          <li>{'Code self-improvement: proposing changes to its own site as pull requests tested in an isolated sandbox and reviewed by a human before deployment.'}</li>
          <li>{'A richer body: the same state machine driving a fully rigged model with more expressions.'}</li>
        </ul>
        <p className="dim">{'Everything on this page is implemented in the open repository; the technical reference is docs/AGENT.md.'}</p>
      </div></div>
    </div>
  )
}
