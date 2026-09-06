import React, { useEffect, useState } from "react";
import { AlertDialog, Button, Description, Form, Label, ProgressCircle, TextArea, TextField } from "@heroui/react";
import { LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import { requestAiMemory } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectAiModalOpen } from "../../slices/ui";
import { ButtonSpinner } from "../../components/ButtonSpinner";

function AiMemorySettings() {
  const team = useSelector(selectTeam);
  const chatOpen = useSelector(selectAiModalOpen);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (chatOpen) return undefined;
    let active = true;
    setError("");
    requestAiMemory(team.id).then((result) => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setError("Could not load memory. Try again.");
    });
    return () => { active = false; };
  }, [team.id, reload, chatOpen]);

  const save = async () => {
    if (pending || !text.trim()) return;
    setPending(true);
    try {
      const adding = editing === "new";
      const result = await requestAiMemory(team.id, { method: adding ? "POST" : "PATCH", id: adding ? undefined : editing, text });
      setData((current) => ({
        ...current,
        memories: adding ? [result.memory, ...current.memories] : current.memories.map((item) => item.id === editing ? result.memory : item),
      }));
      setEditing(null);
      setText("");
      toast.success(adding ? "Memory added" : "Memory updated");
    } catch (err) { toast.error(err.message); }
    finally { setPending(false); }
  };

  const remove = async () => {
    setPending(true);
    try {
      await requestAiMemory(team.id, { method: "DELETE", id: deleting === "all" ? undefined : deleting });
      setData((current) => ({ ...current, memories: current.memories.filter((item) => deleting !== "all" && item.id !== deleting) }));
      setDeleting(null);
      setEditing(null);
      toast.success("Memory deleted");
    } catch (err) { toast.error(err.message); }
    finally { setPending(false); }
  };

  return (
    <section className="rounded-3xl border border-divider bg-surface p-4" aria-labelledby="ai-memory-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ai-memory-heading" className="text-lg font-semibold">Memory</h2>
        <div className="flex gap-2">
          {data?.memories.length > 0 && (
            <Button size="sm" variant="danger-soft" isDisabled={pending} onPress={() => setDeleting("all")}>Delete all</Button>
          )}
          <Button size="sm" variant="primary" isDisabled={!data || Boolean(error) || pending || Boolean(editing)} onPress={() => { setEditing("new"); setText(""); }}>
            <LuPlus aria-hidden="true" />Add memory
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">These memories apply only to your account. They do not affect your teammates’ memories.</p>
      {error ? (
        <div className="mt-4 flex items-center gap-3" role="alert">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="secondary" onPress={() => setReload((value) => value + 1)}>Try again</Button>
        </div>
      ) : !data ? <ProgressCircle className="my-4" aria-label="Loading memory" /> : (
        <>
          {!data.sharingEnabled && <p className="mt-4 text-sm text-muted">Memory is saved, but its use in AI answers is turned off. Ask a platform administrator to enable feedback and memory sharing in AI controls.</p>}
          {editing && (
            <Form className="mt-4 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
              <TextField value={text} onChange={setText} isDisabled={pending}>
                <Label>{editing === "new" ? "New memory" : "Edit memory"}</Label>
                <TextArea autoFocus rows={3} maxLength={500} className="w-full" variant="secondary" />
                <Description>{text.length}/500 characters</Description>
              </TextField>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" variant="primary" type="submit" isPending={pending} isDisabled={!text.trim()}>{pending && <ButtonSpinner />}Save</Button>
              </div>
            </Form>
          )}
          {data.memories.length === 0 ? !editing && <p className="py-6 text-sm text-muted">No memories yet. Add one here or use <code>/remember</code> in chat.</p> : (
            <ul className="mt-3 divide-y divide-divider">
              {data.memories.map((item) => (
                <li key={item.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="whitespace-pre-wrap break-words text-sm">{item.text}</p>
                      <time className="mt-1 block text-xs text-muted" dateTime={item.updatedAt}>Updated {new Date(item.updatedAt).toLocaleString()}</time>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" isIconOnly aria-label="Edit memory" isDisabled={pending || Boolean(editing)} onPress={() => { setEditing(item.id); setText(item.text); }}><LuPencil aria-hidden="true" /></Button>
                      <Button size="sm" variant="danger-soft" isIconOnly aria-label="Delete memory" isDisabled={pending || Boolean(editing)} onPress={() => setDeleting(item.id)}><LuTrash2 aria-hidden="true" /></Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <AlertDialog.Backdrop isOpen={Boolean(deleting)} onOpenChange={(open) => { if (!open && !pending) setDeleting(null); }}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header><AlertDialog.Heading>{deleting === "all" ? "Delete all your memories in this team?" : "Delete this memory?"}</AlertDialog.Heading></AlertDialog.Header>
            <AlertDialog.Body>
              {deleting !== "all" && <p className="mb-3 whitespace-pre-wrap break-words">{data?.memories.find((item) => item.id === deleting)?.text}</p>}
              <p>This cannot be undone. The change applies to your next question. Existing chat messages stay in your history.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" isDisabled={pending} onPress={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" isPending={pending} onPress={remove}>{pending && <ButtonSpinner />}Delete</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </section>
  );
}

export default AiMemorySettings;
