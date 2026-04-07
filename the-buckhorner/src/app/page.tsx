import { ActivityCards } from "@/components/ActivityCards";
import { RSVPForm } from "@/components/RSVPForm";
import { StickyRSVP } from "@/components/StickyRSVP";
import { GoatchellaInfo } from "@/components/GoatchellaSection";
import { ScrollArrow } from "@/components/ScrollArrow";

export default function Home() {
  return (
    <main className="flex-1">
      <StickyRSVP />

      {/* Hero */}
      <section
        id="hero"
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="relative z-10 max-w-3xl mx-auto stagger">
          <p className="text-muted text-sm tracking-[0.3em] uppercase mb-6">
            August 21–22, 2026 &middot; Buckhorn, Ontario
          </p>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-6">
            The
            <br />
            <span className="text-accent">Buckhorner</span>
          </h1>
          <p className="text-xl sm:text-2xl text-accent-soft font-light max-w-xl mx-auto mb-4">
            Jared &amp; Jen&apos;s 30th Birthday + Housewarming
          </p>
          <p className="text-foreground/80 text-lg mt-8 max-w-lg mx-auto leading-relaxed">
            We miss you. Come hang and bring your friends.
            <br />
            Bring a sleeping bag, perhaps a tent.
          </p>
          <ScrollArrow to="activities" />
        </div>
      </section>

      {/* What's Happening */}
      <section id="activities" className="max-w-4xl mx-auto px-6 pb-32 pt-24">
        <ScrollArrow to="hero" direction="up" />
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
          What&apos;s Happening
        </h2>
        <p className="text-muted text-lg mb-12 max-w-2xl mx-auto text-center">
          Everything below is optional. Come to some, come to all — just let
          us know early so we can plan.
        </p>
        <ActivityCards />
        <ScrollArrow to="details" />
      </section>

      {/* Details + Goatchella */}
      <section
        id="details"
        className="max-w-4xl mx-auto px-6 py-24 border-t border-card-border"
      >
        <ScrollArrow to="activities" direction="up" />
        <h2 className="text-3xl font-bold mb-8 text-center">Details</h2>
        <div className="grid sm:grid-cols-2 gap-8 text-muted">
          <div className="space-y-4">
            <div>
              <h3 className="text-foreground font-semibold mb-1">When</h3>
              <p>Friday, August 21 through Saturday, August 22</p>
            </div>
            <div>
              <h3 className="text-foreground font-semibold mb-1">Where</h3>
              <p>Buckhorn, Ontario</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-foreground font-semibold mb-1">Sleeping</h3>
              <p>
                Camping-themed. BYO sleeping bag. We have a few blowup
                mattresses but not enough for everyone.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-semibold mb-1">Bring</h3>
              <p>
                Yourself. Your friends. A sleeping bag. Sunscreen. Whatever
                you&apos;d want for a weekend in cottage country.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-16 border-t border-card-border">
          <GoatchellaInfo />
        </div>

        <ScrollArrow to="rsvp" />
      </section>

      {/* RSVP */}
      <section
        id="rsvp"
        className="max-w-5xl mx-auto px-6 pt-16 pb-12 border-t border-card-border"
      >
        <ScrollArrow to="details" direction="up" />
        <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-center">RSVP</h2>
        <RSVPForm />
      </section>
    </main>
  );
}
