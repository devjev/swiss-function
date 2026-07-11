import { schedulerSuite } from "./suite";
import { createRuntimeGraph } from "./runtime-graph";

schedulerSuite("observable-runtime adapter", createRuntimeGraph);
