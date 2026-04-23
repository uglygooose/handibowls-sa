export function Quote() {
  return (
    <section
      id="about"
      className="relative mx-auto max-w-[900px] px-5 py-14 text-center md:px-12 md:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-10 font-display text-[240px] font-black italic leading-none text-primary-500 opacity-[0.12]"
      >
        &ldquo;
      </div>
      <blockquote className="m-0 mb-7 font-display text-[clamp(26px,2.8vw,40px)] font-bold italic leading-[1.15] tracking-[-0.01em] text-balance">
        HandiBowls is the first time our tournament, our ladder, and our T20
        cards all lived in the same place — and the only time the secretary
        went home before 8pm.
      </blockquote>
      <div className="flex items-center justify-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink font-display text-[18px] font-extrabold text-ink-inverse">
          NM
        </div>
        <div>
          <div className="text-left text-sm font-bold">Nthabi Mokoena</div>
          <div className="text-left text-xs text-ink-subtle">
            Club Captain · Rondebosch BC
          </div>
        </div>
      </div>
    </section>
  );
}
