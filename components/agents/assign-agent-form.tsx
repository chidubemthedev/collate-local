"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldSpinner } from "@/components/ui/field-spinner";
import { AgentAutocomplete } from "./agent-autocomplete";
import { useAssignmentOwners, useCreateAssignment } from "@/lib/hooks/use-coverage";
import { Loader2 } from "lucide-react";

interface AssignAgentFormProps {
  pollingUnitId: number;
  /** Official fills the unit's one official slot; extra takes the owner's next free extra slot. */
  agentKind: "official" | "extra";
  onAssigned: () => void;
  onCancel: () => void;
}

/**
 * Pick a person (not yet an agent) and who they are an agent for, then assign them to a polling
 * unit. Used for both the official agent (Assign) and extra agents (Add extra) on the Agents page.
 */
export function AssignAgentForm({ pollingUnitId, agentKind, onAssigned, onCancel }: AssignAgentFormProps) {
  const createAssignment = useCreateAssignment();
  const owners = useAssignmentOwners();

  const [personId, setPersonId] = useState("");
  // "group:3" or "candidate:7"; "" until picked.
  const [ownerChoice, setOwnerChoice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidateOptions = (owners.data?.candidates ?? []).map((candidate) => ({
    value: `candidate:${candidate.id}`,
    label: candidate.office ? `${candidate.name} (${candidate.office} candidate)` : candidate.name,
  }));
  const groupOptions = (owners.data?.groups ?? []).map((group) => ({ value: `group:${group.id}`, label: group.name }));
  const ownerOptions = [...candidateOptions, ...groupOptions];
  // With a single option there is nothing to choose: pick it.
  const owner = ownerChoice || (ownerOptions.length === 1 ? ownerOptions[0].value : "");
  const ownerLabel = (value: unknown) =>
    ownerOptions.find((option) => option.value === value)?.label ?? "Choose who the agent is for";

  const handleAssign = async () => {
    const [ownerType, ownerIdText] = owner.split(":");
    const ownerId = Number(ownerIdText);
    if (!personId || !Number.isSafeInteger(ownerId) || ownerId < 1) {
      setError("Pick a person and who the agent is for.");
      return;
    }

    setError(null);
    try {
      await createAssignment.mutateAsync({
        pollingUnitId,
        personId,
        agentKind,
        ...(agentKind === "official" ? { slotNumber: 0 } : {}),
        ...(ownerType === "group" ? { ownerGroupId: ownerId } : { ownerCandidateId: ownerId }),
      });
      onAssigned();
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to assign agent.",
      );
    }
  };

  const optionGroup = (label: string, options: typeof ownerOptions) =>
    options.length > 0 ? (
      <SelectGroup>
        <SelectLabel>{label}</SelectLabel>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectGroup>
    ) : null;

  return (
    <div className="space-y-2">
      <AgentAutocomplete
        value={personId}
        onChange={(id) => {
          setPersonId(id);
          setError(null);
        }}
        disabled={createAssignment.isPending}
      />

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">Agent for</label>
          <FieldSpinner loading={owners.isLoading} />
        </div>
        {owners.error ? (
          <p className="text-[11px] text-destructive">Couldn&rsquo;t load owners. Try again.</p>
        ) : !owners.isLoading && ownerOptions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">You can&rsquo;t assign agents for any group or candidate.</p>
        ) : (
          <Select
            value={owner || null}
            onValueChange={(value) => {
              setOwnerChoice(typeof value === "string" ? value : "");
              setError(null);
            }}
            disabled={owners.isLoading || createAssignment.isPending}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Choose who the agent is for">{ownerLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {optionGroup("Candidate", candidateOptions)}
              {optionGroup("Groups", groupOptions)}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleAssign}
          disabled={createAssignment.isPending || !personId || !owner}
          className="flex-1 text-xs h-7.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
        >
          {createAssignment.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {agentKind === "official" ? "Confirm Assignment" : "Add Extra Agent"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-7.5">
          Cancel
        </Button>
      </div>
    </div>
  );
}
