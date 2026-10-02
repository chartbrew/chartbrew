import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, TextField, InputGroup } from "@heroui/react";
import { useParams } from "react-router";
import { LuArrowUp, LuChevronDown, LuChevronUp, LuUndo2 } from "react-icons/lu";
import { useSelector } from "react-redux";

import { API_HOST } from "../../config/settings";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { getAuthToken } from "../../modules/auth";
import { selectTeam } from "../../slices/team";
import ChartbrewAiIcon from "../../components/ChartbrewAiIcon";
import PixelLoader from "../../components/PixelLoader";
import { resolveQuerySuggestion } from "./querySuggestion";

function AiQuery({ onChangeQuery, dataRequest, query = "" }) {
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [previousQuery, setPreviousQuery] = useState(null);
  const current = useRef({ query, onChangeQuery });
  current.current = { query, onChangeQuery };
  const pending = useRef(false);
  const team = useSelector(selectTeam);
  const params = useParams();

  const askAi = async () => {
    if (!question.trim() || pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    const submittedQuestion = question.trim();
    const submittedQuery = query;

    try {
      const response = await fetch(`${API_HOST}/team/${team?.id}/datasets/${params.datasetId}/dataRequests/${dataRequest.id}/askAi`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          question: submittedQuestion,
          conversationHistory: conversation,
          currentQuery: submittedQuery,
        }),
      });
      if (!response.ok) throw new Error("Could not generate a query");
      const data = await response.json();
      const next = resolveQuerySuggestion(data, submittedQuery, current.current.query);
      setConversation(data.conversationHistory || []);
      setMessages((items) => [...items, { question: submittedQuestion, query: data.query }]);
      setQuestion("");
      setSuggestion(next.query);
      setPreviousQuery(next.previousQuery);
      if (next.previousQuery !== null) current.current.onChangeQuery(next.query);
    } catch (_error) {
      setError("Could not generate a query. Try again.");
    } finally {
      setLoading(false);
      pending.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <ChartbrewAiIcon />
          Ask AI
        </span>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" aria-expanded={expanded} onPress={() => setExpanded(!expanded)}>
            Conversation
            {expanded ? <LuChevronUp aria-hidden size={16} /> : <LuChevronDown aria-hidden size={16} />}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="flex max-h-48 flex-col gap-4 overflow-y-auto rounded-xl bg-surface-secondary/30 p-3" role="log" aria-label="Query conversation">
          {messages.map((message, index) => (
            <div key={index} className="flex flex-col gap-2 text-sm">
              <p className="whitespace-pre-wrap break-words font-medium">{message.question}</p>
              <pre className="overflow-x-auto text-xs text-muted">{message.query}</pre>
            </div>
          ))}
        </div>
      )}
      <TextField fullWidth name="dataset-ai-query" aria-label="Ask AI about your data" isDisabled={loading}>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.TextArea
            rows={2}
            className="resize-none"
            placeholder="What data do you want to see?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                askAi();
              }
            }}
          />
          <InputGroup.Suffix className="self-end pb-2 pr-2">
            <Button aria-label="Generate query" isIconOnly size="sm" isDisabled={!question.trim()} isPending={loading} onPress={askAi}>
              {loading ? <ButtonSpinner /> : <LuArrowUp aria-hidden size={18} />}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </TextField>
      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <PixelLoader />
          Generating query…
        </p>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {suggestion !== null && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" role="status">
            {suggestion === query ? "Query updated. Run it to check the results." : "Query ready. Apply it to replace the current query."}
          </p>
          {suggestion === query && previousQuery !== null ? (
            <Button size="sm" variant="ghost" onPress={() => {
              onChangeQuery(previousQuery);
              setPreviousQuery(null);
              setSuggestion(null);
            }}>
              <LuUndo2 aria-hidden size={16} />
              Undo query change
            </Button>
          ) : suggestion !== query ? (
            <Button size="sm" variant="secondary" onPress={() => {
              setPreviousQuery(query);
              onChangeQuery(suggestion);
            }}>
              Apply query
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

AiQuery.propTypes = {
  onChangeQuery: PropTypes.func.isRequired,
  dataRequest: PropTypes.object.isRequired,
  query: PropTypes.string,
};

export default AiQuery;
