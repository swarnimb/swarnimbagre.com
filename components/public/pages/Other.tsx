import { SiteHeader } from '@/components/public/SiteHeader';
import type { Note, Stat } from '@/lib/types';

/**
 * `/other` — "everything else".
 *
 * Viewport-locked on desktop: exactly one screen, no scroll. Four numeric
 * tiles over three text tiles, separated by 1px hairlines that are the grid
 * background showing through the gaps rather than borders.
 *
 * The layout is deliberately fixed, so it only looks right when filled. With
 * no rows it renders a single honest empty state instead of a grid of blank
 * boxes — an empty tile grid reads as broken, which is the exact impression
 * this redesign exists to fix.
 */

const LEDE = 'Some things I count, some things I am just in the middle of.';

const EMPTY = 'nothing counted yet';

export function Other({ stats, notes }: { stats: Stat[]; notes: Note[] }) {
  const hasContent = stats.length > 0 || notes.length > 0;

  return (
    <div className="cpage">
      <div className="container">
        <SiteHeader />

        <div className="ctitle-row">
          <h1 className="ctitle">everything else</h1>
          <p className="ctitle-lede">{LEDE}</p>
        </div>

        {!hasContent ? (
          <div className="cempty">{EMPTY}</div>
        ) : (
          <div className="cgrid">
            {stats.length > 0 && (
              <div className="crow">
                {stats.map((stat) => (
                  <div className="ctile" key={stat.id}>
                    <div className="c-numrow">
                      <span className="c-num">{stat.value}</span>
                      {stat.unit && <span className="c-unit">{stat.unit}</span>}
                    </div>
                    <div className="c-labels">
                      <span className="c-label">{stat.label}</span>
                      {stat.aside && (
                        <span className="c-aside">{stat.aside}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {notes.length > 0 && (
              <div className="trow">
                {notes.map((note) => (
                  <div className="ttile" key={note.id}>
                    <span className="t-kicker">{note.kicker}</span>
                    <span className="t-line">{note.line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
