import Link from "next/link";
import { CalendarDays, Clock, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">R</div>
          RotaWise
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/register">Get started</Link></Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-4 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Scheduling, leave & time tracking in one place
        </span>
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Workforce scheduling that just works
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Build rotas in minutes, manage availability and leave, let staff swap shifts, and track
          hours — all from a fast, modern dashboard.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link href="/register">Start free <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
        </div>

        <div className="mt-20 grid w-full gap-6 sm:grid-cols-3">
          {[
            { icon: CalendarDays, title: "Drag-and-drop rotas", desc: "Copy last week, set recurring shifts, publish in a click." },
            { icon: Users, title: "Availability & skills", desc: "Schedule the right people with rule-based warnings." },
            { icon: Clock, title: "Clock in & timesheets", desc: "Web and mobile clock-in with optional GPS." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border p-6 text-left">
              <f.icon className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        RotaWise — a workforce scheduling demo build.
      </footer>
    </div>
  );
}
