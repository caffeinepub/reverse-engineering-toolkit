import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalysisSession } from "../backend.d";
import { useActor } from "./useActor";

export type { AnalysisSession };

export function useGetSessions() {
  const { actor, isFetching } = useActor();
  return useQuery<AnalysisSession[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSessions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      filename,
      tool,
      resultSummary,
    }: {
      filename: string;
      tool: string;
      resultSummary: string;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.createSession(filename, tool, resultSummary);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteSession(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useClearAllSessions() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.clearAllSessions();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useUpdateSessionNote() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: bigint; note: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateSessionNote(id, note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
