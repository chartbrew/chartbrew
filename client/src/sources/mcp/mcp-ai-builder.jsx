import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  InputGroup,
  TextField,
} from "@heroui/react";
import {
  LuBrainCircuit,
  LuCheck,
  LuChevronDown,
  LuSend,
} from "react-icons/lu";

import { ButtonSpinner } from "../../components/ButtonSpinner";
import { API_HOST } from "../../config/settings";
import { getAuthToken } from "../../modules/auth";

function McpAiBuilder({ configuration, dataRequest, onApply, teamId }) {
  const [expanded, setExpanded] = useState(true);
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setExpanded(true);
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
  const contentId = `mcp-ai-builder-content-${dataRequest.id}`;

  return (
    <section className="-mx-4 border-b border-divider bg-accent/5 px-4 py-4 sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-4">
        <button
          aria-controls={contentId}
          aria-expanded={expanded}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
              <LuBrainCircuit size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Build with AI</p>
              <p className="text-sm text-muted">
                Describe the dataset you need. AI selects a tool and fills its arguments.
              </p>
            </div>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors group-hover:bg-content2 group-hover:text-foreground">
            <LuChevronDown
              aria-hidden
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              size={18}
            />
          </span>
        </button>

        {expanded ? (
          <div className="flex flex-col gap-4" id={contentId}>
            <TextField fullWidth name={`mcp-ai-question-${dataRequest.id}`}>
              <InputGroup className="bg-surface" fullWidth variant="secondary">
                <InputGroup.Input
                  aria-label="Describe the MCP dataset you need"
                  autoFocus
                  disabled={loading}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      generate();
                    }
                  }}
                  placeholder="Describe the dataset you need"
                  value={question}
                />
                <InputGroup.Suffix className="pr-1">
                  <Button
                    isDisabled={!question.trim()}
                    isPending={loading}
                    onPress={generate}
                    variant="primary"
                    size="sm"
                  >
                    {loading ? <ButtonSpinner /> : <LuSend size={16} aria-hidden />}
                    {loading ? "Building" : "Generate"}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
            </TextField>

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
                    <LuBrainCircuit size={16} aria-hidden />
                  </span>
                  <p className="font-medium text-foreground">Suggested setup</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-divider bg-content2">
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
          </div>
        ) : null}
      </div>
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
