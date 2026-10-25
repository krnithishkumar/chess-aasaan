import { BLOCKS, BOOKS, GLOSSARY, REVIEW_STEPS, SOURCES, THINKING_STEPS, TIME_PLAN, type Step } from '../lib/curriculum';

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="howto big-steps">
      {steps.map((s) => (
        <li key={s.title}>
          <strong>{s.title}</strong>
          <span>{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** The training method in plain language, for someone who has never had a coach. */
export default function MethodView() {
  return (
    <section className="method">
      <header className="page-head">
        <div>
          <div className="eyebrow">The method</div>
          <h1>How to train without a coach</h1>
          <p className="lede">
            This app doesn't invent its own system. Everything here comes from what coaches and studies agree on. Five ideas, in order of
            importance.
          </p>
        </div>
      </header>

      <nav className="toc" aria-label="On this page">
        <a href="#study">1. Study seriously, alone</a>
        <a href="#think">2. Think the same way every move</a>
        <a href="#review">3. Review your own games first</a>
        <a href="#time">4. Use your clock on purpose</a>
        <a href="#plan">5. The daily plan</a>
        <a href="#words">Words used here</a>
      </nav>

      <article className="panel" id="study">
        <h2>1. Study seriously, alone</h2>
        <p>
          In the largest studies of tournament players, the activity most strongly linked to playing strength was <strong>serious study on your own</strong>:
          solving positions, analysing games, working through books. It mattered more than how many games people played, and especially more than fast online
          games. Strong players had spent several times more hours on it than club players.
        </p>
        <p>
          "Serious" means it feels hard: you work on what you are bad at, you get the answer checked (here, by Stockfish), and you go back over what you got
          wrong. Comfortable activities like blitz or watching videos feel productive but do little.
        </p>
        <p className="small muted">
          Honest caveat: these are correlations from players' own reports of their hours. Practice explains a big part of strength, not all of it. It is
          still the part you control.
        </p>
      </article>

      <article className="panel" id="think">
        <h2>2. Think the same way every move</h2>
        <p>
          Most lost games at club level are not lost to deep ideas. They're lost to a move played without checking the opponent's reply. Dan Heisman calls
          that "Hope Chess". The fix is a fixed routine, used every move in a long game until it becomes automatic:
        </p>
        <Steps steps={THINKING_STEPS} />
        <p>
          Steps 3-4 come from Alexander Kotov: choose your candidates first, then calculate each one once, instead of jumping between lines. The{' '}
          <strong>Think trainer</strong> makes you write each step down on positions from your own games.
        </p>
      </article>

      <article className="panel" id="review">
        <h2>3. Review your own games first</h2>
        <p>
          If you open the engine straight away you learn the move, but not why you missed it. Dvoretsky and Yusupov, two of the best-known trainers, teach
          self-analysis first. Game review in this app follows their order:
        </p>
        <Steps steps={REVIEW_STEPS} />
        <p>
          The moments you marked are compared with the engine's turning points. Over time you want the score "you found X of Y" to go up. That means your
          judgment at the board is getting better.
        </p>
      </article>

      <article className="panel" id="time">
        <h2>4. Use your clock on purpose</h2>
        <p>
          Classical (90 minutes + 30 seconds a move) is a different sport from 10+0. You have time to calculate, but only if you don't spend it on easy moves.
        </p>
        <Steps steps={TIME_PLAN} />
        <h3>Checkpoints for 90+30</h3>
        <ul className="plain">
          <li>
            <strong>Move 20:</strong> 55 minutes or more left
          </li>
          <li>
            <strong>Move 30:</strong> 30 minutes or more
          </li>
          <li>
            <strong>Move 40:</strong> 10 minutes or more, plus the increment
          </li>
        </ul>
        <p className="small muted">
          These are common rules of thumb, not laws. Progress shows how your real games compare, scaled to their time control. Practise them in 30+20 or 45+15
          games online before playing over the board.
        </p>
      </article>

      <article className="panel" id="plan">
        <h2>5. The daily plan</h2>
        <p>
          The Today page splits your hours into these blocks. Your two weakest areas (from Stockfish's verdict on your games) get 25% more time; the rest is
          scaled to fit.
        </p>
        <table className="simple plan-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Of 4 hours</th>
              <th>What</th>
            </tr>
          </thead>
          <tbody>
            {BLOCKS.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{b.title}</strong>
                </td>
                <td>{b.minutes} min</td>
                <td>
                  {b.what}
                  <div className="small muted">{b.why}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Books for the off-screen blocks</h3>
        <ul className="books">
          {BOOKS.map((b) => (
            <li key={b.title}>
              <strong>{b.title}</strong> <span className="muted">by {b.author}</span>
              <div className="small">{b.use}</div>
            </li>
          ))}
        </ul>
        <p className="small muted">
          One good book worked through properly beats five skimmed. Set up the positions on a real board when you can, as you'll be playing on one.
        </p>
      </article>

      <article className="panel" id="words">
        <h2>Words used here</h2>
        <dl className="glossary">
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <dt>{g.term}</dt>
              <dd>{g.text}</dd>
            </div>
          ))}
        </dl>
      </article>

      <article className="panel">
        <h3>Sources</h3>
        <ul className="plain small">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
