import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button, Card } from "@heroui/react";
import { LuDatabase, LuExternalLink } from "react-icons/lu";

function AiDataRecoveryCard({ recovery, onContinue, isLoading }) {
  const [opened, setOpened] = useState(false);
  const dataset = recovery.action === "dataset";
  const id = dataset ? recovery.datasetId : recovery.connectionId;
  const hasTarget = ["dataset", "connection"].includes(recovery.action) && /^[1-9]\d*$/.test(String(id));
  const path = hasTarget ? `/${dataset ? "datasets" : "connections"}/${id}` : null;
  return (
    <Card className="my-3 gap-3 rounded-[2rem] bg-foreground/[0.055] p-3 shadow-none dark:bg-foreground/[0.08]">
      <Card.Header className="flex-row items-center gap-2 px-2 py-1">
        <LuDatabase size={20} className="text-warning" aria-hidden />
        <Card.Title className="text-base">Data could not be updated</Card.Title>
      </Card.Header>
      <Card.Content className="gap-4 rounded-[1.25rem] bg-surface p-4">
        <p className="text-sm">{recovery.message}</p>
        <Card.Footer className="flex-wrap gap-2">
          {path ? (
            <Button variant="primary" onPress={() => setOpened(true)}
              render={(props) => <a {...props} href={path} target="_blank" rel="noopener noreferrer" />}>
              {dataset ? "Fix dataset" : "Open connection"}
              <LuExternalLink size={16} aria-hidden />
            </Button>
          ) : null}
          {opened || !path ? (
            <Button variant="secondary" isDisabled={isLoading}
              onPress={() => onContinue(`Check the ${dataset ? "dataset" : "connection"}${hasTarget ? ` ${id}` : ""} again and continue my original request. Do not use old data as a successful refresh.`)}>
              {path ? "Continue request" : "Try again"}
            </Button>
          ) : null}
        </Card.Footer>
      </Card.Content>
    </Card>
  );
}

AiDataRecoveryCard.propTypes = {
  recovery: PropTypes.object.isRequired,
  onContinue: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default AiDataRecoveryCard;
