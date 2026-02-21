import * as dynamo from "./dynamo.js";
import * as memory from "./memory.js";

const useMemory = process.env.USE_MEMORY_STORAGE === "true";

export const putClaim = useMemory ? memory.putClaim : dynamo.putClaim;
export const getClaim = useMemory ? memory.getClaim : dynamo.getClaim;
export const updateClaimStage = useMemory ? memory.updateClaimStage : dynamo.updateClaimStage;
export const putEvent = useMemory ? memory.putEvent : dynamo.putEvent;
export const getLastEvent = useMemory ? memory.getLastEvent : dynamo.getLastEvent;
export const getEvents = useMemory ? memory.getEvents : dynamo.getEvents;

// Runs
export const putRun = useMemory ? memory.putRun : dynamo.putRun;
export const getRun = useMemory ? memory.getRun : dynamo.getRun;
export const updateRunStatus = useMemory ? memory.updateRunStatus : dynamo.updateRunStatus;
export const getRunsForClaim = useMemory ? memory.getRunsForClaim : dynamo.getRunsForClaim;

// RunEvents
export const putRunEvent = useMemory ? memory.putRunEvent : dynamo.putRunEvent;
export const getRunEvents = useMemory ? memory.getRunEvents : dynamo.getRunEvents;

// Agents
export const putAgent = useMemory ? memory.putAgent : dynamo.putAgent;
export const getAgent = useMemory ? memory.getAgent : dynamo.getAgent;
export const getAllAgents = useMemory ? memory.getAllAgents : dynamo.getAllAgents;

// Admin scans
export const scanClaims = useMemory ? memory.scanClaims : dynamo.scanClaims;
export const scanRuns = useMemory ? memory.scanRuns : dynamo.scanRuns;
