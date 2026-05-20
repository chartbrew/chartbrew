import React from "react";
import { Button, Card } from "@heroui/react";

import { RESOURCE_OPTIONS } from "../jira-builder.constants";
import { useJiraBuilder } from "./jira-builder-context";

function JiraResourceStep() {
  const { configuration, selectResource } = useJiraBuilder();

  return (
    <Card className="border border-divider bg-surface p-0 shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-accent">Step 1</span>
          <span className="font-semibold text-foreground">Choose a Jira resource</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-5">
          {RESOURCE_OPTIONS.map((resource) => {
            const Icon = resource.icon;
            const selected = configuration.resource === resource.id;

            return (
              <Button
                key={resource.id}
                variant={selected ? "secondary" : "outline"}
                className={`h-28 min-w-0 flex-col items-start justify-start gap-3 rounded-2xl border p-4 text-left ${
                  selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-divider bg-surface text-foreground"
                }`}
                onPress={() => selectResource(resource.id)}
                fullWidth
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${resource.iconClassName}`}>
                  <Icon size={20} />
                </span>
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="w-full truncate text-sm font-semibold">{resource.label}</span>
                  <span className={`line-clamp-2 text-xs ${selected ? "text-accent/80" : "text-muted"}`}>
                    {resource.description}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </Card.Content>
    </Card>
  );
}

export default JiraResourceStep;
