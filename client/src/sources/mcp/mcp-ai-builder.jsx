import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  InputGroup,
  TextField,
} from "@heroui/react";
import {
  LuCheck,
  LuArrowUp,
} from "react-icons/lu";

import { ButtonSpinner } from "../../components/ButtonSpinner";
import ChartbrewAiIcon from "../../components/ChartbrewAiIcon";
import PixelLoader from "../../components/PixelLoader";
import { API_HOST } from "../../config/settings";
import { getAuthToken } from "../../modules/auth";

function McpAiBuilder({ configuration, dataRequest, onApply, teamId }) {
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuestion("");
    setProposal(null);
    setError("");
  }, [dataRequest.id]);

  const generate = async () => {
    const request = question.trim();
    if (!request || loading) return;

    setLoading(true);
    setError("");
    setProposal(null);
    try {
      const response = await fetch(
        `${API_HOST}/team/${teamId}/datasets/${dataRequest.dataset_id}/dataRequests/${dataRequest.id}/ai-configuration`,
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${getAuthToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: request,
            currentConfiguration: configuration,
          }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Chartbrew could not build this setup.");
      }
      setProposal(result);
    } catch (requestError) {
      setError(requestError.message || "Chartbrew could not build this setup.");
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = () => {
    if (!proposal?.configuration) return;
    onApply(proposal.configuration);
    setProposal(null);
    setQuestion("");
  };

  const argumentCount = Object.keys(proposal?.configuration?.arguments || {}).length;

  return (
    <section className="flex min-w-0 flex-col gap-2 pt-4 sm:pt-6" aria-label="Ask AI">
      <div className="flex min-h-8 items-center gap-2 text-sm font-medium">
        <ChartbrewAiIcon />
        Ask AI
      </div>
      <TextField
        fullWidth
        name={`mcp-ai-question-${dataRequest.id}`}
        aria-label="Ask AI about your data"
        isDisabled={loading}
      >
        <InputGroup fullWidth variant="secondary">
          <InputGroup.TextArea
            rows={2}
            className="resize-none"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                generate();
              }
            }}
            placeholder="What data do you want to see?"
            value={question}
          />
          <InputGroup.Suffix className="self-end pb-2 pr-2">
            <Button
              aria-label="Generate setup"
              isIconOnly
              isDisabled={!question.trim()}
              isPending={loading}
              onPress={generate}
              size="sm"
            >
              {loading ? <ButtonSpinner /> : <LuArrowUp size={18} aria-hidden />}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </TextField>
      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <PixelLoader />
          Generating setup…
        </p>
      )}

      {error ? (
        <Alert className="shadow-none" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Could not build this setup</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {proposal?.configuration ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-divider bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <ChartbrewAiIcon size={16} />
            </span>
            <p className="font-medium text-foreground">Suggested setup</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-divider bg-surface-secondary">
            <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
              <p className="min-w-0 truncate font-semibold text-foreground">
                {proposal.tool?.title || proposal.tool?.name}
              </p>
              <span className="shrink-0 text-xs text-muted">
                {`${argumentCount} ${argumentCount === 1 ? "argument" : "arguments"}`}
              </span>
            </div>
            <pre className="max-h-72 overflow-auto p-4 font-mono text-xs leading-6 text-foreground">
              {JSON.stringify(proposal.configuration.arguments, null, 2)}
            </pre>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="rounded-full" onPress={applyProposal} variant="primary">
              <LuCheck size={16} aria-hidden />
              Apply to form
            </Button>
            <Button onPress={() => setProposal(null)} variant="ghost">
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

McpAiBuilder.propTypes = {
  configuration: PropTypes.object.isRequired,
  dataRequest: PropTypes.object.isRequired,
  onApply: PropTypes.func.isRequired,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};

export default McpAiBuilder;
