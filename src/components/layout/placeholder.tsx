import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, title, description, points }: {
  icon: LucideIcon; title: string; description: string; points: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-7" />
          </div>
          <div className="max-w-md">
            <p className="text-sm text-muted-foreground">Scaffolded and wired into the data model. Planned for this module:</p>
            <ul className="mx-auto mt-3 max-w-sm space-y-1 text-left text-sm">
              {points.map((p) => <li key={p} className="flex gap-2"><span className="text-primary">•</span>{p}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
