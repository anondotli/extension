
import { useState, useRef, useEffect } from "preact/hooks";
import { Toggle } from "../ui/Toggle";
import { Input } from "../ui/Input";
import { Menu } from "../ui/Menu";
import { apiPatch, apiDelete } from "../../lib/api";
import { copyToClipboard } from "../../lib/utils";
import type { Alias } from "../../lib/types";

interface AliasListProps {
  aliases: Alias[];
  focusedIndex?: number;
  onUpdate: (alias: Alias) => void;
  onDelete: (id: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function AliasList({ aliases, focusedIndex = -1, onUpdate, onDelete, onError, onSuccess }: AliasListProps) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemElRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < aliases.length) {
      itemElRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, aliases.length]);

  function startConfirmDelete(id: string) {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmDelete(id);
    confirmTimerRef.current = setTimeout(() => setConfirmDelete(null), 4000);
  }

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  function startEdit(alias: Alias) {
    setEditing(alias.id);
    setEditLabel(alias.label ?? "");
    setEditingNote(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditLabel("");
  }

  function startEditNote(alias: Alias) {
    setEditingNote(alias.id);
    setEditNote(alias.note ?? "");
    setEditing(null);
  }

  function cancelEditNote() {
    setEditingNote(null);
    setEditNote("");
  }

  async function saveNote(alias: Alias) {
    setSavingNote(alias.id);
    try {
      const result = await apiPatch<Alias>(`/api/v1/alias/${alias.id}`, {
        note: editNote.trim() || null,
      });
      onUpdate(result.data);
      setEditingNote(null);
      setEditNote("");
      onSuccess("Note updated");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update note");
    } finally {
      setSavingNote(null);
    }
  }

  async function saveLabel(alias: Alias) {
    setSavingLabel(alias.id);
    try {
      const result = await apiPatch<Alias>(`/api/v1/alias/${alias.id}`, {
        label: editLabel.trim() || null,
      });
      onUpdate(result.data);
      setEditing(null);
      setEditLabel("");
      onSuccess("Label updated");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update label");
    } finally {
      setSavingLabel(null);
    }
  }

  async function handleToggle(alias: Alias) {
    setToggling(alias.id);
    try {
      const result = await apiPatch<Alias>(`/api/v1/alias/${alias.id}`, {
        active: !alias.active,
      });
      onUpdate(result.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to toggle alias");
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(alias: Alias) {
    if (confirmDelete !== alias.id) {
      startConfirmDelete(alias.id);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setDeleting(alias.id);
    setConfirmDelete(null);
    try {
      await apiDelete(`/api/v1/alias/${alias.id}`);
      onDelete(alias.id);
      onSuccess("Alias deleted");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete alias");
    } finally {
      setDeleting(null);
    }
  }

  if (aliases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 border-2 border-dashed border-border/60 rounded-xl text-center">
        <p className="text-sm text-muted-foreground">No aliases yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {aliases.map((alias, idx) => (
        <div
          key={alias.id}
          ref={(el) => { itemElRefs.current[idx] = el; }}
          class={`py-2 flex flex-col gap-1.5 transition-colors ${
            focusedIndex === idx ? "bg-accent/50 -mx-2 px-2 rounded-lg" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-w-0 text-left text-xs font-mono truncate text-foreground hover:text-primary transition-colors"
              title={`Copy ${alias.email}`}
              onClick={async () => {
                await copyToClipboard(alias.email);
                onSuccess("Copied!");
              }}
            >
              {alias.email}
            </button>
            {alias.label && editing !== alias.id && (
              <span className="shrink-0 max-w-[35%] truncate text-xs text-muted-foreground">
                {alias.label}
              </span>
            )}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <Toggle
                checked={alias.active}
                onChange={() => handleToggle(alias)}
                loading={toggling === alias.id}
              />
              {confirmDelete === alias.id ? (
                <div className="flex items-center gap-0.5 animate-slide-down">
                  <button
                    type="button"
                    className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                    disabled={deleting === alias.id}
                    onClick={() => handleDelete(alias)}
                  >
                    {deleting === alias.id ? "…" : "Delete?"}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setConfirmDelete(null)}
                    title="Cancel"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ) : (
                <Menu
                  items={[
                    {
                      label: "Edit label",
                      onClick: () => startEdit(alias),
                    },
                    {
                      label: "Edit note",
                      onClick: () => startEditNote(alias),
                    },
                    {
                      label: "Delete",
                      variant: "destructive",
                      onClick: () => handleDelete(alias),
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {editing === alias.id && (
            <div className="flex gap-1 items-center">
              <Input
                value={editLabel}
                onInput={(e) => setEditLabel((e.target as HTMLInputElement).value)}
                placeholder="Label (optional)"
                class="flex-1 h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabel(alias);
                  else if (e.key === "Escape") cancelEdit();
                }}
              />
              <button
                type="button"
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-green-500 transition-colors disabled:opacity-50"
                disabled={savingLabel === alias.id}
                onClick={() => saveLabel(alias)}
                title="Save label"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </button>
              <button
                type="button"
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                onClick={cancelEdit}
                title="Cancel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          )}
          {editingNote === alias.id && (
            <div className="flex gap-1 items-center">
              <Input
                value={editNote}
                onInput={(e) => setEditNote((e.target as HTMLInputElement).value)}
                placeholder="Note (optional)"
                class="flex-1 h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNote(alias);
                  else if (e.key === "Escape") cancelEditNote();
                }}
              />
              <button
                type="button"
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-green-500 transition-colors disabled:opacity-50"
                disabled={savingNote === alias.id}
                onClick={() => saveNote(alias)}
                title="Save note"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </button>
              <button
                type="button"
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                onClick={cancelEditNote}
                title="Cancel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
