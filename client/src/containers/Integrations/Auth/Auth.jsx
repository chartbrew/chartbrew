import { Spacer } from "@heroui/react";
import React from "react"
import { useParams } from "react-router";
import SlackAuth from "./SlackAuth";

function Auth() {
  const { integrationType } = useParams();

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold font-tw">
            Authenticate integration
          </div>
          <div className="text-sm text-foreground-500">
            {"Authenticate your integration with external services"}
          </div>
        </div>
      </div>

      <Spacer y={4} />

      <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider">
        {integrationType === "slack" && <SlackAuth />}
      </div>
    </div>
  )
}

export default Auth
