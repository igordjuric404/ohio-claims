import * as dynamo from "./dynamo.js";
import * as memory from "./memory.js";

const useMemory = process.env.USE_MEMORY_STORAGE === "true";

export const putClaim = useMemory ? memory.putClaim : dynamo.putClaim;
export const getClaim = useMemory ? memory.getClaim : dynamo.getClaim;
export const updateClaimStage = useMemory ? memory.updateClaimStage : dynamo.updateClaimStage;
export const putEvent = useMemory ? memory.putEvent : dynamo.putEvent;
export const getLastEvent = useMemory ? memory.getLastEvent : dynamo.getLastEvent;
export const getEvents = useMemory ? memory.getEvents : dynamo.getEvents;
